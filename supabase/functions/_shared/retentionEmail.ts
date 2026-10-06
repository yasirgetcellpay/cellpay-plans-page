// retention-1006 (CellPay US) shared email helpers: DB access (PostgREST + service role), signed links, EN/ES templates,
// Cloudflare Email Sending REST adapter. No secret, address, phone or body is ever logged.
// SEND_ENABLED is a hard code switch: while false no function can call the provider, whatever the DB mode or secrets say.
// Go-live = a separate reviewed package that flips it (see seo/retention-1006/email/STATUS.md).
export const SEND_ENABLED = false;

export const CF_ACCOUNT_DEFAULT = "7daef2eefd2b54148d4b8ef26b57d5a7";   // not secret; CF_ACCOUNT_ID env overrides
const SITE_HOSTS = new Set(["refill.cellpay.us", "www.cellpay.us"]);
export const siteHost = (h?: string | null): string => {
  const x = String(h || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return SITE_HOSTS.has(x) ? x : "refill.cellpay.us";
};

const env = (k: string): string => Deno.env.get(k) || "";
const base = () => env("SUPABASE_URL");
const hdr = () => ({ apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "content-type": "application/json" });

export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${base()}/rest/v1/rpc/${name}`, { method: "POST", headers: hdr(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc_${name}_${r.status}`);
  return await r.json() as T;
}
/** PostgREST read: path like "email_send_log?select=id,status&status=eq.queued" */
export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${base()}/rest/v1/${path}`, { ...init, headers: { ...hdr(), prefer: "return=representation", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`rest_${r.status}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

export async function cronAuthorized(req: Request): Promise<boolean> {
  const t = req.headers.get("x-cron-token") || "";
  if (!/^[0-9a-f]{64}$/.test(t)) return false;
  try { return (await rpc<boolean>("retention_email_cron_auth", { _token: t })) === true; } catch { return false; }
}

