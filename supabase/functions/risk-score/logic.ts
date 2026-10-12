// FRAUD-MULTIBLOCK-1012 5b: pre-payment risk score (shared by the risk-score function and cellpay-proxy).
// Service role only. Whole budget 700 ms; any error -> { action: "allow", error: true }. Never reads or stores a full card number:
// card / address keys come in already reduced (BIN6:last4, normalized address). Stores phone last 4 only.

export type RiskInput = {
  phone?: string | null; email?: string | null; amount?: number | null; carrier_slug?: string | null; payment_method?: string | null;
  checkout_session_id?: string | null; cp_dev?: { dev_fp?: string; dev_id?: string } | null; visitorId?: string | null;
  card_bin6?: string | null; card_last4?: string | null; card_exp?: string | null; addr_norm?: string | null; ip?: string | null;
};
export type RiskResult = { score?: number; action: "allow" | "step_up" | "hold" | "block"; reasons?: string[]; mode?: string; error?: boolean };

const BUDGET_MS = 700;
const s = (v: unknown): string | null => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

async function rpc(name: string, body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("no creds");
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST", signal,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { await r.body?.cancel(); throw new Error(`${name} ${r.status}`); }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function rest(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<unknown> {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("no creds");
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init, signal,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) { await r.body?.cancel(); throw new Error(`${path} ${r.status}`); }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const first = (v: unknown): Record<string, unknown> => {
  const x = Array.isArray(v) ? v[0] : v;
  return x && typeof x === "object" ? x as Record<string, unknown> : {};
};

let modeCache: { v: string; t: number } | null = null; // 30 s cache so the payment path rarely waits on it
export async function riskEngineMode(signal?: AbortSignal): Promise<string> {
  if (modeCache && Date.now() - modeCache.t < 30000) return modeCache.v;
  try {
    const rows = await rest("checkout_guard_controls?key=eq.riskengine&select=value", signal ?? AbortSignal.timeout(400));
    const v = String(first(rows).value ?? "off");
    modeCache = { v, t: Date.now() };
    return v;
  } catch {
    return "off";
  }
}

export async function scoreRisk(inp: RiskInput, knownMode?: string): Promise<RiskResult> {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), BUDGET_MS);
  try {
    const mode = knownMode ?? (await riskEngineMode(ac.signal));
    if (mode === "off") return { action: "allow", mode: "off" };
    const phone = s(inp.phone), email = s(inp.email), ip = s(inp.ip);
    const device = s(inp.cp_dev?.dev_fp), did = s(inp.cp_dev?.dev_id);
    const card = inp.card_bin6 && inp.card_last4 && /^\d{6}$/.test(inp.card_bin6) && /^\d{4}$/.test(inp.card_last4) ? `${inp.card_bin6}:${inp.card_last4}` : null;
    const method = s(inp.payment_method);
    const amount = Number.isFinite(Number(inp.amount)) ? Number(inp.amount) : null;

    const [feat, ipe, bl, mf, rules] = await Promise.all([
      rpc("risk_score_features", { _phone: phone, _email: email, _ip: ip, _device: device ?? did, _amount: amount, _method: method }, ac.signal),
      ip ? rpc("ip_enrich", { _ip: ip }, ac.signal).catch(() => null) : Promise.resolve(null),
      rpc("checkout_blocklist_check", { _phone: phone, _email: email, _card_h: null, _visitor: s(inp.visitorId), _session: s(inp.checkout_session_id) }, ac.signal).catch(() => null),
      rpc("checkout_blocklist_check_mf", { _devices: [device, did].filter(Boolean), _card: card, _card_exp: s(inp.card_exp), _address: s(inp.addr_norm) }, ac.signal).catch(() => null),
      rest("risk_rules?select=key,weight,cap", ac.signal),
    ]);

    const f = (feat && typeof feat === "object" ? feat : {}) as Record<string, number>;
    const ipr = first(ipe);
    if (ipr.cgnat !== true) {
      // IP adds points only (never a block on its own); carrier CGNAT never scores.
      if (ipr.datacenter === true) f.ip_datacenter = 1;
      if (s(ipr.country) && String(ipr.country).toUpperCase() !== "US") f.ip_foreign = 1;
    }
    const w = new Map<string, { weight: number; cap: number | null }>();
    for (const r of (Array.isArray(rules) ? rules : []) as Array<Record<string, unknown>>) {
      w.set(String(r.key), { weight: Number(r.weight), cap: r.cap === null || r.cap === undefined ? null : Number(r.cap) });
    }
    let score = 0;
    const reasons: string[] = [];
    for (const [k, raw] of Object.entries(f)) {
      const rule = w.get(k);
      const v = Number(raw);
      if (!rule || !Number.isFinite(v) || v === 0 || k.startsWith("band_")) continue;
      const pts = rule.weight * (rule.cap !== null ? Math.min(v, rule.cap) : v);
      score += pts;
      reasons.push(`${k}:${Math.round(pts * 10) / 10}`);
    }
    const blHit = first(bl), mfHit = first(mf);
    const linked = blHit.blocked === true ? { kind: "blocklist", key_type: blHit.key_type, reason: blHit.reason }
      : mfHit.blocked === true ? { kind: "mf", key_type: mfHit.key_type, reason: mfHit.reason } : null;
    const band = (k: string, d: number) => w.get(k)?.weight ?? d;
    let action: RiskResult["action"] = "allow";
    if (linked) { action = "block"; reasons.push(`blocklist:${linked.key_type}`); }
    else if (score >= band("band_block", 60)) action = "block";
    else if (score >= band("band_hold", 40)) action = "hold";
    else if (score >= band("band_stepup", 25)) action = "step_up";
    score = Math.round(score * 10) / 10;

    const pd = (phone || "").replace(/\D/g, "");
    await rest("risk_decisions", ac.signal, {
      method: "POST", headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        checkout_session_id: s(inp.checkout_session_id), phone_last4: pd.length >= 4 ? pd.slice(-4) : null, payment_method: method,
        amount, score, action, mode, reasons, linked_block: linked,
        ip_asn: typeof ipr.asn === "number" ? ipr.asn : null, ip_country: s(ipr.country), ip_datacenter: ipr.datacenter === true,
        latency_ms: Date.now() - t0,
      }),
    }).catch(() => {});
    return { score, action, reasons, mode };
  } catch {
    return { action: "allow", error: true };
  } finally {
    clearTimeout(timer);
  }
}
