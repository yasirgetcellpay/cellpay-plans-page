// supabase/functions/cashapp-settlement-sweep/index.ts  (Fix B v2s, B-3; Sunday cut Oct 3 ~19:50 CT). PREPARED, NOT SENT.
// v2s: the mode comes from the DB row fraud_controls.cashapp_sweep_mode (off | shadow | enforce), read on every run.
// Missing row, unreadable row or any read error = off (do nothing). No CASHAPP_SWEEP_MODE secret.
// Server-side Cash App (Pockyt) confirmation. Called only by pg_cron every 3 min (b3_cron_job.sql).
// Calls the SAME CellPay endpoint the browser poll uses through cellpay-proxy:
//   GET https://api.cellpay.us/api/payments/pockyt/session/{session_id}/status
//   headers X-Api-Key / X-Api-Secret (existing project secrets) + X-Cellpay-Domain derived server-side from the
//   caller_host stored on the log row at checkout (same rule as the live proxy). No customer token, no browser input.
// Settles a row only on a definitive answer; everything else is re-checked with backoff (3 min < 1 h, then 15 min, to 48 h).
// Never logs session ids, log ids, transaction ids or customer data.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const API_BASE = "https://api.cellpay.us/api";
const SUCCESS = ["success", "completed", "paid", "captured", "approved"];   // identical to cellpay-proxy + CashAppReturn
const FAILURE = ["failed", "declined", "cancelled", "canceled", "expired", "voided", "error"];
const ALLOWED_HOSTS = new Set(["refill.cellpay.us", "www.cellpay.us", "cellpay.us"]);
const PREVIEW_SUFFIXES = ["lovable.dev", "lovable.app", "lovableproject.com", "localhost"];
const SESSION_RE = /^[A-Za-z0-9_.:=+~-]{1,128}$/;
const CALL_TIMEOUT_MS = 8000;
const RUN_BUDGET_MS = 45000;
const CONCURRENCY = 5;

type Verdict = "paid" | "failed" | "pending" | "error" | "auth";
type Claimed = { log_id: string; session_id: string; caller_host: string | null; log_created_at: string; check_count: number };

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}
function text(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Same result as the live proxy's resolveCellpayDomain(callerHost), restricted to the two CellPay storefront hosts. */
export function domainForStoredHost(host: string | null): string | null {
  const h = (host || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  if (!h) return "www.cellpay.us";
  if (PREVIEW_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))) return "www.cellpay.us";
  return ALLOWED_HOSTS.has(h) ? h : null;   // unknown host: don't guess, record an error and retry later
}

/** Same unwrapping and classification as cellpay-proxy's status branch (unwrapTransactionResult) and CashAppReturn. */
export function classify(body: unknown): { verdict: Verdict; upstream: string; txn: string | null; msg: string | null; result: Record<string, unknown> } {
  let result = asRecord(body);
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) result = asRecord(result.data);
  const upstream = String(result.internal_status || result.status || "").toLowerCase();
  const txn = text(result.transaction_id ?? result.transactionId);
  const msg = text(result.message ?? result.msg);
  if (txn && SUCCESS.includes(upstream)) return { verdict: "paid", upstream, txn, msg, result };
  if (FAILURE.includes(upstream)) return { verdict: "failed", upstream, txn, msg, result };
  return { verdict: "pending", upstream, txn, msg, result };
}

