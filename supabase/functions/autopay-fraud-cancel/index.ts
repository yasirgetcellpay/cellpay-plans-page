// APGATE-1124 v2 worker (CellPay US only): sends the EXISTING CellPay Auto Pay cancel (POST autopay/unsubscribe { phone })
// once per queued phone. Called by pg_cron 'apgate-worker' only when apgate = 'on' and rows are pending.
// Auth: x-cron-token (same Vault token as autopay-notice). Fraud QA conditions: PER_RUN 10 + daily cap 30 (enforced in apgate_claim),
// C4 429/throttle -> row back to 'pending' + stop the run + alarm, C6 re-check apgate_mode() before EVERY send,
// 401/403 -> record failed + alarm + stop. Timeout/network/5xx = outcome unknown -> 'failed', never resent.
// Logs counts only: no phone, email, card, token or upstream body is logged.
import { cronAuthorized, rpc, json } from "../_shared/retentionEmail.ts";

const APGATE_CODE_ENABLED = true; // hard stop in code (needs a save); the DB flag is the normal kill switch
const API_BASE = "https://api.cellpay.us/api";
const ENDPOINT = "autopay/unsubscribe";
const PER_RUN = 10;
const SPACING_MS = 1500;
const UPSTREAM_TIMEOUT_MS = 8000;
const NOT_ENROLLED_RE =
  /\b(?:not|isn'?t|is not|no longer)\s+(?:enrolled|subscribed|registered|signed up)\b|\bno\s+(?:active\s+)?(?:auto\s*-?\s*pay|autopay|subscription|recurring)\b|\b(?:auto\s*-?\s*pay|autopay|subscription)\s+(?:not\s+found|does\s*n[o']?t\s+exist|not\s+(?:active|enabled|set\s*up))\b|\bnot\s+an?\s+(?:auto\s*-?\s*pay|autopay)\s+(?:customer|user|number)\b|\balready\s+(?:unsubscribed|cancell?ed)\b/i;
const TRANSIENT_RE = /\b(?:try\s+again|temporar\w*|time[sd]?\s*out|unavailable|server|internal|exception|database|network|later)\b/i;
const THROTTLE_RE = /\b(?:too\s+many\s+requests|rate[\s-]?limit\w*|throttl\w*|slow\s+down|quota)\b/i;

type Row = { id: number; phone_norm: string; cellpay_domain: string };
type Out =
  | { status: "sent_ok" | "not_enrolled" | "failed"; kind: string; http: number | null; reason: string | null; stop?: "auth" }
  | { status: "throttled"; kind: string; http: number | null; reason: null };

async function cancelOne(r: Row, apiKey: string, apiSecret: string): Promise<Out> {
  try {
    const res = await fetch(`${API_BASE}/${ENDPOINT}`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "X-Api-Secret": apiSecret, "X-Cellpay-Domain": r.cellpay_domain, "Content-Type": "application/json", "Accept": "*/*" },
      body: JSON.stringify({ phone: r.phone_norm }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const raw = await res.text();
    if (res.status === 429) return { status: "throttled", kind: "http_429", http: 429, reason: null };
    if (res.status === 401 || res.status === 403) return { status: "failed", kind: `http_${res.status}`, http: res.status, reason: null, stop: "auth" };
    let d: Record<string, unknown> | null = null;
    try { const p = JSON.parse(raw); d = p && typeof p === "object" && !Array.isArray(p) ? p : null; } catch { d = null; }
    if (res.status >= 500) return { status: "failed", kind: "http_5xx", http: res.status, reason: null };
    if (!d) return THROTTLE_RE.test(raw.slice(0, 300)) ? { status: "throttled", kind: "throttle_body", http: res.status, reason: null }
                                                       : { status: "failed", kind: "non_json", http: res.status, reason: null };
    const inner = (d.data && typeof d.data === "object" ? d.data : d) as Record<string, unknown>;
    const st = inner.status;
    const ok = res.ok && (st === true || st === "true" || String(st || "").toLowerCase() === "success");
    if (ok) return { status: "sent_ok", kind: "ok", http: res.status, reason: null };
    const why = String(inner.msg ?? inner.message ?? d.msg ?? d.message ?? d.error ?? "").slice(0, 200);
    if (THROTTLE_RE.test(why)) return { status: "throttled", kind: "throttle_body", http: res.status, reason: null };
    if (res.status === 200 && st === false && NOT_ENROLLED_RE.test(why) && !TRANSIENT_RE.test(why))
      return { status: "not_enrolled", kind: "not_enrolled", http: res.status, reason: why };
    return { status: "failed", kind: "error_body", http: res.status, reason: why };
  } catch (e) {
    return { status: "failed", kind: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", http: null, reason: null };
  }
}

async function safeRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  try { return await rpc(name, args); } catch { console.error(`[apgate] ${name}_error`); return null; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await cronAuthorized(req))) return json({ error: "unauthorized" }, 401);
  if (!APGATE_CODE_ENABLED) return json({ ok: true, skipped: "code_disabled" });
  const apiKey = Deno.env.get("CELLPAY_API_KEY") || "";
  const apiSecret = Deno.env.get("CELLPAY_API_SECRET") || "";
  if (!apiKey || !apiSecret) return json({ ok: false, skipped: "cellpay_creds_missing" });
  let rows: Row[] = [];
  try { rows = (await rpc<Row[]>("apgate_claim", { _limit: PER_RUN })) || []; }
  catch { console.error("[apgate] claim_error"); return json({ ok: false, skipped: "claim_error" }); }
  const tally: Record<string, number> = {};
  let stop: string | null = null;
  let i = 0;
  for (; i < rows.length; i++) {
    // C6: re-check the switch before every send; anything not 'on' (or unreadable) stops the run.
    const mode = await safeRpc("apgate_mode", {});
    if (mode !== "on") { stop = "mode_" + String(mode ?? "unreadable"); break; }
    const out = await cancelOne(rows[i], apiKey, apiSecret);
    tally[out.kind] = (tally[out.kind] || 0) + 1;
    if (out.status === "throttled") {
      // C4: not sent -> back to pending (retried next run), stop now, alarm.
      await safeRpc("apgate_requeue", { _ids: [rows[i].id], _kind: out.kind });
      await safeRpc("apgate_alarm", { _kind: "upstream_429", _detail: { kind: out.kind, http: out.http } });
      stop = "throttled"; i++; break;
    }
    await safeRpc("apgate_record", { _id: rows[i].id, _status: out.status, _kind: out.kind, _http: out.http, _reason: out.reason });
    if (out.status === "failed" && out.stop === "auth") {
      await safeRpc("apgate_alarm", { _kind: "upstream_auth", _detail: { http: out.http } });
      stop = "auth"; i++; break;
    }
    if (i < rows.length - 1) await new Promise((r) => setTimeout(r, SPACING_MS));
  }
  const rest = rows.slice(i).map((r) => r.id); // claimed but never sent -> pending again
  if (rest.length) await safeRpc("apgate_requeue", { _ids: rest, _kind: "requeued_" + (stop ?? "stop") });
  console.log(`[apgate] run claimed=${rows.length} stop=${stop ?? "none"} requeued=${rest.length} ${JSON.stringify(tally)}`);
  return json({ ok: true, claimed: rows.length, stop, requeued: rest.length, tally });
});
