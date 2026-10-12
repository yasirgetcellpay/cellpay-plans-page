// CHECKOUT-FUNNEL: invisible carrier-tagged checkout funnel events. Always 204, never errors to the client.
// Accepts JSON or text/plain (sendBeacon), one object or an array of up to 10. Only whitelisted fields are stored.
const ALLOWED = new Set(["https://refill.cellpay.us", "https://www.cellpay.us"]);
const EVENTS = new Set(["checkout_view", "total_shown", "payment_started", "submitted", "left_at_total"]);

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

// In-memory limits (per isolate): IP 60/min, session 40 per 10 min.
const ipHits = new Map<string, { t: number; n: number }>();
const sidHits = new Map<string, { t: number; n: number }>();
function allow(map: Map<string, { t: number; n: number }>, k: string, max: number, win: number): boolean {
  const now = Date.now();
  if (map.size > 20000) map.clear();
  const e = map.get(k);
  if (!e || now - e.t > win) { map.set(k, { t: now, n: 1 }); return true; }
  if (e.n >= max) return false;
  e.n++;
  return true;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : null;
};

function clean(o: unknown, host: string | null): Record<string, unknown> | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const event = typeof r.event === "string" ? r.event : "";
  if (!EVENTS.has(event)) return null;
  const carrier = typeof r.carrier === "string" && r.carrier.length <= 40 ? r.carrier : null;
  const sid = typeof r.session_id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(r.session_id) ? r.session_id : null;
  const lang = typeof r.lang === "string" && r.lang.length <= 8 ? r.lang : null;
  let client_ts: string | null = null;
  if (typeof r.client_ts === "string" && r.client_ts.length <= 40) {
    const d = new Date(r.client_ts);
    if (!isNaN(d.getTime())) client_ts = d.toISOString();
  }
  return { event, carrier, amount: num(r.amount), fee: num(r.fee), total: num(r.total), session_id: sid, lang, host, client_ts };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  const done = new Response(null, { status: 204, headers: h });
  try {
    if (req.method !== "POST") return done;
    const text = await req.text();
    if (text.length > 8000) return done;
    let body: unknown;
    try { body = JSON.parse(text); } catch { return done; }
    const list = (Array.isArray(body) ? body : [body]).slice(0, 10);
    const ip = (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim();
    let host: string | null = null;
    try { host = origin ? new URL(origin).host.slice(0, 80) : null; } catch { host = null; }
    const rows: Record<string, unknown>[] = [];
    for (const item of list) {
      const row = clean(item, host);
      if (!row) continue;
      if (!allow(ipHits, ip, 60, 60_000)) break;
      if (row.session_id && !allow(sidHits, String(row.session_id), 40, 600_000)) continue;
      rows.push(row);
    }
    if (rows.length === 0) return done;
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return done;
    const write = fetch(`${url}/rest/v1/checkout_funnel_events`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(3000),
    }).then((r) => r.body?.cancel()).catch(() => {});
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(write); else await write;
  } catch { /* never error to client */ }
  return done;
});
