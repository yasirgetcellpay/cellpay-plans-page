// FRAUD-MULTIBLOCK-1012 5b: pre-payment risk score (shared by the risk-score function and cellpay-proxy).
// Service role only. Whole budget 700 ms; any error -> { action: "allow", error: true }. Never reads or stores a full card number:
// card / address keys come in already reduced (BIN6:last4, normalized address). Stores phone last 4 only.
// RISK-COVER-IP-1019: budget 700 ms in enforce, 2500 ms otherwise (shadow runs in the background, never on the customer's path).
// The decision row is ALWAYS written (own 1500 ms timeout), also on timeout/error (action allow, timed_out / err set).
// RISK-RULES-1020: features from risk_score_features_v2 (round_dollar dropped; card type via bin_info, card reuse, Fraud & QA ADD flags).
// 'hold' is no longer returned: 40-59 = step_up + 'review' tag. risk_rules.shadow_only rules are logged (shadow_score / shadow_action /
// shadow_reasons) but never change score or action. Card data stays BIN6:last4 in, BIN6 only in the log row.

export type RiskInput = {
  phone?: string | null; email?: string | null; amount?: number | null; carrier_slug?: string | null; payment_method?: string | null;
  checkout_session_id?: string | null; cp_dev?: { dev_fp?: string; dev_id?: string } | null; visitorId?: string | null;
  card_bin6?: string | null; card_last4?: string | null; card_exp?: string | null; addr_norm?: string | null; ip?: string | null;
  ip_src?: string | null; ip_country_hdr?: string | null;
  total?: number | null; // RISK-RULES-1020: charged total (amount + fees) when known
};
// RISK-RULES-1020: "hold" stays in the type only so existing callers still compile; scoreRisk never returns it.
export type RiskResult = { score?: number; action: "allow" | "step_up" | "hold" | "block"; reasons?: string[]; mode?: string; error?: boolean };
const RULES_VER = "d2-1020";
const SHADOW_STEPUP_FLAGS = ["fqa_metro_newcard_ge55", "fqa_newcard_ge150"]; // Fraud & QA ADD 1+2: shadow step-up flags

const BUDGET_ENFORCE_MS = 700;
const BUDGET_SHADOW_MS = 2500;
const LOG_TIMEOUT_MS = 3000;
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

let modeCache: { v: string; t: number } | null = null; // 60 s per-isolate cache so the payment path rarely waits on it
export async function riskEngineMode(signal?: AbortSignal): Promise<string> {
  if (modeCache && Date.now() - modeCache.t < 60000) return modeCache.v;
  try {
    // RISK-COVER-IP-1019b: callers on the customer's path pass their own short signal (unchanged); background callers get 1500 ms.
    const rows = await rest("checkout_guard_controls?key=eq.riskengine&select=value", signal ?? AbortSignal.timeout(1500));
    const v = String(first(rows).value ?? "off");
    modeCache = { v, t: Date.now() };
    return v;
  } catch (e) {
    // On a failed read keep the last known mode unless it was enforce (enforce still fails open to off).
    if (modeCache && modeCache.v !== "enforce") return modeCache.v;
    if (!signal) {
      // Background caller with no known mode: leave one diagnostic row so lost decisions can be counted.
      await logDecision({ mode: "unknown", action: "allow", reasons: ["error:mode_read"], timed_out: true, err: String((e as Error)?.message ?? e).slice(0, 120) });
    }
    return "off";
  }
}

function logDecision(row: Record<string, unknown>): Promise<void> {
  return rest("risk_decisions", AbortSignal.timeout(LOG_TIMEOUT_MS), {
    method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(row),
  }).then(() => {}).catch(() => {});
}