// ---- signed links (HMAC-SHA256, key from Vault via retention_email_hmac_key(); never logged) ----
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => { const p = s.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(p + "===".slice((p.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
let keyCache = "";
export async function hmacKey(): Promise<string> { if (!keyCache) keyCache = String(await rpc<string>("retention_email_hmac_key") || ""); return keyCache; }
async function hmac(key: string, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
const ctEq = (a: Uint8Array, b: Uint8Array) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i]; return x === 0; };
export type LinkKind = "u" | "r";   // u = unsubscribe (opt-in token, no expiry); r = refill link (send-log id, expires)
export async function signLink(key: string, kind: LinkKind, id: string, expUnix = 0): Promise<string> {
  if (!key || key.length < 32) throw new Error("hmac_key_missing");
  const payload = `v1|${kind}|${id}|${expUnix}`;
  return b64u(enc.encode(payload)) + "." + b64u(await hmac(key, payload));
}
export async function verifyLink(key: string, token: string, kind: LinkKind): Promise<string | null> {
  try {
    if (!key || key.length < 32 || typeof token !== "string" || token.length > 300) return null;
    const [p, s] = token.split("."); if (!p || !s) return null;
    const payload = new TextDecoder().decode(unb64u(p));
    if (!ctEq(unb64u(s), await hmac(key, payload))) return null;
    const m = /^v1\|([ur])\|([0-9a-f-]{16,64})\|(\d{1,12})$/.exec(payload);
    if (!m || m[1] !== kind) return null;
    const exp = Number(m[3]); if (exp && exp < Date.now() / 1000) return null;
    return m[2];
  } catch { return null; }
}
export async function sha256Hex(s: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const randomToken = (): string => b64u(crypto.getRandomValues(new Uint8Array(32)));

// ---- settings / sender config ----
export interface SenderSettings { fromAddress: string; fromName: string; replyTo: string; postal: string; dailyCap: number }
export async function senderSettings(): Promise<SenderSettings> {
  const rows = await rest<Array<{ key: string; value: string }>>("retention_email_settings?select=key,value");
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { fromAddress: m.from_address || "", fromName: m.from_name || "", replyTo: m.reply_to || "", postal: m.postal_address || "", dailyCap: Number(m.daily_cap || 0) };
}
/** null = cannot send (placeholder owner inputs, missing token, or SEND_ENABLED false). Reason string for the run summary. */
export function senderBlock(s: SenderSettings): string | null {
  if (!SEND_ENABLED) return "send_disabled_in_code";
  if (!env("CF_EMAIL_API_TOKEN")) return "cf_token_missing";
  for (const [k, v] of Object.entries({ from_name: s.fromName, from_address: s.fromAddress, postal_address: s.postal, reply_to: s.replyTo }))
    if (!v || v.includes("__SET_ME__")) return `setting_${k}_not_set`;
  if (!/@notify\.cellpay\.us$/i.test(s.fromAddress)) return "from_not_on_notify_domain";
  return null;
}

// ---- Cloudflare Email Sending (REST). No idempotency key exists: never auto-retry an ambiguous result. ----
export type SendResult = { kind: "sent"; ref: string } | { kind: "suppressed"; code: string } | { kind: "deferred"; code: string }
  | { kind: "rejected"; code: string } | { kind: "unknown"; code: string };
export async function cfSend(s: SenderSettings, m: { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }): Promise<SendResult> {
  if (senderBlock(s)) return { kind: "rejected", code: senderBlock(s)! };
  const ref = crypto.randomUUID();
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env("CF_ACCOUNT_ID") || CF_ACCOUNT_DEFAULT)}/email/sending/send`, {
      method: "POST", signal: ctrl.signal,
      headers: { authorization: `Bearer ${env("CF_EMAIL_API_TOKEN")}`, "content-type": "application/json" },
      body: JSON.stringify({ from: { address: s.fromAddress, name: s.fromName }, to: m.to, reply_to: s.replyTo, subject: m.subject, html: m.html, text: m.text,
        headers: { ...(m.headers || {}), "X-CP-Ref": ref } }),
    });
    let j: { success?: boolean; errors?: Array<{ code?: number; message?: string }>; result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[] } } | null = null;
    try { j = await r.json(); } catch { j = null; }
    const err = j?.errors?.[0]; const code = err ? `${err.code ?? ""}` : `http_${r.status}`;
    if (r.status >= 200 && r.status < 300 && j?.success && j.result) {
      const lc = m.to.trim().toLowerCase(); const has = (xs?: string[]) => (xs || []).some((x) => String(x).trim().toLowerCase() === lc);
      if (has(j.result.permanent_bounces)) return { kind: "suppressed", code: "permanent_bounce" };
      if (has(j.result.delivered) || has(j.result.queued)) return { kind: "sent", ref };
      return { kind: "unknown", code: "2xx_recipient_missing" };
    }
    if (r.status === 429 || err?.code === 10004) return { kind: "deferred", code };
    if (r.status >= 500 || (r.status >= 200 && r.status < 300)) return { kind: "unknown", code };
    if (/suppress|bounce/i.test(String(err?.message || ""))) return { kind: "suppressed", code };
    return { kind: "rejected", code };
  } catch (e) {
    return { kind: "unknown", code: (e as Error)?.name === "AbortError" ? "timeout" : "network" };
  } finally { clearTimeout(timer); }
}

// ---- templates (simple EN/ES; never instant / free / no fees / 24/7 / cualquier / refunds / PIN / Pay Cell Systems) ----
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;
export const fmtDate = (iso: string, lang: "en" | "es") =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "long", day: "numeric", timeZone: "UTC" });

function shell(lang: "en" | "es", bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222"><div style="max-width:520px;margin:0 auto;padding:24px 16px">` +
    `<div style="background:#fff;border-radius:10px;padding:24px">${bodyHtml}</div>` +
    `<div style="font-size:12px;color:#666;padding:16px 4px;line-height:1.5">${footerHtml}</div></div></body></html>`;
}
const btn = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:8px;display:inline-block">${esc(label)}</a></p>`;

export interface ReminderVars { lang: "en" | "es"; carrier: string; last4: string; lastDate: string; refillUrl: string; unsubUrl: string; postal: string; touch: "day27" | "month_start" }
export function reminderEmail(v: ReminderVars): { subject: string; html: string; text: string } {
  const es = v.lang === "es"; const c = v.carrier || (es ? "su operador" : "your carrier");
  const subject = es ? `¿Es hora de recargar su número de ${c}?` : `Time to refill your ${c} number?`;
  const l1 = es ? `Su última recarga de ${c} para el número que termina en ${v.last4} fue el ${fmtDate(v.lastDate, "es")}.`
                : `Your last ${c} refill for the number ending in ${v.last4} was on ${fmtDate(v.lastDate, "en")}.`;
  const l2 = es ? "Recargue de nuevo en pocos pasos. Se aplica un cargo por servicio, que verá antes de pagar."
                : "Refill again in a few steps. A service fee applies and is shown before you pay.";
  const l3 = es ? "¿Prefiere recargas automáticas? Active el pago automático al pagar." : "Prefer automatic refills? Turn on Auto Pay at checkout.";
  const cta = es ? "Recargar ahora" : "Refill now";
  const why = es ? "Recibe este recordatorio porque lo pidió en CellPay después de un pago." : "You get this reminder because you asked for it on CellPay after a payment.";
  const unsub = es ? "Darse de baja" : "Unsubscribe";
  const footer = `${esc(why)}<br><a href="${esc(v.unsubUrl)}" style="color:#666">${unsub}</a><br>CellPay · ${esc(v.postal)}`;
  const html = shell(v.lang, `<h1 style="font-size:20px;margin:0 0 12px">${esc(subject)}</h1><p>${esc(l1)}</p><p>${esc(l2)}</p>${btn(v.refillUrl, cta)}<p style="font-size:14px">${esc(l3)}</p>`, footer);
  const text = `${subject}\n\n${l1}\n${l2}\n\n${cta}: ${v.refillUrl}\n\n${l3}\n\n--\n${why}\n${unsub}: ${v.unsubUrl}\nCellPay · ${v.postal}\n`;
  return { subject, html, text };
}

export interface NoticeVars { lang: "en" | "es"; carrier: string; last4: string; chargeDate: string; refillAmount: number; feeNote: string; cancelUrl: string; postal: string }
export function autopayNoticeEmail(v: NoticeVars): { subject: string; html: string; text: string } {
  const es = v.lang === "es"; const d = fmtDate(v.chargeDate, v.lang);
  const subject = es ? `Su cobro de pago automático de CellPay el ${d}` : `Your CellPay Auto Pay charge on ${d}`;
  const l1 = es ? `El ${d} recargaremos su número de ${v.carrier} que termina en ${v.last4} con ${money(v.refillAmount)} con su pago automático.`
                : `On ${d} we will refill your ${v.carrier} number ending in ${v.last4} with ${money(v.refillAmount)} using Auto Pay.`;
  const l2 = es ? `Se aplica un cargo por servicio. ${v.feeNote}` : `A service fee applies. ${v.feeNote}`;
  const l3 = es ? "Si quiere cancelar el pago automático, toque el botón antes de esa fecha." : "If you want to cancel Auto Pay, tap the button before that date.";
  const cta = es ? "Cancelar pago automático" : "Cancel Auto Pay";
  const help = es ? "¿Preguntas? Escriba a support@getcellpay.com." : "Questions? Email support@getcellpay.com.";
  const why = es ? "Este aviso es parte de su pago automático de CellPay." : "This notice is part of your CellPay Auto Pay.";
  const footer = `${esc(why)}<br>CellPay · ${esc(v.postal)}`;
  const html = shell(v.lang, `<h1 style="font-size:20px;margin:0 0 12px">${esc(subject)}</h1><p>${esc(l1)}</p><p>${esc(l2)}</p><p>${esc(l3)}</p>${btn(v.cancelUrl, cta)}<p style="font-size:14px">${esc(help)}</p>`, footer);
  const text = `${subject}\n\n${l1}\n${l2}\n${l3}\n\n${cta}: ${v.cancelUrl}\n\n${help}\n\n--\n${why}\nCellPay · ${v.postal}\n`;
  return { subject, html, text };
}

export const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });
