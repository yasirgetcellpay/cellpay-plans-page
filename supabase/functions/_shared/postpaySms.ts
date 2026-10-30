type Receipt = { phone_number: string | null; amount: number | string | null; carrier_name: string | null; lang: "en" | "es" }; // POSTPAY-SMS-34332-1030
type SmsMeta = { status: string; sid: string | null; error_code: string | null; at: string; lang: "en" | "es" }; // POSTPAY-SMS-34332-1030
type Dependencies = { env: (name: string) => string | undefined; rpc: (name: string, data: Record<string, unknown>) => Promise<unknown>; fetch: typeof fetch }; // POSTPAY-SMS-34332-1030
const readEnv = (name: string): string | undefined => (globalThis as unknown as { Deno?: { env: { get: (name: string) => string | undefined } } }).Deno?.env.get(name); // POSTPAY-SMS-34332-1030
async function rpc(name: string, data: Record<string, unknown>): Promise<unknown> { // POSTPAY-SMS-34332-1030
  const url = readEnv("SUPABASE_URL"), key = readEnv("SUPABASE_SERVICE_ROLE_KEY"); // POSTPAY-SMS-34332-1030
  if (!url || !key) throw new Error("SMS database unavailable"); // POSTPAY-SMS-34332-1030
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.timeout(5000) }); // POSTPAY-SMS-34332-1030
  if (!response.ok) throw new Error("SMS metadata unavailable"); // POSTPAY-SMS-34332-1030
  const body = await response.text(); return body ? JSON.parse(body) : null; // POSTPAY-SMS-34332-1030
} // POSTPAY-SMS-34332-1030
export function postpayMdn(value: unknown): string | null { // POSTPAY-SMS-34332-1030
  if (typeof value !== "string" || !/^[+\d\s().-]+$/.test(value)) return null; // POSTPAY-SMS-34332-1030
  let digits = value.replace(/\D/g, ""); if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1); // POSTPAY-SMS-34332-1030
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null; // POSTPAY-SMS-34332-1030
} // POSTPAY-SMS-34332-1030
export function postpayBody(amount: number, carrier: string, mdn: string, lang: "en" | "es"): string { // POSTPAY-SMS-34332-1030
  return lang === "es" ? `CellPay: Su recarga ${carrier} de $${amount.toFixed(2)} para ***${mdn.slice(-4)} está pagada. Responda STOP para cancelar, HELP para ayuda. Pueden aplicar tarifas.` : `CellPay: Your $${amount.toFixed(2)} ${carrier} refill for ***${mdn.slice(-4)} is paid. Reply STOP to opt out, HELP for help. Msg&data rates may apply.`; // POSTPAY-SMS-34332-1030
} // POSTPAY-SMS-34332-1030
export async function sendPostpaySms(logId: string, deps: Dependencies = { env: readEnv, rpc, fetch }): Promise<void> { // POSTPAY-SMS-34332-1030
  let meta: SmsMeta | undefined; // POSTPAY-SMS-34332-1030
  const save = async () => { if (meta) await deps.rpc("tx_log_meta_merge", { _id: logId, _patch: { postpay_sms: { ...meta, at: new Date().toISOString() } } }); }; // POSTPAY-SMS-34332-1030
  try { // POSTPAY-SMS-34332-1030
    if (deps.env("POSTPAY_SMS_ENABLED") !== "true") return; // POSTPAY-SMS-34332-1030
    const account = deps.env("TWILIO_ACCOUNT_SID"), token = deps.env("TWILIO_AUTH_TOKEN"), service = deps.env("TWILIO_MESSAGING_SERVICE_SID"); // POSTPAY-SMS-34332-1030
    if (!account || !token || !service) return; // POSTPAY-SMS-34332-1030
    const claimed = await deps.rpc("claim_postpay_sms", { _id: logId }); // POSTPAY-SMS-34332-1030
    const row = (Array.isArray(claimed) ? claimed[0] : claimed) as Receipt | null; if (!row) return; // POSTPAY-SMS-34332-1030
    const lang = row.lang === "es" ? "es" : "en"; // POSTPAY-SMS-34332-1030
    meta = { status: "failed", sid: null, error_code: null, at: new Date().toISOString(), lang }; // POSTPAY-SMS-34332-1030
    const mdn = postpayMdn(row.phone_number), amount = row.amount === null ? NaN : Number(row.amount), carrier = typeof row.carrier_name === "string" ? row.carrier_name.replace(/[\r\n\t]/g, " ").trim() : ""; // POSTPAY-SMS-34332-1030
    if (!mdn || !Number.isFinite(amount) || amount <= 0 || !carrier || carrier.length > 120) { meta.status = "skipped"; meta.error_code = "invalid_receipt"; await save(); return; } // POSTPAY-SMS-34332-1030
    for (let attempt = 0; attempt < 2; attempt++) { // POSTPAY-SMS-34332-1030
      const response = await deps.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${account}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: mdn, MessagingServiceSid: service, Body: postpayBody(amount, carrier, mdn, lang) }), signal: AbortSignal.timeout(5000) }); // POSTPAY-SMS-34332-1030
      let data: Record<string, unknown> = {}; try { data = await response.json(); } catch { /* Never retain provider text, which can contain phone numbers or credentials. */ } // POSTPAY-SMS-34332-1030
      meta.status = response.ok ? "sent" : Number(data.code) === 21610 ? "opted_out" : "failed"; // POSTPAY-SMS-34332-1030
      meta.sid = response.ok && typeof data.sid === "string" && /^SM[a-fA-F0-9]{32}$/.test(data.sid) ? data.sid : null; // POSTPAY-SMS-34332-1030
      meta.error_code = response.ok ? null : /^\d{1,8}$/.test(String(data.code ?? "")) ? String(data.code) : `http_${response.status}`; // POSTPAY-SMS-34332-1030
      if (response.status < 500 || response.status > 599 || attempt === 1) break; // POSTPAY-SMS-34332-1030
    } // POSTPAY-SMS-34332-1030
    await save(); // POSTPAY-SMS-34332-1030
  } catch { // POSTPAY-SMS-34332-1030
    if (meta) { meta.status = "failed"; meta.error_code = "sms_error"; try { await save(); } catch { /* Never alter payment status, tracking or responses. */ } } // POSTPAY-SMS-34332-1030
  } // POSTPAY-SMS-34332-1030
} // POSTPAY-SMS-34332-1030
export function startPostpaySms(logId: string): void { // POSTPAY-SMS-34332-1030
  try { const work = sendPostpaySms(logId).catch(() => {}); (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(work); } catch { /* Background only; never awaited by payment code. */ } // POSTPAY-SMS-34332-1030
} // POSTPAY-SMS-34332-1030