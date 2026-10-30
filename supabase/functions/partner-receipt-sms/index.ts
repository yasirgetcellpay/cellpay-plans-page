import { partnerReceiptBody, postpayMdn, type PartnerBrand } from "../_shared/partnerReceiptSms.ts"; // CM-PZ-34332-HOST-1030
type Runtime = { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): unknown }; // CM-PZ-34332-HOST-1030
type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch }; // CM-PZ-34332-HOST-1030
const runtime = (globalThis as unknown as { Deno?: Runtime }).Deno; // CM-PZ-34332-HOST-1030
const reply = (http: number, data: Record<string, unknown>) => new Response(JSON.stringify(data), { status: http, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); // CM-PZ-34332-HOST-1030
async function keyMatches(candidate: string, secret: string): Promise<boolean> { // CM-PZ-34332-HOST-1030
  const encode = new TextEncoder(); // CM-PZ-34332-HOST-1030
  const [a, b] = await Promise.all([candidate, secret].map(value => crypto.subtle.digest("SHA-256", encode.encode(value)))); // CM-PZ-34332-HOST-1030
  const left = new Uint8Array(a), right = new Uint8Array(b); let difference = 0; // CM-PZ-34332-HOST-1030
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index]; // CM-PZ-34332-HOST-1030
  return difference === 0; // CM-PZ-34332-HOST-1030
} // CM-PZ-34332-HOST-1030
export async function handlePartnerReceipt(request: Request, deps: Dependencies = { env: name => runtime?.env.get(name), fetch }): Promise<Response> { // CM-PZ-34332-HOST-1030
  if (request.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" }); // CM-PZ-34332-HOST-1030
  let claimId: string | number | undefined; let claimedOrder = false; let preserveClaim = false; // CM-PZ-34332-HOST-1030
  const db = async (method: string, query: string, body?: Record<string, unknown>) => { // CM-PZ-34332-HOST-1030
    const url = deps.env("SUPABASE_URL"), key = deps.env("SUPABASE_SERVICE_ROLE_KEY"); // CM-PZ-34332-HOST-1030
    if (!url || !key) throw new Error("database_unavailable"); // CM-PZ-34332-HOST-1030
    return deps.fetch(`${url}/rest/v1/partner_receipt_sms_log${query}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) }); // CM-PZ-34332-HOST-1030
  }; // CM-PZ-34332-HOST-1030
  const release = async () => { // CM-PZ-34332-HOST-1030
    if (claimedOrder && !preserveClaim && claimId !== undefined) { const result = await db("DELETE", `?id=eq.${encodeURIComponent(String(claimId))}&status=eq.pending`); if (!result.ok) throw new Error("database_unavailable"); } // CM-PZ-34332-HOST-1030
  }; // CM-PZ-34332-HOST-1030
  try { // CM-PZ-34332-HOST-1030
    const candidate = request.headers.get("X-Partner-Key") ?? ""; // CM-PZ-34332-HOST-1030
    let brand: PartnerBrand | undefined; // CM-PZ-34332-HOST-1030
    for (const partner of ["callingmart", "pinzoo"] as const) { const secret = deps.env(`PARTNER_RECEIPT_SMS_KEY_${partner.toUpperCase()}`); if (secret && await keyMatches(candidate, secret)) brand = partner; } // CM-PZ-34332-HOST-1030
    if (!brand) return reply(401, { ok: false, error: "unauthorized" }); // CM-PZ-34332-HOST-1030
    if (deps.env("PARTNER_RECEIPT_SMS_ENABLED") !== "true") return reply(503, { ok: false, error: "disabled" }); // CM-PZ-34332-HOST-1030
    let body: Record<string, unknown>; // CM-PZ-34332-HOST-1030
    try { const parsed = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { ok: false, error: "bad_request" }); body = parsed; } catch { return reply(400, { ok: false, error: "bad_request" }); } // CM-PZ-34332-HOST-1030
    const requestedBrand = body.brand ?? body.site; // CM-PZ-34332-HOST-1030
    if (typeof body.to !== "string" || !body.to || body.to.length > 40 || typeof requestedBrand !== "string" || (body.lang !== undefined && body.lang !== "en" && body.lang !== "es") || (body.amount !== undefined && (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0 || body.amount > 1000000)) || (body.carrier !== undefined && (typeof body.carrier !== "string" || body.carrier.length > 120 || /[\r\n\t]/.test(body.carrier))) || (body.order_id !== undefined && (typeof body.order_id !== "string" || !body.order_id.trim() || body.order_id.length > 255))) return reply(400, { ok: false, error: "bad_request" }); // CM-PZ-34332-HOST-1030
    if (requestedBrand.toLowerCase() !== brand || (body.site !== undefined && (typeof body.site !== "string" || body.site.toLowerCase() !== brand))) return reply(403, { ok: false, error: "forbidden" }); // CM-PZ-34332-HOST-1030
    const mdn = postpayMdn(body.to); if (!mdn) return reply(400, { ok: false, error: "invalid_phone" }); // CM-PZ-34332-HOST-1030
    const account = deps.env("TWILIO_ACCOUNT_SID"), token = deps.env("TWILIO_AUTH_TOKEN"), service = deps.env("TWILIO_MESSAGING_SERVICE_SID"); // CM-PZ-34332-HOST-1030
    if (!account || !token || !service) return reply(503, { ok: false, error: "skipped_no_secrets" }); // CM-PZ-34332-HOST-1030
    const orderId = typeof body.order_id === "string" ? body.order_id : undefined; const last4 = mdn.slice(-4); // CM-PZ-34332-HOST-1030
    const claim = await db("POST", "", { brand, order_id: orderId, to_last4: last4, status: orderId ? "pending" : "warn_no_order_id" }); // CM-PZ-34332-HOST-1030
    if (!claim.ok) { // CM-PZ-34332-HOST-1030
      const detail = await claim.json().catch(() => ({})); // CM-PZ-34332-HOST-1030
      if (orderId && claim.status === 409 && detail.code === "23505") { // CM-PZ-34332-HOST-1030
        const prior = await db("GET", `?brand=eq.${brand}&order_id=eq.${encodeURIComponent(orderId)}&select=sid&limit=1`); // CM-PZ-34332-HOST-1030
        if (!prior.ok) throw new Error("database_unavailable"); const rows = await prior.json(); // CM-PZ-34332-HOST-1030
        if (!rows[0]) throw new Error("database_unavailable"); return reply(200, { ok: true, status: "duplicate", sid: rows[0].sid ?? null }); // CM-PZ-34332-HOST-1030
      } // CM-PZ-34332-HOST-1030
      throw new Error("database_unavailable"); // CM-PZ-34332-HOST-1030
    } // CM-PZ-34332-HOST-1030
    const rows = await claim.json(); claimId = rows[0]?.id; if (claimId === undefined) throw new Error("database_unavailable"); claimedOrder = Boolean(orderId); // CM-PZ-34332-HOST-1030
    const save = async (patch: Record<string, unknown>) => { const result = await db("PATCH", `?id=eq.${encodeURIComponent(String(claimId))}`, patch); if (!result.ok) throw new Error("database_unavailable"); }; // CM-PZ-34332-HOST-1030
    for (let attempt = 0; attempt < 2; attempt++) { // CM-PZ-34332-HOST-1030
      let response: Response; let data: Record<string, unknown> = {}; // CM-PZ-34332-HOST-1030
      try { // CM-PZ-34332-HOST-1030
        response = await deps.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${account}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: mdn, MessagingServiceSid: service, Body: partnerReceiptBody({ brand, amount: body.amount as number | undefined, carrier: typeof body.carrier === "string" ? body.carrier.trim() : undefined, last4, lang: body.lang === "es" ? "es" : "en" }) }), signal: AbortSignal.timeout(5000) }); // CM-PZ-34332-HOST-1030
        data = await response.json().catch(() => ({})); // CM-PZ-34332-HOST-1030
      } catch (error) { // CM-PZ-34332-HOST-1030
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"); // CM-PZ-34332-HOST-1030
        if (timedOut && attempt === 0) continue; await release(); // CM-PZ-34332-HOST-1030
        if (!orderId) await save({ error_code: timedOut ? "timeout" : "network_error" }); // CM-PZ-34332-HOST-1030
        return reply(timedOut ? 504 : 502, { ok: false, error: timedOut ? "timeout" : "twilio_error" }); // CM-PZ-34332-HOST-1030
      } // CM-PZ-34332-HOST-1030
      const errorCode = /^\d{1,8}$/.test(String(data.code ?? "")) ? String(data.code) : `http_${response.status}`; // CM-PZ-34332-HOST-1030
      if (errorCode === "21610") { preserveClaim = true; await save({ status: "opted_out", error_code: "21610" }); return reply(200, { ok: true, status: "opted_out", error_code: "21610" }); } // CM-PZ-34332-HOST-1030
      if (response.ok && typeof data.sid === "string" && /^SM[a-fA-F0-9]{32}$/.test(data.sid)) { preserveClaim = true; await save({ sid: data.sid, status: orderId ? "sent" : "warn_no_order_id" }); return reply(200, { ok: true, sid: data.sid }); } // CM-PZ-34332-HOST-1030
      if (response.status >= 500 && response.status <= 599 && attempt === 0) continue; // CM-PZ-34332-HOST-1030
      await release(); if (!orderId) await save({ error_code: errorCode }); return reply(502, { ok: false, error: "twilio_error", error_code: errorCode }); // CM-PZ-34332-HOST-1030
    } // CM-PZ-34332-HOST-1030
    return reply(502, { ok: false, error: "twilio_error" }); // CM-PZ-34332-HOST-1030
  } catch { try { await release(); } catch { /* No full phone, provider text or credentials are logged. */ } return reply(503, { ok: false, error: "service_unavailable" }); } // CM-PZ-34332-HOST-1030
} // CM-PZ-34332-HOST-1030
if (runtime) runtime.serve(request => handlePartnerReceipt(request)); // CM-PZ-34332-HOST-1030