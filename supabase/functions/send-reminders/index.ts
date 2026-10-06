// send-reminders (retention-1006): opt-in refill reminders. Called by pg_cron hourly (02_schedules.sql, applied only at go-live).
// SHADOW: retention_reminder_run() writes one email_send_log row per decision (would_send / skipped:<reason>); nothing is sent.
// Touch 1 = day 27 after the line's last site refill; touch 2 = 1st-3rd of the month if still no refill; max 2 per cycle;
// skips Auto Pay, fraud-flagged, suppressed and the 10% holdout (all decided in SQL). Live sending also needs SEND_ENABLED (code),
// reminders_mode='live' (DB), CF_EMAIL_API_TOKEN (secret) and the owner inputs (from_name, postal_address) - see STATUS.md.
// Auth: header x-cron-token (Vault secret, checked by retention_email_cron_auth). verify_jwt = false. Logs counts only.
import { SEND_ENABLED, cronAuthorized, rpc, rest, json, hmacKey, signLink, senderSettings, senderBlock, cfSend, reminderEmail, siteHost, sha256Hex } from "../_shared/retentionEmail.ts";

const FN_BASE = () => `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-links`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await cronAuthorized(req))) return json({ error: "forbidden" }, 403);
  let body: { ignore_window?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }
  const rows = await rpc<Array<{ log_id: string; status: string; skip_reason: string | null }>>("retention_reminder_run", { _ignore_window: body.ignore_window === true });
  const summary: Record<string, number> = {};
  for (const r of rows) { const k = r.skip_reason ? `skipped:${r.skip_reason}` : r.status; summary[k] = (summary[k] || 0) + 1; }
  const queued = rows.filter((r) => r.status === "queued").map((r) => r.log_id);
  if (!queued.length) { console.log(JSON.stringify({ fn: "send-reminders", summary })); return json({ ok: true, summary }); }

  // ---- live path (unreachable while SEND_ENABLED = false: rows go back to skipped, nothing is sent) ----
  const s = await senderSettings();
  const block = senderBlock(s);
  if (block || !SEND_ENABLED) {
    await rest(`email_send_log?id=in.(${queued.join(",")})&status=eq.queued`, { method: "PATCH", body: JSON.stringify({ status: "skipped", skip_reason: `blocked:${block || "send_disabled_in_code"}` }) });
    summary.blocked = queued.length; console.log(JSON.stringify({ fn: "send-reminders", summary, block })); return json({ ok: true, summary, block });
  }
  const key = await hmacKey();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  let sentToday = (await rest<Array<{ id: string }>>(`email_send_log?select=id&status=eq.sent&sent_at=gte.${dayStart.toISOString()}`)).length;
  for (const id of queued) {
    // claim (queued -> sending) so overlapping runs can never double-send
    const claimed = await rest<Array<{ id: string; optin_id: string; touch: "day27" | "month_start"; last_refill_at: string }>>(
      `email_send_log?id=eq.${id}&status=eq.queued&select=id,optin_id,touch,last_refill_at`, { method: "PATCH", body: JSON.stringify({ status: "sending" }) });
    if (!claimed.length) continue;
    const g = claimed[0];
    if (sentToday >= s.dailyCap) { await rest(`email_send_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "skipped", skip_reason: "daily_cap" }) }); summary.daily_cap = (summary.daily_cap || 0) + 1; continue; }
    const [o] = await rest<Array<{ email: string; lang: "en" | "es"; token: string; carrier: string | null; carrier_slug: string | null; phone: string; host: string | null; unsubscribed_at: string | null }>>(
      `reminder_optins?id=eq.${g.optin_id}&select=email,lang,token,carrier,carrier_slug,phone,host,unsubscribed_at`);
    if (!o || o.unsubscribed_at) { await rest(`email_send_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "skipped", skip_reason: "unsubscribed" }) }); continue; }
    const host = siteHost(o.host); const pre = o.lang === "es" ? "/es" : "";
    const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
    const refillUrl = `https://${host}${pre}/r?t=${encodeURIComponent(await signLink(key, "r", id, exp))}&utm_source=reminder&utm_medium=email&utm_campaign=${g.touch}`;
    const unsubTok = await signLink(key, "u", o.token);
    const unsubUrl = `https://${host}${pre}/unsubscribe?t=${encodeURIComponent(unsubTok)}`;
    const oneClick = `${FN_BASE()}?a=unsub&t=${encodeURIComponent(unsubTok)}`;
    const m = reminderEmail({ lang: o.lang, carrier: o.carrier || "", last4: o.phone.slice(-4), lastDate: g.last_refill_at, refillUrl, unsubUrl, postal: s.postal, touch: g.touch });
    const res = await cfSend(s, { to: o.email, ...m, headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "X-CP-Type": "refill_reminder" } });
    const patch: Record<string, unknown> =
      res.kind === "sent" ? { status: "sent", sent_at: new Date().toISOString(), provider: "cloudflare", provider_ref: res.ref }
      : res.kind === "suppressed" ? { status: "skipped", skip_reason: "provider_suppressed", error: res.code }
      : res.kind === "deferred" ? { status: "queued", error: res.code }                 // a later run may retry (nothing was sent)
      : res.kind === "rejected" ? { status: "failed", error: res.code }
      : { status: "failed_unknown", error: res.code };                                 // ambiguous: never auto-retried
    await rest(`email_send_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (res.kind === "suppressed") await rest("email_suppression?on_conflict=email_sha256", { method: "POST", headers: { prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ email_sha256: await sha256Hex(o.email.trim().toLowerCase()), reason: "bounce", source: "cloudflare:send" }) });
    if (res.kind === "sent") sentToday++;
    summary[`send:${res.kind}`] = (summary[`send:${res.kind}`] || 0) + 1;
  }
  console.log(JSON.stringify({ fn: "send-reminders", summary }));
  return json({ ok: true, summary });
});
