// failpay-email (FAILPAY-EMAIL-1008): LIVE sender for the failed-payment follow-up email. STAGED, NOT DEPLOYED.
// The DB job failpay_email_run() (pg_cron */5) screens each failure ~20 min later and writes failpay_email_log rows:
// shadow -> 'would_send' (this function never touches them); live -> 'queued'. This function claims 'queued' rows
// (queued -> sending), re-runs the FULL screen at send time (failpay_send_check: failpay_screen(attempt, now()) + 7-day cap +
// 3 h max age), re-checks "paid since" and suppression, builds the EN/ES email and sends it through the
// Sender interface (Cloudflare Email Sending today). One email per attempt (unique row per attempt + claim). Never auto-retries
// an ambiguous provider result. Auth: x-cron-token (same Vault token as retention; cron also sends the anon bearer like send-reminders). Logs counts only.
// HARD GATES: FAILPAY_SEND_ENABLED below must be true (code) AND failpay_email_controls.mode = 'live' (DB) AND CF token secret.
// v3 (Fraud & QA 10:21 CT Oct 8): F1 full re-screen at send time; F2 skip rows whose attempt is > 3 h old; F7 daily cap on the
// America/Chicago day; no phone digits in the body. {"action":"health"} (cron token) reports only booleans/status codes.
import { cronAuthorized, rpc, rest, json, hmacKey, signLink, senderSettings, sha256Hex } from "../_shared/retentionEmail.ts";
import { failpayEmail } from "../_shared/failpayEmail.js";

export const FAILPAY_SEND_ENABLED = false;            // go-live = separate reviewed change (Fraud & QA sign-off + Parvez OK)
const FROM_LOCAL = "orders";                           // orders@notify.cellpay.us
const CF_ACCOUNT_DEFAULT = "7daef2eefd2b54148d4b8ef26b57d5a7";
const env = (k: string) => Deno.env.get(k) || "";

// ---- Sender interface: any provider plugs in here ----
type SendResult = { kind: "sent"; ref: string } | { kind: "suppressed" | "deferred" | "rejected" | "unknown"; code: string };
interface Sender { name: string; send(m: { from: { address: string; name: string }; to: string; replyTo: string; subject: string; html: string; text: string; headers: Record<string, string> }): Promise<SendResult> }

