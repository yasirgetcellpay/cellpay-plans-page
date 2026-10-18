// CHECKOUT-FUNNEL: invisible carrier-tagged checkout funnel events. Always 204, never errors to the client.
// Accepts JSON or text/plain (sendBeacon), one object or an array of up to 10. Only whitelisted fields are stored.
const ALLOWED = new Set(["https://refill.cellpay.us", "https://www.cellpay.us"]);
const EVENTS = new Set(["checkout_view", "total_shown", "payment_started", "submitted", "left_at_total", "prefill_used", "autopay_postpurchase_offer_shown", "autopay_postpurchase_offer_accepted", "recovery_prompt_shown", "recovery_retry", "recovery_success", "maybe_paid_shown", "maybe_paid_lock_shown"]); // DECLINE-RECOVERY-1014: recovery_*; // EMAIL-PREFILL-1013: prefill_used; AUTOPAY-POSTPURCHASE-1013: autopay_postpurchase_* // DBT-FOLLOWUP-1017
const KLARNA_EVENTS = new Set(["klarna_offer_shown", "klarna_clicked", "klarna_session_created", "klarna_auth_result", "klarna_ab_known", "klarna_session_failed", "klarna_form_started"]); // KLARNA-FUNNEL-1017 // KLARNA-FUNNEL-FIX-1017 // KLARNA-LOG-1017 // KLARNA-FORM-1018
for (const event of KLARNA_EVENTS) EVENTS.add(event); // KLARNA-FUNNEL-1017
const RETRY_EVENTS = new Set(["retry_offer_shown", "retry_tapped", "retry_success", "retry_late_alive"]); // REFUND-RETRY-1018 // REFUND-RETRY-LATE-1018
for (const event of RETRY_EVENTS) EVENTS.add(event); // REFUND-RETRY-1018

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
  return { event, carrier, amount: num(r.amount), fee: num(r.fee), total: num(r.total), session_id: sid, lang, host, client_ts,
    ...(RETRY_EVENTS.has(event) ? { // REFUND-RETRY-1018
      retry_cause: typeof r.retry_cause === "string" && /^(tmo_plan_mismatch|simple_not_found|metro_invalid_number|boost_blank)$/.test(r.retry_cause) ? r.retry_cause : null, // REFUND-RETRY-1018
      retry_action: typeof r.retry_action === "string" && /^[a-z0-9_,]{1,80}$/.test(r.retry_action) ? r.retry_action : null, // REFUND-RETRY-1018 // REFUND-RETRY-LATE-1018
      retry_to_carrier: typeof r.retry_to_carrier === "string" && /^[a-z0-9-]{1,30}$/.test(r.retry_to_carrier) ? r.retry_to_carrier : null, // REFUND-RETRY-1018
    } : {}), // REFUND-RETRY-1018
    ...(KLARNA_EVENTS.has(event) ? { // KLARNA-FUNNEL-1017
      screen: r.screen === "decline_nsf" || r.screen === "decline_other" || r.screen === "method_list" ? r.screen : null,
      decline_ab: r.decline_ab === "control" || r.decline_ab === "variant" ? r.decline_ab : null,
      checkout_session_id: typeof r.checkout_session_id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(r.checkout_session_id) ? r.checkout_session_id : null,
      klarna_result: r.klarna_result === "approved" || r.klarna_result === "declined" || r.klarna_result === "cancelled" ? r.klarna_result : null,
      shown: typeof r.shown === "boolean" ? r.shown : null, cap: typeof r.cap === "boolean" ? r.cap : null,
      klarna_categories: typeof r.klarna_categories === "string" && /^[a-z_+]{1,120}$/.test(r.klarna_categories) ? r.klarna_categories : null, // KLARNA-CAT-1017
      klarna_category: typeof r.klarna_category === "string" && /^[a-z_]{1,30}$/.test(r.klarna_category) ? r.klarna_category : null, // KLARNA-CAT-1017
      klarna_show_form: typeof r.klarna_show_form === "boolean" ? r.klarna_show_form : null, // KLARNA-CAT-1017
      klarna_approved: typeof r.klarna_approved === "boolean" ? r.klarna_approved : null, // KLARNA-CAT-1017
      klarna_load: r.klarna_load === "ok" || r.klarna_load === "no_form" || r.klarna_load === "error" || r.klarna_load === "timeout" ? r.klarna_load : null, // KLARNA-CAT-1017
      klarna_reason: r.klarna_reason === "no_token" || r.klarna_reason === "sdk_load_failed" || r.klarna_reason === "sdk_missing" || r.klarna_reason === "network" || r.klarna_reason === "server_error" ? r.klarna_reason : null, // KLARNA-LOG-1017
      klarna_finalize_required: typeof r.klarna_finalize_required === "boolean" ? r.klarna_finalize_required : null, // KLARNA-LOG-1017
      klarna_error: typeof r.klarna_error === "string" && /^[A-Za-z0-9_.,:\[\]+-]{1,200}$/.test(r.klarna_error) ? r.klarna_error : null, // KLARNA-LOG-1017
    } : {}),
  }; // KLARNA-FUNNEL-1017
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
    const klarnaRows: Record<string, unknown>[] = []; // KLARNA-FUNNEL-1017
    const retryRows: Record<string, unknown>[] = []; // REFUND-RETRY-1018
    for (const item of list) {
      const row = clean(item, host);
      if (!row) continue;
      if (!allow(ipHits, ip, 60, 60_000)) break;
      if (row.session_id && !allow(sidHits, String(row.session_id), 40, 600_000)) continue;
      (RETRY_EVENTS.has(String(row.event)) ? retryRows : KLARNA_EVENTS.has(String(row.event)) ? klarnaRows : rows).push(row); // KLARNA-FUNNEL-1017 // REFUND-RETRY-1018
    }
    if (rows.length === 0 && klarnaRows.length === 0 && retryRows.length === 0) return done; // KLARNA-FUNNEL-1017 // REFUND-RETRY-1018
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return done;
    const postRows = (batch: Record<string, unknown>[]) => { // KLARNA-FUNNEL-1017: independent requests, including synchronous failures.
      try { return fetch(`${url}/rest/v1/checkout_funnel_events`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify(batch), // KLARNA-FUNNEL-1017
      signal: AbortSignal.timeout(3000),
    }).then((r) => r.body?.cancel()).catch(() => {}); } catch { return Promise.resolve(); }
    }; // KLARNA-FUNNEL-1017
    const write = rows.length ? postRows(rows) : Promise.resolve(); // KLARNA-FUNNEL-1017
    const klarnaWrite = klarnaRows.length ? postRows(klarnaRows) : Promise.resolve(); // KLARNA-FUNNEL-1017
    const retryWrite = retryRows.length ? postRows(retryRows) : Promise.resolve(); // REFUND-RETRY-1018
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(write); else await write;
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(klarnaWrite); else await klarnaWrite; // KLARNA-FUNNEL-1017
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(retryWrite); else await retryWrite; // REFUND-RETRY-1018
  } catch { /* never error to client */ }
  return done;
});