export async function scoreRisk(inp: RiskInput, knownMode?: string): Promise<RiskResult> {
  const t0 = Date.now();
  const mode = knownMode ?? (await riskEngineMode(AbortSignal.timeout(300)));
  if (mode === "off") return { action: "allow", mode: "off" };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), mode === "enforce" ? BUDGET_ENFORCE_MS : BUDGET_SHADOW_MS);
  const pd = (s(inp.phone) || "").replace(/\D/g, "");
  const hdrCountry = s(inp.ip_country_hdr) && /^[A-Za-z]{2}$/.test(String(inp.ip_country_hdr).trim()) ? String(inp.ip_country_hdr).trim().toUpperCase() : null;
  const baseRow = {
    checkout_session_id: s(inp.checkout_session_id), phone_last4: pd.length >= 4 ? pd.slice(-4) : null, payment_method: s(inp.payment_method),
    amount: Number.isFinite(Number(inp.amount)) ? Number(inp.amount) : null, mode, ip_src: s(inp.ip_src), ip_country_hdr: hdrCountry,
    total: Number.isFinite(Number(inp.total)) && Number(inp.total) > 0 ? Number(inp.total) : null, rules_ver: RULES_VER,
  };
  try {
    const phone = s(inp.phone), email = s(inp.email), ip = s(inp.ip);
    const device = s(inp.cp_dev?.dev_fp), did = s(inp.cp_dev?.dev_id);
    const card = inp.card_bin6 && inp.card_last4 && /^\d{6}$/.test(inp.card_bin6) && /^\d{4}$/.test(inp.card_last4) ? `${inp.card_bin6}:${inp.card_last4}` : null;
    const method = s(inp.payment_method);
    const amount = Number.isFinite(Number(inp.amount)) ? Number(inp.amount) : null;

    const [feat, ipe, bl, mf, rules] = await Promise.all([
      rpc("risk_score_features_v2", { _phone: phone, _email: email, _ip: ip, _device: device ?? did, _amount: amount, _method: method,
        _card: card, _carrier: s(inp.carrier_slug), _total: baseRow.total }, ac.signal),
      ip ? rpc("ip_enrich", { _ip: ip }, ac.signal).catch(() => null) : Promise.resolve(null),
      rpc("checkout_blocklist_check", { _phone: phone, _email: email, _card_h: null, _visitor: s(inp.visitorId), _session: s(inp.checkout_session_id) }, ac.signal).catch(() => null),
      rpc("checkout_blocklist_check_mf", { _devices: [device, did].filter(Boolean), _card: card, _card_exp: s(inp.card_exp), _address: s(inp.addr_norm) }, ac.signal).catch(() => null),
      rest("risk_rules?select=key,weight,cap,shadow_only", ac.signal),
    ]);

    const f = (feat && typeof feat === "object" ? feat : {}) as Record<string, number>;
    const cardInfo = first((f as Record<string, unknown>)._card); // RISK-RULES-1020: BIN6 facts (no last4), logged only
    delete (f as Record<string, unknown>)._card;
    const ipr = first(ipe);
    const ipCountry = s(ipr.country) ? String(ipr.country).toUpperCase() : hdrCountry; // DB range first, Cloudflare header as fallback
    if (ipr.cgnat !== true) {
      // IP adds points only (never a block on its own); carrier CGNAT never scores.
      if (ipr.datacenter === true) f.ip_datacenter = 1;
      if (ipCountry && ipCountry !== "US") f.ip_foreign = 1;
    }
    const binCountry = s(cardInfo.country) ? String(cardInfo.country).toUpperCase() : null;
    if (binCountry && ipCountry && ipr.cgnat !== true && binCountry !== ipCountry) f.card_country_ne_ip_country = 1; // RISK-RULES-1020
    const w = new Map<string, { weight: number; cap: number | null; shadow: boolean }>();
    for (const r of (Array.isArray(rules) ? rules : []) as Array<Record<string, unknown>>) {
      w.set(String(r.key), { weight: Number(r.weight), cap: r.cap === null || r.cap === undefined ? null : Number(r.cap), shadow: r.shadow_only === true });
    }
    let score = 0, shadowPts = 0;
    const reasons: string[] = [], shadowReasons: string[] = [];
    for (const [k, raw] of Object.entries(f)) {
      const rule = w.get(k);
      const v = Number(raw);
      if (!rule || !Number.isFinite(v) || v === 0 || k.startsWith("band_") || k.startsWith("_")) continue;
      const pts = rule.weight * (rule.cap !== null ? Math.min(v, rule.cap) : v);
      if (rule.shadow) { shadowPts += pts; shadowReasons.push(`${k}:${Math.round(pts * 10) / 10}`); continue; } // RISK-RULES-1020: log only
      if (pts === 0) continue;
      score += pts;
      reasons.push(`${k}:${Math.round(pts * 10) / 10}`);
    }
    const blHit = first(bl), mfHit = first(mf);
    const linked = blHit.blocked === true ? { kind: "blocklist", key_type: blHit.key_type, reason: blHit.reason }
      : mfHit.blocked === true ? { kind: "mf", key_type: mfHit.key_type, reason: mfHit.reason } : null;
    const band = (k: string, d: number) => w.get(k)?.weight ?? d;
    const bandBlock = band("band_block", 60), bandStep = band("band_stepup", 25);
    // RISK-RULES-1020: no hold. 40-59 = step_up + 'review' tag (after-the-fact review in the daily report).
    const decide = (sc: number): RiskResult["action"] => (sc >= bandBlock ? "block" : sc >= bandStep ? "step_up" : "allow");
    let action: RiskResult["action"] = "allow";
    if (linked) { action = "block"; reasons.push(`blocklist:${linked.key_type}`); }
    else {
      action = decide(score);
      if (action === "step_up" && score >= 40) reasons.push("review");
    }
    // Shadow-only view: what the new rules would do (never returned, never enforced).
    let shadowAction: RiskResult["action"] = linked ? "block" : decide(score + shadowPts);
    if (shadowAction === "allow" && !(Number(f.prior_paid) > 0) && SHADOW_STEPUP_FLAGS.some((k) => Number(f[k]) > 0)) shadowAction = "step_up"; // PRIOR-PAID-STEPUP-EXEMPT-1029
    score = Math.round(score * 10) / 10;

    clearTimeout(timer);
    await logDecision({
      ...baseRow, score, action, reasons, linked_block: linked,
      shadow_score: Math.round((score + shadowPts) * 10) / 10, shadow_action: shadowAction, shadow_reasons: shadowReasons,
      card_info: Object.keys(cardInfo).length ? cardInfo : null,
      ip_asn: typeof ipr.asn === "number" ? ipr.asn : null, ip_country: ipCountry, ip_datacenter: ipr.datacenter === true,
      latency_ms: Date.now() - t0, timed_out: false,
    });
    return { score, action, reasons, mode };
  } catch (e) {
    clearTimeout(timer);
    const timedOut = ac.signal.aborted;
    await logDecision({
      ...baseRow, score: null, action: "allow", reasons: [timedOut ? "error:timeout" : "error"], ip_country: hdrCountry,
      latency_ms: Date.now() - t0, timed_out: timedOut, err: String((e as Error)?.message ?? e).slice(0, 120),
    });
    return { action: "allow", error: true };
  } finally {
    clearTimeout(timer);
  }
}