const cloudflareSender: Sender = {
  name: "cloudflare",
  async send(m) {
    const token = env("CF_EMAIL_API_TOKEN"); if (!token) return { kind: "rejected", code: "cf_token_missing" };
    const ref = crypto.randomUUID(); const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env("CF_ACCOUNT_ID") || CF_ACCOUNT_DEFAULT)}/email/sending/send`, {
        method: "POST", signal: ctrl.signal, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ from: m.from, to: m.to, reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text, headers: { ...m.headers, "X-CP-Ref": ref } }),
      });
      let j: any = null; try { j = await r.json(); } catch { j = null; }
      const err = j?.errors?.[0]; const code = err ? String(err.code ?? "") : `http_${r.status}`;
      if (r.ok && j?.success && j.result) {
        const lc = m.to.trim().toLowerCase(); const has = (xs?: string[]) => (xs || []).some((x) => String(x).trim().toLowerCase() === lc);
        if (has(j.result.permanent_bounces)) return { kind: "suppressed", code: "permanent_bounce" };
        if (has(j.result.delivered) || has(j.result.queued)) return { kind: "sent", ref };
        return { kind: "unknown", code: "2xx_recipient_missing" };
      }
      if (r.status === 429) return { kind: "deferred", code };
      if (r.status >= 500) return { kind: "unknown", code };
      if (/suppress|bounce/i.test(String(err?.message || ""))) return { kind: "suppressed", code };
      return { kind: "rejected", code };
    } catch (e) { return { kind: "unknown", code: (e as Error)?.name === "AbortError" ? "timeout" : "network" }; }
    finally { clearTimeout(timer); }
  },
};
const SENDERS: Record<string, Sender> = { cloudflare: cloudflareSender };   // add another provider here if ever needed

const MAX_AGE_MS = 3 * 60 * 60 * 1000;                 // F2: never send for an attempt older than 3 h
/** F7: start of the current America/Chicago day as an ISO instant. */
function ctDayStartISO(now = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = Math.round((wall - now.getTime()) / 60000) * 60000;          // CT minus UTC (e.g. -5 h)
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - offset).toISOString();
}

/** Health: booleans + Cloudflare HTTP status only. Never returns or logs the token. Read-only Cloudflare calls. */
async function health() {
  const token = env("CF_EMAIL_API_TOKEN");
  const out: Record<string, unknown> = { fn: "failpay-email", send_enabled: FAILPAY_SEND_ENABLED, cf_token_present: !!token,
    token_len_ok: !!token && token.length >= 40 && token.length <= 200 && !/\s/.test(token), cf_account_env: !!env("CF_ACCOUNT_ID") };
  if (token) {
    const acct = encodeURIComponent(env("CF_ACCOUNT_ID") || CF_ACCOUNT_DEFAULT);
    const probe = async (url: string) => {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(url, { method: "GET", signal: ctrl.signal, headers: { authorization: `Bearer ${token}` } });
        let j: any = null; try { j = await r.json(); } catch { j = null; }
        return { http: r.status, success: j?.success === true, err: j?.errors?.[0]?.code ?? null, status: typeof j?.result?.status === "string" ? j.result.status : undefined };
      } catch (e) { return { http: 0, success: false, err: (e as Error)?.name === "AbortError" ? "timeout" : "network" }; }
      finally { clearTimeout(timer); }
    };
    out.cf_token_verify_account = await probe(`https://api.cloudflare.com/client/v4/accounts/${acct}/tokens/verify`);
    out.cf_token_verify_user = await probe("https://api.cloudflare.com/client/v4/user/tokens/verify");
    out.cf_sending_limits = await probe(`https://api.cloudflare.com/client/v4/accounts/${acct}/email/sending/limits`);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await cronAuthorized(req))) return json({ error: "forbidden" }, 403);
  let body: any = null; try { body = await req.json(); } catch { body = null; }
  if (body?.action === "health") { const h = await health(); console.log(JSON.stringify({ fn: "failpay-email", health: { present: h.cf_token_present, len_ok: h.token_len_ok } })); return json(h); }
  const ctl = Object.fromEntries((await rest<Array<{ key: string; value: string }>>("failpay_email_controls?select=key,value")).map((r) => [r.key, r.value]));
  if (ctl.mode !== "live") return json({ ok: true, mode: ctl.mode, sent: 0 });
  if (!FAILPAY_SEND_ENABLED) return json({ ok: true, mode: ctl.mode, blocked: "send_disabled_in_code" });
  const sender = SENDERS[ctl.provider || "cloudflare"]; if (!sender) return json({ ok: false, error: "no_sender" }, 500);
  const s = await senderSettings();
  const fromAddress = `${FROM_LOCAL}@notify.cellpay.us`; const fromName = s.fromName && !s.fromName.includes("__SET_ME__") ? s.fromName : "CellPay";
  const cap = Number(ctl.daily_cap || 0); const dayStart = ctDayStartISO();     // F7: CT day, not UTC
  let sentToday = (await rest<Array<{ id: string }>>(`failpay_email_log?select=id&run_kind=eq.cron&decision=eq.sent&sent_at=gte.${encodeURIComponent(dayStart)}`)).length;
  const queued = await rest<Array<{ id: string }>>("failpay_email_log?select=id&run_kind=eq.cron&decision=eq.queued&order=asof.asc&limit=50");
  const key = await hmacKey(); const summary: Record<string, number> = {};
  const bump = (k: string) => { summary[k] = (summary[k] || 0) + 1; };
  for (const { id } of queued) {
    const claimed = await rest<Array<any>>(`failpay_email_log?id=eq.${id}&decision=eq.queued&select=*`, { method: "PATCH", body: JSON.stringify({ decision: "sending" }) });
    if (!claimed.length) continue; const g = claimed[0];
    const skip = async (why: string) => { await rest(`failpay_email_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ decision: "skipped", error: why }) }); bump(`skip:${why}`); };
    if (sentToday >= cap) { await skip("daily_cap"); continue; }
    if (!g.attempt_at || Date.now() - Date.parse(g.attempt_at) > MAX_AGE_MS) { await skip("F2_stale_attempt"); continue; }   // F2
    let recheck: string[] | null = null;                                                                              // F1
    try { recheck = await rpc<string[]>("failpay_send_check", { _log_id: id }); } catch { recheck = null; }
    if (!Array.isArray(recheck)) { await skip("F1_recheck_error"); continue; }                                          // fail closed
    if (recheck.length) { await skip(`F1_screen:${recheck.slice(0, 4).join(",")}`); continue; }
    const [t] = await rest<Array<{ phone_number: string; email: string; created_at: string }>>(`transaction_logs?id=eq.${g.attempt_log_id}&select=phone_number,email,created_at`);
    if (!t?.email) { await skip("no_email"); continue; }
    const paid = await rest<Array<{ id: string }>>(`transaction_logs?select=id&phone_number=eq.${encodeURIComponent(t.phone_number)}&status=eq.success&created_at=gt.${encodeURIComponent(t.created_at)}&limit=1`);
    if (paid.length) { await skip("paid_since_at_send"); continue; }
    const eh = await sha256Hex(t.email.trim().toLowerCase());
    if ((await rest<Array<{ email_sha256: string }>>(`email_suppression?select=email_sha256&email_sha256=eq.${eh}`)).length) { await skip("suppressed"); continue; }
    const unsubTok = await signLink(key, "u", g.unsub_token);
    const pre = g.lang === "es" ? "/es" : "";
    const unsubUrl = `https://${g.host}${pre}/unsubscribe?t=${encodeURIComponent(unsubTok)}`;
    const oneClick = `${env("SUPABASE_URL")}/functions/v1/email-links?a=unsub&t=${encodeURIComponent(unsubTok)}`;
    const m = failpayEmail({ lang: g.lang, carrierSlug: g.carrier_slug, amount: g.amount, method: g.payment_method,
      refunded: g.decline_class === "refill_failed_refunded", refillUrl: g.refill_url, unsubUrl, postal: s.postal });
    const res = await sender.send({ from: { address: fromAddress, name: fromName }, to: t.email.trim(), replyTo: s.replyTo || "support@getcellpay.com", ...m,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "X-CP-Type": "failpay" } });
    const patch = res.kind === "sent" ? { decision: "sent", sent_at: new Date().toISOString(), provider: sender.name, provider_ref: res.ref }
      : res.kind === "suppressed" ? { decision: "skipped", error: `provider_suppressed:${res.code}` }
      : res.kind === "deferred" ? { decision: "queued", error: res.code }
      : res.kind === "rejected" ? { decision: "failed", error: res.code }
      : { decision: "failed_unknown", error: res.code };
    await rest(`failpay_email_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (res.kind === "suppressed") await rest("email_suppression?on_conflict=email_sha256", { method: "POST", headers: { prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ email_sha256: eh, reason: "bounce", source: "failpay:cloudflare" }) });
    if (res.kind === "sent") sentToday++;
    bump(`send:${res.kind}`);
  }
  console.log(JSON.stringify({ fn: "failpay-email", summary }));
  return json({ ok: true, summary });
});
