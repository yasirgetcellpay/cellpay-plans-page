// email-links (retention-1006): public endpoint behind the links in reminder / Auto Pay emails. verify_jwt = false (mail clients and
// link scanners send no JWT); every action needs a valid signed or random token. Sends nothing. Logs action + outcome only.
//  - POST ?a=unsub&t=<signed>  RFC 8058 one-click (body "List-Unsubscribe=One-Click") -> opt-in unsubscribed + email suppressed. 200 text.
//  - POST {a:"unsub", t}       same, from the site's /unsubscribe confirm page (button). GET/peek never changes anything.
//  - POST {a:"unsub_peek", t}  {valid}
//  - POST {a:"refill", t}      signed refill link (7 days) -> {slug, amount, phone, carrier} for the site's /r page (number filled in).
//  - POST {a:"ap_peek", t}     Auto Pay cancel link -> {carrier, last4, charge_date}; does NOT use the token.
//  - POST {a:"ap_confirm", t}  only while autopay_notice_mode = 'live': marks the token used (single use) and returns {phone, verify}
//                              (order last 4) so the site page runs the EXISTING AP-1 "autopay/unsubscribe" call. Shadow: not_active.
import { rpc, rest, json, hmacKey, verifyLink, sha256Hex } from "../_shared/retentionEmail.ts";

const ORIGINS = new Set(["https://refill.cellpay.us", "https://www.cellpay.us", "https://cellpay.us"]);
const cors = (req: Request): Record<string, string> => {
  const o = req.headers.get("origin") || "";
  return ORIGINS.has(o) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(o)
    ? { "access-control-allow-origin": o, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, apikey, authorization", vary: "origin" }
    : {};
};
const log = (a: string, outcome: string) => console.log(JSON.stringify({ fn: "email-links", a, outcome }));

Deno.serve(async (req) => {
  const c = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
  if (req.method !== "POST") return json({ error: "method" }, 405, c);
  const url = new URL(req.url);
  const ctype = req.headers.get("content-type") || "";
  let a = url.searchParams.get("a") || ""; let t = url.searchParams.get("t") || "";
  let oneClick = false;
  if (ctype.includes("application/json")) {
    try { const b = await req.json(); a = String(b?.a || a); t = String(b?.t || t); } catch { /* keep query */ }
  } else {
    oneClick = (await req.text()).includes("List-Unsubscribe=One-Click");
  }
  if (!t || t.length > 300) return json({ ok: false, code: "bad_token" }, 400, c);

  if (a === "unsub" || a === "unsub_peek") {
    const id = await verifyLink(await hmacKey(), t, "u");
    if (!id) { log(a, "bad_token"); return json({ ok: false, code: "bad_token" }, 400, c); }
    if (a === "unsub_peek") return json({ ok: true, valid: true }, 200, c);
    const r = await rpc<string>("reminder_unsubscribe", { _token: id, _source: oneClick ? "list-unsubscribe" : "footer" });
    log(a, r);
    return oneClick ? new Response("unsubscribed", { status: 200, headers: { "content-type": "text/plain" } }) : json({ ok: r === "ok" }, 200, c);
  }

  if (a === "refill") {
    const id = await verifyLink(await hmacKey(), t, "r");
    if (!id) { log(a, "bad_token"); return json({ ok: false, code: "bad_token" }, 400, c); }
    const [g] = await rest<Array<{ optin_id: string; carrier_slug: string | null; amount: number | null; first_click_at?: string }>>(
      `email_send_log?id=eq.${id}&kind=eq.refill_reminder&select=optin_id,carrier_slug,amount`);
    if (!g) { log(a, "not_found"); return json({ ok: false, code: "not_found" }, 404, c); }
    const [o] = await rest<Array<{ phone: string; carrier: string | null; carrier_slug: string | null }>>(`reminder_optins?id=eq.${g.optin_id}&select=phone,carrier,carrier_slug`);
    if (!o) return json({ ok: false, code: "not_found" }, 404, c);
    log(a, "ok");
    return json({ ok: true, slug: g.carrier_slug || o.carrier_slug, amount: g.amount, phone: o.phone, carrier: o.carrier }, 200, c);
  }

  if (a === "ap_peek" || a === "ap_confirm") {
    const h = await sha256Hex(t);
    const [g] = await rest<Array<{ id: string; order_id: string; charge_date: string; phone_last4: string; carrier_slug: string | null; token_expires_at: string; token_used_at: string | null; mode: string }>>(
      `email_send_log?token_hash=eq.${h}&kind=eq.autopay_notice&select=id,order_id,charge_date,phone_last4,carrier_slug,token_expires_at,token_used_at,mode`);
    if (!g || new Date(g.token_expires_at).getTime() < Date.now()) { log(a, "bad_token"); return json({ ok: false, code: "expired_or_invalid" }, 400, c); }
    if (a === "ap_peek") { log(a, "ok"); return json({ ok: true, last4: g.phone_last4, carrier_slug: g.carrier_slug, charge_date: g.charge_date, used: !!g.token_used_at }, 200, c); }
    const mode = await rpc<string>("retention_email_setting", { _key: "autopay_notice_mode", _default: "shadow" });
    if (mode !== "live" || g.mode !== "live") { log(a, "not_active"); return json({ ok: false, code: "not_active" }, 409, c); }
    const used = await rest<Array<{ id: string }>>(`email_send_log?id=eq.${g.id}&token_used_at=is.null&select=id`, { method: "PATCH", body: JSON.stringify({ token_used_at: new Date().toISOString() }) });
    if (!used.length) { log(a, "already_used"); return json({ ok: false, code: "already_used" }, 409, c); }
    const [tx] = await rest<Array<{ phone_number: string; hashid: string | null; transaction_id: string | null }>>(`transaction_logs?id=eq.${g.order_id}&select=phone_number,hashid,transaction_id`);
    const ref = String(tx?.hashid || tx?.transaction_id || "");
    if (!tx || ref.length < 4) { log(a, "no_proof"); return json({ ok: false, code: "contact_support" }, 200, c); }
    log(a, "ok");
    return json({ ok: true, phone: String(tx.phone_number).replace(/\D/g, "").slice(-10), verify: ref.slice(-4) }, 200, c);
  }
  return json({ ok: false, code: "bad_action" }, 400, c);
});
