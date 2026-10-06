// autopay-notice (retention-1006): email Auto Pay customers 3 days before each charge (amount, date, number ending, one-tap cancel link).
// SHADOW until CellPay's upcoming-charge feed exists: charge dates are ESTIMATES (enrollment date + N months) and autopay_notice_run()
// forces shadow unless autopay_allow_estimate='true'. Transactional: marketing unsubscribes do not stop it (bounce/complaint do).
// Cancel link -> https://<host>/ap/cancel?t=<token> (site confirm page). Opening the link never cancels; only the page's button does,
// and it runs the existing AP-1 unsubscribe. Token: 32 random bytes, only sha256 stored, single use, expires 2 days after the charge.
// Auth: x-cron-token. verify_jwt = false. Logs counts only. Live also needs SEND_ENABLED + secrets + owner inputs (STATUS.md).
import { SEND_ENABLED, cronAuthorized, rpc, rest, json, senderSettings, senderBlock, cfSend, autopayNoticeEmail, siteHost, randomToken, sha256Hex } from "../_shared/retentionEmail.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await cronAuthorized(req))) return json({ error: "forbidden" }, 403);
  let body: { ignore_window?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }
  const rows = await rpc<Array<{ log_id: string; status: string; skip_reason: string | null }>>("autopay_notice_run", { _ignore_window: body.ignore_window === true });
  const summary: Record<string, number> = {};
  for (const r of rows) { const k = r.skip_reason ? `skipped:${r.skip_reason}` : r.status; summary[k] = (summary[k] || 0) + 1; }
  const queued = rows.filter((r) => r.status === "queued").map((r) => r.log_id);
  if (!queued.length) { console.log(JSON.stringify({ fn: "autopay-notice", summary })); return json({ ok: true, summary }); }

  // ---- live path (unreachable while SEND_ENABLED = false) ----
  const s = await senderSettings();
  const block = senderBlock(s);
  if (block || !SEND_ENABLED) {
    await rest(`email_send_log?id=in.(${queued.join(",")})&status=eq.queued`, { method: "PATCH", body: JSON.stringify({ status: "skipped", skip_reason: `blocked:${block || "send_disabled_in_code"}` }) });
    summary.blocked = queued.length; console.log(JSON.stringify({ fn: "autopay-notice", summary, block })); return json({ ok: true, summary, block });
  }
  for (const id of queued) {
    const claimed = await rest<Array<{ id: string; order_id: string; charge_date: string; amount: number; lang: "en" | "es" }>>(
      `email_send_log?id=eq.${id}&status=eq.queued&select=id,order_id,charge_date,amount,lang`, { method: "PATCH", body: JSON.stringify({ status: "sending" }) });
    if (!claimed.length) continue;
    const g = claimed[0];
    const [t] = await rest<Array<{ email: string; phone_number: string; carrier_name: string | null; metadata: Record<string, unknown> | null }>>(
      `transaction_logs?id=eq.${g.order_id}&select=email,phone_number,carrier_name,metadata`);
    if (!t?.email) { await rest(`email_send_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "skipped", skip_reason: "no_email" }) }); continue; }
    const tok = randomToken();
    const exp = new Date(`${g.charge_date}T23:59:59-06:00`); exp.setUTCDate(exp.getUTCDate() + 2);
    await rest(`email_send_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ token_hash: await sha256Hex(tok), token_expires_at: exp.toISOString() }) });
    const host = siteHost(String(t.metadata?.caller_host || "")); const pre = g.lang === "es" ? "/es" : "";
    const m = autopayNoticeEmail({ lang: g.lang, carrier: t.carrier_name || "", last4: String(t.phone_number).slice(-4), chargeDate: g.charge_date,
      refillAmount: Number(g.amount), feeNote: g.lang === "es" ? "El total con el cargo se muestra en su recibo." : "The total with the fee is shown on your receipt.",
      cancelUrl: `https://${host}${pre}/ap/cancel?t=${encodeURIComponent(tok)}`, postal: s.postal });
    const res = await cfSend(s, { to: t.email, ...m, headers: { "X-CP-Type": "autopay_notice" } });
    const patch: Record<string, unknown> =
      res.kind === "sent" ? { status: "sent", sent_at: new Date().toISOString(), provider: "cloudflare", provider_ref: res.ref }
      : res.kind === "suppressed" ? { status: "skipped", skip_reason: "provider_suppressed", error: res.code }
      : res.kind === "deferred" ? { status: "queued", error: res.code }
      : res.kind === "rejected" ? { status: "failed", error: res.code }
      : { status: "failed_unknown", error: res.code };
    await rest(`email_send_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    summary[`send:${res.kind}`] = (summary[`send:${res.kind}`] || 0) + 1;
  }
  console.log(JSON.stringify({ fn: "autopay-notice", summary }));
  return json({ ok: true, summary });
});