async function rpc(name: string, payload: Record<string, unknown>): Promise<unknown> {
  const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

export async function checkOne(row: Claimed, fetchImpl: typeof fetch = fetch): Promise<{ verdict: Verdict; http: number; upstream: string | null; txn: string | null; msg: string | null; raw: Record<string, unknown> | null }> {
  const domain = domainForStoredHost(row.caller_host);
  if (!domain || !SESSION_RE.test(row.session_id)) return { verdict: "error", http: 0, upstream: null, txn: null, msg: !domain ? "unknown caller_host" : "bad session id", raw: null };
  try {
    const res = await fetchImpl(`${API_BASE}/payments/pockyt/session/${encodeURIComponent(row.session_id)}/status`, {
      method: "GET",
      headers: {
        "X-Api-Key": env("CELLPAY_API_KEY"),
        "X-Api-Secret": env("CELLPAY_API_SECRET"),
        "X-Cellpay-Domain": domain,
        "Accept": "*/*",
      },
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    const bodyText = await res.text();
    if (res.status === 401 || res.status === 403) return { verdict: "auth", http: res.status, upstream: null, txn: null, msg: `http ${res.status}`, raw: null };
    if (!res.ok) return { verdict: "error", http: res.status, upstream: null, txn: null, msg: `http ${res.status}`, raw: null };
    let body: unknown;
    try { body = JSON.parse(bodyText); } catch { return { verdict: "error", http: res.status, upstream: null, txn: null, msg: "unreadable body", raw: null }; }
    const c = classify(body);
    return { verdict: c.verdict, http: res.status, upstream: c.upstream, txn: c.txn, msg: c.msg, raw: c.result };
  } catch (e) {
    return { verdict: "error", http: 0, upstream: null, txn: null, msg: e instanceof Error ? e.name : "fetch error", raw: null };
  }
}

export async function runSweep(mode: "shadow" | "enforce", limit: number, rpcImpl = rpc, fetchImpl: typeof fetch = fetch) {
  const started = new Date(), deadline = Date.now() + RUN_BUDGET_MS;
  const counts = { claimed: 0, paid: 0, failed: 0, pending: 0, error: 0, auth: 0, expired: 0 };
  const rows = (await rpcImpl("pockyt_sweep_claim", { _limit: limit, _mode: mode }) ?? []) as Claimed[];
  counts.claimed = rows.length;
  let i = 0;
  const worker = async () => {
    while (i < rows.length && Date.now() < deadline) {
      const row = rows[i++];
      const r = await checkOne(row, fetchImpl);
      try {
        await rpcImpl("pockyt_sweep_record", {
          _log_id: row.log_id, _session_id: row.session_id, _http: r.http, _upstream: r.upstream,
          _txn: r.txn, _msg: r.msg, _raw: r.raw, _verdict: r.verdict,
        });
        counts[r.verdict === "paid" ? "paid" : r.verdict === "failed" ? "failed" : r.verdict === "pending" ? "pending" : r.verdict === "auth" ? "auth" : "error"]++;
      } catch (_e) {
        counts.error++;   // unrecorded rows keep their 5-min lease and are retried next run
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
  if (mode === "enforce") counts.expired = Number(await rpcImpl("pockyt_sweep_expire", {}) ?? 0);
  await rpcImpl("pockyt_sweep_finish_run", {
    _started_at: started.toISOString(), _mode: mode, _claimed: counts.claimed, _paid: counts.paid, _failed: counts.failed,
    _still_pending: counts.pending, _http_errors: counts.error, _auth_errors: counts.auth, _expired: counts.expired,
    _note: Date.now() >= deadline ? "budget reached" : null,
  });
  console.log(`[cashapp-sweep] mode=${mode} claimed=${counts.claimed} paid=${counts.paid} failed=${counts.failed} pending=${counts.pending} errors=${counts.error} auth=${counts.auth} expired=${counts.expired}`);
  return counts;
}

export async function handle(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  try {
    const ok = await rpc("pockyt_sweep_secret_ok", { _s: req.headers.get("x-sweep-secret") ?? "" });
    if (ok !== true) return new Response("forbidden", { status: 403 });
    let modeEnv = "off";   // off | shadow | enforce, from fraud_controls; any failure keeps "off" (fail safe: nothing changes)
    try { modeEnv = String((await rpc("fraud_control_get", { _key: "cashapp_sweep_mode" })) ?? "off").toLowerCase(); } catch { modeEnv = "off"; }
    if (modeEnv !== "shadow" && modeEnv !== "enforce") return new Response(JSON.stringify({ skipped: "off" }), { status: 200 });
    const limit = Math.min(Math.max(Number(Deno.env.get("CASHAPP_SWEEP_LIMIT") || 25) || 25, 1), 100);
    const counts = await runSweep(modeEnv, limit);
    return new Response(JSON.stringify(counts), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cashapp-sweep] run failed:", e instanceof Error ? e.message : "unknown");
    return new Response("error", { status: 500 });
  }
}

serve(handle);
