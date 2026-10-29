import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2"; // LYCA-SKU-FIX-1024
import { scoreRisk, riskEngineMode } from "../_shared/riskLogic.ts"; // FRAUD-MULTIBLOCK-1012 5b
import { vzGuardGate } from "../_shared/vzPrepaidGuard.ts"; // VZ-PREPAID-GUARD-1017
import { tmoGuardGate } from "../_shared/tmoRetryGuard.ts"; // TMO-LOOKUP-1020
import { raceNull } from "../_shared/raceNull.ts"; // DB-OUTAGE-TRACK-1017
import { ultraHealth } from "../_shared/ultraSmart.ts"; // ULTRA-SMART-PREVENT-1024
import { memdupKey, memdupCheck, memdupUpdate, type MemdupEntry } from "../_shared/memdup.ts"; // DB-OUTAGE-TRACK-1017
import { categorizeLoadText, isCcRefundBody } from "../_shared/loadTextCategory.ts"; // LOADTEXT-PICK-1019
const MEMDUP = new Map<string, MemdupEntry>(); // DB-OUTAGE-TRACK-1017
function waitUntilSafe(p: Promise<unknown>): void { try { const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime; if (rt && typeof rt.waitUntil === "function") rt.waitUntil(p); } catch { /* ignore */ } } // DB-OUTAGE-TRACK-1017

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_BASE = "https://api.cellpay.us/api";
const FALLBACK_DOMAIN = "www.cellpay.us";
// Lovable preview/dev hosts that should always fall back to the production domain
const FALLBACK_HOST_SUFFIXES = ["lovable.dev", "lovable.app", "lovableproject.com", "localhost"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  return out ? out : null;
}

function numberText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : null;
}

async function callDatabaseRpc(name: string, payload: Record<string, unknown>, timeoutMs?: number): Promise<unknown> { // DB-OUTAGE-TRACK-1017
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Database credentials not configured");

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    ...(timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(timeoutMs) }), // DB-OUTAGE-TRACK-1017
  });

  if (!res.ok) {
    throw new Error(`${name} failed: ${await res.text()}`);
  }

  const responseText = await res.text();
  return responseText ? JSON.parse(responseText) : null;
}

// ---------------------------------------------------------------------------
// [ARB-LOG] Auto Pay / Save card / login / language facts on every checkout log row (Parvez, Oct 4 2026). Read-only copies into
// transaction_logs.metadata: the request sent to CellPay, the reply to the browser and every guard are unchanged. Never throws.
// Key names follow Callingmart's AP1 (autopay, autopay_agreement_sent, save_cc_sent, lang, logged_in, bearer_present).
// - autopay / autopay_agreement_sent / save_cc_sent = payment.autopay / payment.autopay_agreement / payment.save_cc exactly as
//   sent: a boolean is stored as is; a missing key stays absent; any other value is stored as null plus <key>_type
//   ("string", "number", "null", "object" or "array"). The value itself is never coerced or copied.
// - root_autopay / root_autopay_agreement / root_subscriber_arb: the API's top-level aliases autopay / autopay_agreement /
//   subscriberARB, same rule (the site does not send them today).
// - logged_in = bearer_present = the request carries a non-empty bearerToken. Only the boolean is stored, never the token.
// - lang: top-level body.lang when it is exactly "en" or "es" (sent by the site after ARB-L1); otherwise absent.
// - arb_log: 1 on every row written by this build (lets the watch tell old and new rows apart).
// Never card data, CVV, tokens, emails or phone numbers.
// ---------------------------------------------------------------------------
function arbFlag(out: Record<string, unknown>, key: string, v: unknown): void {
  if (v === undefined) return;
  if (typeof v === "boolean") { out[key] = v; return; }
  out[key] = null;
  out[`${key}_type`] = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
}

function arbLogMeta(payload: Record<string, unknown>, bearerToken: unknown, lang: unknown): Record<string, unknown> {
  try {
    const payment = asRecord(payload.payment);
    const m: Record<string, unknown> = { arb_log: 1 };
    arbFlag(m, "autopay", payment.autopay);
    arbFlag(m, "autopay_agreement_sent", payment.autopay_agreement);
    arbFlag(m, "save_cc_sent", payment.save_cc);
    arbFlag(m, "root_autopay", payload.autopay);
    arbFlag(m, "root_autopay_agreement", payload.autopay_agreement);
    arbFlag(m, "root_subscriber_arb", payload.subscriberARB);
    const present = typeof bearerToken === "string" && bearerToken.trim() !== "";
    m.logged_in = present;
    m.bearer_present = present;
    if (lang === "en" || lang === "es") m.lang = lang;
    return m;
  } catch {
    return { arb_log: 1, arb_log_error: true };
  }
}

// [ADS-FOLLOWUPS-1008] Google Ads click IDs from the site's top-level body.click_ids (never part of the payload sent to CellPay).
// Only gclid / gbraid / wbraid, each kept only when it is 1-512 characters of A-Z a-z 0-9 _ . ~ - ; anything else is dropped.
// IDs only (no other data). Saved by log_transaction_attempt into transaction_logs.gclid / gbraid / wbraid. Never throws.
const CLICK_ID_RE = /^[A-Za-z0-9_.~-]{1,512}$/;
function clickIdsFrom(v: unknown): Record<string, string> {
  const r = asRecord(v);
  const out: Record<string, string> = {};
  for (const k of ["gclid", "gbraid", "wbraid"]) {
    const x = r[k];
    if (typeof x === "string" && CLICK_ID_RE.test(x)) out[k] = x;
  }
  return out;
}

// [AI-REFERRALS-1010b] Where the visit came from, from the site's top-level body.visit_source (never part of the payload sent to CellPay).
// Only ref_host (referrer hostname), utm_source and landing_path (no query string), each kept only when well-formed; anything else is
// dropped. Stored in transaction_logs.metadata only (no schema change). No click IDs, no personal data. Never throws; absent = nothing stored.
const VS_HOST_RE = /^[a-z0-9.-]{1,100}$/;
const VS_SRC_RE = /^[a-z0-9._: -]{1,60}$/;
const VS_PATH_RE = /^\/[A-Za-z0-9._~\/%-]{0,199}$/;
function visitSourceMeta(v: unknown): Record<string, string> {
  try {
    const r = asRecord(v);
    const out: Record<string, string> = {};
    if (typeof r.ref_host === "string" && VS_HOST_RE.test(r.ref_host)) out.ref_host = r.ref_host;
    if (typeof r.utm_source === "string" && VS_SRC_RE.test(r.utm_source)) out.utm_source = r.utm_source;
    if (typeof r.landing_path === "string" && VS_PATH_RE.test(r.landing_path)) out.landing_path = r.landing_path;
    for (const k of ["gad_source", "gad_campaignid"]) { const x = r[k]; if (typeof x === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x)) out[k] = x; } // CP-PROFIT-COVERAGE-1023
    if (r.click_id_source === "url" || r.click_id_source === "cookie") out.click_id_source = r.click_id_source; // CP-PROFIT-COVERAGE-1023
    return out;
  } catch {
    return {};
  }
}

// [OURSIDE-RETRY-1012] Retry context from the site's top-level body.retry_meta (never sent to CellPay): booleans and a method word only.
const ORS_METHOD_RE = /^[a-z]{2,20}$/;
function retryMetaFrom(v: unknown): Record<string, unknown> {
  try {
    const r = asRecord(v);
    const out: Record<string, unknown> = {};
    for (const k of ["retry_after_data_err", "method_switched", "retry_offered", "retry_clicked"]) if (r[k] === true) out[k] = true;
    if (r.retry_after_data_err === true && r.method_switched === false) out.method_switched = false;
    if (typeof r.prior_failed_method === "string" && ORS_METHOD_RE.test(r.prior_failed_method)) out.prior_failed_method = r.prior_failed_method;
    if (typeof r.decline_ab === "string" && (r.decline_ab === "control" || r.decline_ab === "variant")) out.decline_ab = r.decline_ab; // DECLINE-AB-1016
    // FUNDS-DECLINE-1016: allow-listed recovery metadata only; never sent to CellPay.
    if (r.decline_cls === "nsf") out.decline_cls = "nsf";
    if (r.funds_ui === "v1") out.funds_ui = "v1";
    for (const k of ["klarna_offered", "klarna_clicked", "klarna_auth_declined"]) if (typeof r[k] === "boolean") out[k] = r[k];
    if (r.klarna_src === "decline_nsf" || r.klarna_src === "decline_other" || r.klarna_src === "method_list") out.klarna_src = r.klarna_src; // KLARNA-FUNNEL-1017
    if (r.retry_src === "refund_retry") { out.retry_src = "refund_retry"; if (typeof r.retry_from_carrier === "string" && /^[a-z0-9-]{1,30}$/.test(r.retry_from_carrier)) out.retry_from_carrier = r.retry_from_carrier; if (typeof r.retry_action === "string" && /^(to_carrier|amount|number|try_again|other_carrier)$/.test(r.retry_action)) out.retry_action = r.retry_action; if (typeof r.retry_cause === "string" && /^(tmo_plan_mismatch|simple_not_found|metro_invalid_number|boost_blank)$/.test(r.retry_cause)) out.retry_cause = r.retry_cause; } // REFUND-RETRY-1018
    if (r.retry_src === "refund_retry" && r.retry_stage === "late") out.retry_stage = "late"; // REFUND-RETRY-LATE-1018
    return out;
  } catch {
    return {};
  }
}

// CONSENT-EVERY-ATTEMPT-1016: record checkout consent on the attempt's log row in the background. Never blocks, never throws, never sent to CellPay.
function consentPatchLater(id: string | null, v: unknown): void {
  try {
    if (!id) return;
    const r = asRecord(v);
    if (r.mkt_consent !== true) return;
    const bl = typeof r.browser_language === "string" && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(r.browser_language.slice(0, 35)) ? r.browser_language.slice(0, 35) : null;
    void Promise.race([
      callDatabaseRpc("record_attempt_marketing_opt_in", { _id: id, _browser_language: bl }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 3000)),
    ]).catch((e) => console.error("[tx-log] consent patch failed:", e instanceof Error ? e.message : e));
  } catch { /* ignore */ }
}

// [OURSIDE-RETRY-1012] CellPay "data error" replies: masked outgoing details on the failed log row (lengths / flags only;
// no card data, no tokens, no names, no address text). Merged atomically into metadata; never throws.
const DATA_ERR_RE = /Validation failed|One or more fields in the request contains invalid data/i;
async function logDataErr(id: string | null, payload: Record<string, unknown>, wrapped: Record<string, unknown>, paymentMethod: string | null | undefined): Promise<void> {
  try {
    if (!id) return;
    const r = unwrapTransactionResult(wrapped);
    const msg = String(r.msg ?? r.message ?? wrapped.error ?? "");
    if (!DATA_ERR_RE.test(msg)) return;
    const pay = asRecord(payload.payment);
    const bill = asRecord(payload.billing);
    const pick = (...vals: unknown[]): string => { for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim(); return ""; };
    const fn = pick(pay.firstName, payload.first_name, pay.first_name, pay.firstname, bill.first_name);
    const ln = pick(pay.lastName, payload.last_name, pay.last_name, pay.lastname, bill.last_name);
    const em = pick(payload.email, pay.email);
    const ad = pick(pay.address, payload.address, bill.street, bill.address, bill.street_address);
    const zp = pick(pay.zip, payload.zip, bill.zip, bill.postal_code);
    const ci = pick(pay.city, payload.city, bill.city);
    const st = pick(pay.state, payload.state, bill.state);
    const apc = cardFactJson(payload.apple_pay_billing_contact); const apt = asRecord(cardFactJson(payload.apple_pay_token).paymentMethod); // APPLEPAY-DISCOVER-1016 (display fields only, never paymentData)
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const patch = {
      data_err_payload: {
        carrier_id: text(payload.carrierId ?? payload.carrier_id), plan_id: text(payload.plan_id), amount: num(payload.amount),
        payment_method: paymentMethod ?? null,
        first_name_len: fn.length, last_name_len: ln.length, name_has_non_ascii: /[^\x20-\x7E]/.test(fn + ln),
        email_len: em.length, address_len: ad.length, address_present: ad.length > 0, zip_present: zp.length > 0, zip_len: zp.length,
        city_len: ci.length, state: /^[A-Za-z]{2}$/.test(st) ? st.toUpperCase() : null,
        amount_raw_type: typeof payload.amount, amount_str: String(payload.amount ?? "").slice(0, 12),
        ap_network: text(apt.network), ap_funding: text(apt.type),
        ap_contact_has_lines: Array.isArray(apc.addressLines) && apc.addressLines.length > 0, ap_contact_zip_len: String(apc.postalCode ?? "").length, ap_contact_country: text(apc.countryCode), ap_contact_name_len: (String(apc.givenName ?? "") + String(apc.familyName ?? "")).length, // APPLEPAY-DISCOVER-1016
      },
      data_err_msg_shown: true,
    };
    await Promise.race([
      callDatabaseRpc("tx_log_meta_merge", { _id: id, _patch: patch }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 1500)),
    ]);
  } catch (e) {
    console.error("[tx-log] data_err meta failed:", e instanceof Error ? e.message : e);
  }
}

async function createTransactionLog(
  payload: Record<string, unknown>,
  callerHost: string | undefined,
  userAgent: string | null,
  arb: Record<string, unknown> = {},
  clicks: Record<string, string> = {},
  mfMeta: Record<string, unknown> = {}, // [FRAUD-MULTIBLOCK-1012] mf_* keys only (never a PAN)
  timeoutMs?: number, // DB-OUTAGE-TRACK-1017
): Promise<string | null> {
  const payment = asRecord(payload.payment);
  try {
    const id = await callDatabaseRpc("log_transaction_attempt", {
      _data: {
        carrier_name: text(payload.carrier_name ?? payload.carrierName),
        carrier_slug: text(payload.carrier_slug ?? payload.carrierSlug),
        carrier_id: text(payload.carrierId ?? payload.carrier_id),
        plan_id: text(payload.plan_id ?? payload.planId),
        phone_number: text(payload.phone_number ?? payload.phoneNumber),
        email: text(payment.email ?? payload.email),
        first_name: text(payment.firstName ?? payment.first_name ?? payload.first_name),
        last_name: text(payment.lastName ?? payment.last_name ?? payload.last_name),
        amount: numberText(payload.amount),
        total: numberText(payload.total),
        payment_method: text(payload.payment_method ?? payload.paymentMethod),
        card_type: text(payload.ctype ?? payload.card_type),
        source_ip: text(payload.source),
        user_agent: userAgent,
        ...clicks, // [ADS-FOLLOWUPS-1008] gclid / gbraid / wbraid only when present and well-formed
        metadata: {
          caller_host: text(callerHost),
          checkout_session_id: text(payload.kount_ssid ?? payload.riskified_sessionid ?? payload.cbsys_sessionid),
          ...arb, // [ARB-LOG] arbLogMeta() keys only
          // [FP-IDLE-1007] booleans only (no visitorId stored): did the payment carry a FingerprintJS visitorId / time out
          ...((): Record<string, boolean> => {
            try {
              const b = asRecord(JSON.parse(String(payload.browser_info ?? "{}")));
              return { fp_visitor: !!text(b.visitorId), fp_timeout: b.fp_timeout === true };
            } catch {
              return { fp_visitor: false, fp_timeout: false };
            }
          })(),
          ...mfMeta, // [FRAUD-MULTIBLOCK-1012] mf_device, mf_did, mf_card (BIN6:last4), mf_card_fp, mf_addr, mf_addr_h, mf_ip
        },
      },
    }, timeoutMs); // DB-OUTAGE-TRACK-1017
    return typeof id === "string" ? id : null;
  } catch (error) {
    console.error("[tx-log] create failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// SUCCESS-FLAG-FIX-1016: inspect the full parsed upstream body; markers contain no customer/payment values.
const REFUND_FAILURE_MESSAGE = "There was some error during refill. This transaction has been auto refunded.";
function refundSignal(body: unknown): string | null {
  if (asRecord(body).parseError === true || asRecord(asRecord(body).data).parseError === true) return null;
  const failureText = /auto[\s-]?refund|refunded|refund status|error during refill|invalid (phone )?number|invalid plan|invalid amount|plan does not match|prepaid_number|not qualify/i;
  const visit = (value: unknown): string | null => {
    if (typeof value === "string") return value.match(failureText)?.[0].toLowerCase() ?? null;
    if (!value || typeof value !== "object") return null;
    for (const [key, item] of Object.entries(value)) {
      if (/^Result$/i.test(key) && String(item).trim().toLowerCase() !== "success") return "Result:not_success";
      if (/^TransResult$/i.test(key) && String(item).trim().toLowerCase() !== "ok") return "TransResult:not_ok";
      const marker = visit(item);
      if (marker) return marker;
    }
    return null;
  };
  const root = asRecord(body); // SUCCESS-FLAG-FIX-1016: support both direct and success/data-wrapped upstream replies.
  const data = asRecord(root.data);
  return visit(body) ?? (asRecord(data.data).status === false || (root.status !== undefined && data.status === false) ? "data.data.status:false" : null);
}

// SUCCESS-FLAG-FIX-1016: preserve ordinary failures and successful replies exactly; only override apparent success.
function refundSuccessMarker(wrapped: Record<string, unknown>): string | null {
  if (wrapped.success !== true) return null;
  const upstream = asRecord(wrapped.data);
  const result = unwrapTransactionResult(wrapped);
  const successStatus = (status: unknown) => status === true || ["true", "success", "completed"].includes(String(status ?? "").toLowerCase());
  if (!successStatus(upstream.status) && !successStatus(result.status) && !(upstream.success === true && text(result.transactionId ?? result.transaction_id))) return null;
  return refundSignal(upstream);
}

// LOADTEXT-REASON-1017 (REFUNDED-STATE-1017): CellPay's load-failure reason from the ORIGINAL parsed body (top level, then
// body.data). Keys LoadText / load_text / LoadMessage in any case. First non-empty string (trimmed, max 500) or null. Never throws.
function extractLoadText(body: unknown): string | null {
  try {
    const root = asRecord(body);
    if (root.parseError === true) return null;
    for (const obj of [root, asRecord(root.data), asRecord(asRecord(root.data).data)]) { // LOADTEXT-PICK-1019: + body.data.data
      for (const [k, v] of Object.entries(obj)) {
        if (/^(loadtext|load_text|loadmessage)$/i.test(k) && typeof v === "string" && v.trim()) return v.trim().slice(0, 500);
      }
    }
  } catch { /* never throws */ }
  return null;
}

// REFUNDED-STATE-1017: crash / timeout reply where the charge outcome is unknown. HTTP 200 "Backend exception" is now treated as outcome unknown. // BACKEND-EXC-1019
function chargeUnconfirmedKind(status: number, data: unknown, wrapped: Record<string, unknown>): "http5xx" | "html" | "sqlstate" | "backend_exc" | null { // BACKEND-EXC-1019
  const d = asRecord(data);
  const inner = asRecord(d.data);
  const texts = [d.message, d.error, d.msg, wrapped.error, inner.message, inner.error, inner.msg].filter((t): t is string => typeof t === "string");
  if (status < 500 && texts.some((t) => /backend exception/i.test(t))) return "backend_exc"; // BACKEND-EXC-1019
  if (status >= 500) return "http5xx";
  if (d.parseError === true) return "html";
  if (texts.some((t) => /SQLSTATE/i.test(t))) return "sqlstate";
  return null;
}

function isDbFormatError(data: unknown, wrapped: Record<string, unknown>): boolean { // NAME-SANITIZE-1018B
  const d = asRecord(data); const inner = asRecord(d.data); // NAME-SANITIZE-1018B
  const texts = [d.message, d.error, d.msg, wrapped.error, inner.message, inner.error, inner.msg].filter((t): t is string => typeof t === "string"); // NAME-SANITIZE-1018B
  return texts.some((t) => /SQLSTATE\[(22007|22021)\]|Incorrect string value/i.test(t)); // NAME-SANITIZE-1018B
} // NAME-SANITIZE-1018B
// REFUNDED-STATE-1017: the original upstream reply is a failure whose message says it was auto-refunded.
function autoRefundFailure(wrapped: Record<string, unknown>): boolean {
  const data = asRecord(wrapped.data);
  if (data.parseError === true) return false;
  const result = unwrapTransactionResult(wrapped);
  const st = String(result.status ?? "").toLowerCase();
  if (wrapped.success === true && (result.status === true || st === "true" || st === "success" || st === "completed")) return false;
  if (isCcRefundBody(data)) return true; // LOADTEXT-PICK-1019: TransResult ccRefund = auto refunded
  const msg = text(result.message ?? result.msg ?? data.message ?? data.msg ?? wrapped.error);
  return msg !== null && /auto[\s-]?refund/i.test(msg);
}

// REFUNDED-STATE-1017: post-finalize RPC, 1500 ms cap, fail-open (console.error only); never changes the reply.
async function rpcSoon(name: string, args: Record<string, unknown>): Promise<void> {
  try {
    await Promise.race([
      callDatabaseRpc(name, args),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 1500)),
    ]);
  } catch (e) {
    console.error(`[tx-log] ${name} failed:`, e instanceof Error ? e.message : e);
  }
}

// RAW-REPLY-LOG-1022: redacted, size-capped copy of CellPay's raw refill reply for failed / auto-refunded orders. Never throws.
const RAW_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|password|passwd|auth|cvv|cvc|cvv2|card_?num|cardnumber|ccnum|cc_?number|pan$|^pan|expir|exp_?(month|year|date)|^exp$|security_?code|track_?data|nonce|cryptogram|signature/i; // RAW-REPLY-LOG-1022
function redactRawReply(v: unknown, depth = 0): unknown { // RAW-REPLY-LOG-1022
  if (depth > 12) return "[depth]";
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => redactRawReply(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = RAW_SECRET_KEY_RE.test(k) ? "[redacted]" : redactRawReply(x, depth + 1);
    return out;
  }
  if (typeof v === "string") return v.replace(/\b\d{13,19}\b/g, "[redacted]"); // card-number-like digit runs
  return v;
}
function buildRawReplyPatch(data: unknown): Record<string, unknown> | null { // RAW-REPLY-LOG-1022
  try {
    const red = redactRawReply(data);
    const s = JSON.stringify(red) ?? "null";
    const CAP = 16 * 1024;
    if (s.length <= CAP) return { cellpay_raw_reply: red };
    return { cellpay_raw_reply: { truncated: true, original_length: s.length, json_prefix: s.slice(0, CAP - 200) } };
  } catch { return null; }
}

// REFUNDED-STATE-1017: BAD_PHONE guard (digits must be a 10-digit US number).
function phoneOk10(p: Record<string, unknown>): boolean {
  const d = String(p.phone_number ?? p.phoneNumber ?? "").replace(/\D/g, "");
  return /^[2-9][0-9]{9}$/.test(d);
}

function unwrapTransactionResult(wrapped: Record<string, unknown>): Record<string, unknown> {
  let result = asRecord(wrapped.data) || wrapped;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    result = asRecord(result.data);
  }
  return result;
}

async function finishTransactionLog(
  id: string | null,
  wrapped: Record<string, unknown>,
  paymentMethod?: string | null,
  timeoutMs?: number, // DB-OUTAGE-TRACK-1017
) {
  if (!id) return;
  const result = unwrapTransactionResult(wrapped);
  const status = result.status;
  const isSuccess = wrapped.success === true && (
    status === true || status === "true" ||
    String(status || "").toLowerCase() === "success" ||
    String(status || "").toLowerCase() === "completed"
  );

  // For Pockyt (Cash App), the initial /checkout/transaction response returns
  // a HostedURL and no completed payment yet. Keep the log as 'pending' until
  // the customer returns from the hosted flow and the session status confirms
  // the final outcome.
  const resultInner = asRecord(result.data); // [CASHAPP-LOG-1007 v2] CellPay nests the Pockyt HostedURL one level deeper
  const hostedUrl = (result.HostedURL || result.hostedUrl || result.hosted_url || resultInner.HostedURL || resultInner.hostedUrl || resultInner.hosted_url) as string | undefined;
  // [CASHAPP-LOG-1007] A Cash App session with a HostedURL is never a confirmed payment, even when CellPay says "success"
  // at session create: always leave it 'pending'. cashapp-settlement-sweep (enforce) / the return poll set success|failed.
  if ((paymentMethod || "").toLowerCase() === "pockyt" && hostedUrl) {
    // [CASHAPP-STUCK-1007] Still 'pending', but the create reply (data.pockyt_session_id + HostedURL) is now saved on the row so
    // cashapp-settlement-sweep can check it and the browser settle merges into it. No hashid/txn yet. Never throws; reply unchanged.
    try {
      await callDatabaseRpc("finalize_transaction_log", {
        _id: id, _status: "pending", _hashid: null, _transaction_id: null, _error_message: null, _raw_response: result,
      }, timeoutMs); // DB-OUTAGE-TRACK-1017
    } catch (error) {
      console.error("[tx-log] pockyt pending save failed:", error instanceof Error ? error.message : error);
    }
    return; // leave as pending
  }

  try {
    await callDatabaseRpc("finalize_transaction_log", {
      _id: id,
      _status: isSuccess ? "success" : "failed",
      _hashid: text(result.hashid ?? result.id),
      _transaction_id: text(result.transactionId ?? result.transaction_id),
      _error_message: isSuccess ? null : text(result.msg ?? result.message ?? wrapped.error),
      _raw_response: result,
    }, timeoutMs); // DB-OUTAGE-TRACK-1017
  } catch (error) {
    console.error("[tx-log] finalize failed:", error instanceof Error ? error.message : error);
  }
}

// [CASHAPP-STUCK-1007] The Cash App create call to CellPay threw or passed POCKYT_CREATE_TIMEOUT_MS: close the pending log row as
// 'failed' (error_message 'timeout' | 'cashapp_create_error') so it is never left open. Not final: a later paid answer for this
// row still flips it to success (finalize_pockyt_log). 2 s budget; never throws.
const POCKYT_CREATE_TIMEOUT_MS = 30000;
async function markPockytCreateError(id: string | null, error: unknown): Promise<void> {
  if (!id) return;
  const name = error instanceof Error ? error.name : "";
  const kind = name === "TimeoutError" || name === "AbortError" ? "timeout" : "cashapp_create_error";
  try {
    await Promise.race([
      callDatabaseRpc("finalize_transaction_log", {
        _id: id, _status: "failed", _hashid: null, _transaction_id: null, _error_message: kind,
        _raw_response: { pockyt_create_error: kind, error_name: name ? name.slice(0, 40) : null },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 2000)),
    ]);
  } catch (e) {
    console.error("[tx-log] pockyt create-error finalize failed:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------------------
// [CARDLOG-1007] Logging-only card facts for Fraud & QA (Parvez, Oct 7 2026). One row per logged checkout in
// transaction_card_facts (rpc log_card_facts), linked to transaction_logs.id. Stores BIN (first 6), last 4, brand, billing
// country/ZIP, CellPay's CCTransactionId, the decline text, and auth/AVS/CVV/3DS result codes only when the response carries
// them. NEVER the full PAN, the expiry, or the CVV. Runs after the log is finalized; 800 ms timeout; never throws; the request
// sent to CellPay and the reply to the browser are unchanged.
// ---------------------------------------------------------------------------
function cardFactPick(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim().slice(0, 64);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function cardFactJson(v: unknown): Record<string, unknown> {
  if (typeof v !== "string") return asRecord(v);
  try { return asRecord(JSON.parse(v)); } catch { return {}; }
}

async function logCardFacts(id: string | null, payload: Record<string, unknown>, wrapped: Record<string, unknown>, paymentMethod: string | null): Promise<void> {
  try {
    if (!id) return;
    const pay = asRecord(payload.payment);
    const billing = asRecord(payload.billing);
    const method = String(paymentMethod || "").toLowerCase();
    const pan = method.startsWith("card") ? String(pay.cc_number ?? payload.cc_number ?? "").replace(/\D/g, "") : "";
    const result = unwrapTransactionResult(wrapped);
    const st = String(result.status ?? "").toLowerCase();
    const ok = wrapped.success === true && (result.status === true || st === "true" || st === "success" || st === "completed");
    const proc = { ...asRecord(result.data), ...result }; // [CARDLOG-1007 v2] CellPay nests CCTransactionId one level deeper
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    // [CARDLOG-1007 v3] Wallets: only Apple Pay's display fields (network / type / "Visa 1234") and the billing contact's
    // country + ZIP are read. The encrypted paymentData, Google Pay token and Klarna token are never read or stored.
    let walletBrand: string | null = null, walletLast4: string | null = null, walletFunding: string | null = null;
    let country = text(billing.country_id ?? pay.country), zipRaw: unknown = pay.zip;
    if (method === "applepay") {
      const pm = asRecord(cardFactJson(payload.apple_pay_token).paymentMethod);
      walletBrand = text(pm.network);
      walletFunding = text(pm.type);
      const m = /(\d{4})\s*$/.exec(String(pm.displayName ?? ""));
      walletLast4 = m ? m[1] : null;
      const bc = cardFactJson(payload.apple_pay_billing_contact);
      country = text(bc.countryCode) ?? country; zipRaw = bc.postalCode;
    } else if (method === "googlepay") {
      const ba = cardFactJson(payload.gpay_billing_details);
      country = text(ba.countryCode) ?? country; zipRaw = ba.postalCode;
    }
    const zip = String(zipRaw ?? "").replace(/[^0-9A-Za-z]/g, "").slice(0, 10);
    const facts = {
      transaction_log_id: id,
      payment_method: text(paymentMethod),
      outcome: ok ? "success" : "failed",
      card_bin: pan.length >= 12 ? pan.slice(0, 6) : null,
      card_bin8: pan.length >= 16 ? pan.slice(0, 8) : null, // [v3] 8-digit BIN only for 16+ digit PANs (PCI first-8/last-4)
      card_last4: pan.length >= 12 ? pan.slice(-4) : walletLast4,
      card_brand: method.startsWith("card") ? text(pay.cc_type ?? payload.ctype ?? payload.card_type) : walletBrand,
      card_funding: walletFunding,
      processor_txn_id: cardFactPick(proc, ["CCTransactionId", "ccTransactionId", "cc_transaction_id", "processor_transaction_id"]),
      billing_country: country,
      billing_zip: zip || null,
      decline_message: ok ? null : text(result.msg ?? result.message ?? wrapped.error),
      cellpay_transaction_id: text(result.transactionId ?? result.transaction_id),
      cellpay_hashid: text(result.hashid),
      facts_version: 3,
    };
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/log_card_facts`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({ _data: facts }),
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) console.warn(`[cardlog] insert failed: ${res.status}`);
  } catch (error) {
    console.warn("[cardlog] skipped:", error instanceof Error ? error.name : "error");
  }
}

/**
 * Derive the registrable ("top") domain from a hostname (e.g. "recharge.cellpay.us" -> "cellpay.us").
 * Falls back to FALLBACK_DOMAIN for lovable preview / dev hosts or invalid input.
 */
function resolveCellpayDomain(host: string | undefined | null): string {
  if (!host || typeof host !== "string") return FALLBACK_DOMAIN;
  const cleaned = host.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  if (!cleaned) return FALLBACK_DOMAIN;
  if (FALLBACK_HOST_SUFFIXES.some((s) => cleaned === s || cleaned.endsWith(`.${s}`))) {
    return FALLBACK_DOMAIN;
  }
  // Use the full hostname as-is (e.g. "recharge.cellpay.us")
  return cleaned;
}


// ---------------------------------------------------------------------------
// [proxy-guard 1a] Guard in front of the forwarding logic only. The
// transaction-log helpers above (callDatabaseRpc, createTransactionLog,
// finishTransactionLog) and the logging / Pockyt finalize code inside serve()
// are unchanged.
// ---------------------------------------------------------------------------
const GUARD_VERSION = "1a";

type GuardCode =
  | "invalid_request"
  | "invalid_endpoint"
  | "retired"
  | "not_allowed"
  | "origin_missing"
  | "origin_not_allowed";

const GUARD_MESSAGES: Record<GuardCode, string> = {
  invalid_request: "Invalid request.",
  invalid_endpoint: "This request is not allowed.",
  retired: "This service is not available online. Please contact support@getcellpay.com.",
  not_allowed: "This request is not allowed.",
  origin_missing: "This request is not allowed.",
  origin_not_allowed: "This request is not allowed.",
};

/** Percent-decode up to 3 times; stops at the first malformed escape. */
function guardDecode(raw: string): string {
  let p = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const d = decodeURIComponent(p);
      if (d === p) break;
      p = d;
    } catch {
      break;
    }
  }
  return p;
}

interface NormalizedEndpoint { segments: string[]; rawSegments: string[] }

/**
 * Ported from Callingmart's live guard (c667aa0b). Returns null for anything that could
 * leave its path: control/space characters, \ # @ ; ?, an encoded "/", leftover %xx after
 * 3 decodes, empty / "." / ".." segments, or more than 400 characters.
 * CellPay's live site never sends a query string, so "?" is always refused.
 */
function normalizeEndpoint(raw: string): NormalizedEndpoint | null {
  if (raw.length === 0 || raw.length > 400) return null;
  if (/[\u0000-\u0020\u007f\\#@?;]/.test(raw)) return null;
  let path = raw;
  for (let i = 0; i < 3; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return null;
    }
    if (decoded === path) break;
    path = decoded;
  }
  if (/%[0-9a-f]{2}/i.test(path)) return null;
  if (/[\u0000-\u0020\u007f\\#@?;]/.test(path)) return null;
  const segments = path.toLowerCase().split("/");
  const rawSegments = raw.split("/");
  if (segments.length !== rawSegments.length) return null; // an encoded "/" is never accepted
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;
  return { segments, rawSegments };
}

/** transactions/last and autopay/* are retired for every caller (phone-only lookups are never proxied). */
function isRetiredEndpoint(raw: string): boolean {
  const d = guardDecode(raw).toLowerCase();
  return d.includes("autopay") || /transactions[\/\\]+(\.[\/\\]+)*last/.test(d);
}

// ---------------------------------------------------------------------------
// [autopay AP-1] Self-serve Auto Pay cancel, restored on ONE route only:
// POST "autopay/unsubscribe" with payload exactly { phone: "<10 digits>" } (the old cellpay.us call).
// Extra, invisible checks in front of it: production Origin only, per-IP (Fix D) and per-phone rate
// limits (HMAC'd buckets), ownership = phone + (checkout email OR last 4 of the Order ID) matched against
// transaction_logs (rpc ap1_owner_match -> row id or null), and Turnstile in SHADOW mode (logged, never blocks).
// A match whose CellPay call fails (5xx, timeout, network, non-JSON, error body) is queued in autopay_cancel_retry
// (rpc ap1_retry_record: transaction_logs id + failure kind + HTTP status only) so it is never lost.
// Every verification outcome gets the SAME neutral reply, padded to the same minimum time. The upstream
// body is never passed through. transactions/last and every other autopay/* path stay 403 "retired".
// Logs: PII-free rows in proxy_guard_events (code "ap1:*"); no phone, email, Order ID, IP or token.
// ---------------------------------------------------------------------------
const AP1_ROUTE_ENABLED = true; // one-line kill switch: false sends this route back to 403 "retired"
const AP1_ENDPOINT = "autopay/unsubscribe";
const AP1_ORIGINS = new Set<string>(["https://cellpay.us", "https://www.cellpay.us", "https://refill.cellpay.us"]);
const AP1_HOSTS = new Set<string>(["cellpay.us", "www.cellpay.us", "refill.cellpay.us"]);
// Same constants as 1b's ORIGIN_DOMAIN (each production Origin -> its own host); kept under an ap1 name so it never collides.
const AP1_ORIGIN_DOMAIN: Record<string, string> = {
  "https://cellpay.us": "cellpay.us",
  "https://www.cellpay.us": "www.cellpay.us",
  "https://refill.cellpay.us": "refill.cellpay.us",
};
const AP1_MIN_MS = 2500; // every 200 reply waits at least this long
const AP1_UPSTREAM_TIMEOUT_MS = 2000;
const AP1_RL_TIMEOUT_MS = 2500; // [AP1-RL-1018] rate-limit RPC budget (was 1000 inline; two cancels failed closed on a slow DB moment)
const AP1_LIMITS = { ip: { max: 10, windowS: 3600 }, phone: { max: 5, windowS: 3600 } };
const AP1_TS_MODE: "shadow" = "shadow"; // standing decision: Turnstile only if abuse. Shadow logs, never blocks.
const AP1_TS_ACTION = "autopay_cancel";
const AP1_NEUTRAL = {
  success: true,
  data: {
    status: true,
    code: "AP_REQUEST_RECEIVED",
    msg: "If that number has Auto Pay with us, it's now cancelled. We'll confirm by email.",
  },
};
const AP1_TRY_LATER = {
  success: true,
  data: {
    status: false,
    code: "AP_TRY_LATER",
    msg: "We couldn't take this request right now. Please try again later or email support@getcellpay.com.",
  },
};

// Fix D client IP (same rule as CellPay Fraud's clientIp): CF-Connecting-IP, else the rightmost
// platform-added X-Forwarded-For entry. Never the leftmost entry and never a body field.
// Kept under ap1* names so it never collides with 1b's clientIp/TRUSTED_XFF_HOPS.
const AP1_TRUSTED_XFF_HOPS = Number(Deno.env.get("TRUSTED_XFF_HOPS") ?? "1");
function ap1IsIp(v: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(v) || (/^[0-9a-f:]+$/i.test(v) && v.includes(":"));
}
function ap1ClientIp(req: Request): string | null {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (ap1IsIp(cf)) return cf;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const i = xff.length - AP1_TRUSTED_XFF_HOPS;
  if (i >= 0 && ap1IsIp(xff[i])) return xff[i];
  return null;
}

// [RISK-COVER-IP-1019] Risk-engine client IP: CF-Connecting-IP, else the rightmost PUBLIC X-Forwarded-For entry (never the leftmost,
// which the client can set; never a body field). src is logged on risk_decisions.ip_src; cf-ipcountry (if present) as a fallback country.
function riskIsPrivateIp(ip: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) || /^(::1$|f[cd]|fe[89ab])/i.test(ip);
}
function riskClientIp(req: Request): { ip: string | null; src: string; country: string | null } {
  const cc = (req.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  const country = /^[A-Z][A-Z0-9]$/.test(cc) && cc !== "XX" ? cc : null;
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (ap1IsIp(cf)) return { ip: cf, src: "cf", country };
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = xff.length - 1; i >= 0; i--) {
    if (ap1IsIp(xff[i]) && !riskIsPrivateIp(xff[i])) return { ip: xff[i], src: i === 0 ? "xff_first" : `xff_r${xff.length - 1 - i}`, country };
  }
  return { ip: null, src: "none", country };
}

// AP-1's own event writer: same table and fetch shape as recordGuardEvent, but its OWN per-isolate cap so AP-1
// traffic can never crowd out 1a/Fraud refusal rows. guard_version "ap1". Fire-and-forget, never throws.
const AP1_EVENT_CAP_PER_MINUTE = Number(Deno.env.get("AP1_EVENT_CAP_PER_MINUTE") ?? "200");
let ap1EventMinute = 0;
let ap1EventsThisMinute = 0;
let ap1EventsDropped = 0;
function ap1Event(code: string, origin: string | null): void {
  try {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== ap1EventMinute) {
      ap1EventMinute = minute;
      ap1EventsThisMinute = 0;
    }
    if (ap1EventsThisMinute >= AP1_EVENT_CAP_PER_MINUTE) {
      ap1EventsDropped++;
      return;
    }
    ap1EventsThisMinute++;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    const droppedBefore = ap1EventsDropped;
    ap1EventsDropped = 0;
    const write = fetch(`${supabaseUrl}/rest/v1/proxy_guard_events`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({
        code, method: "POST", endpoint_shape: AP1_ENDPOINT, origin_host: originHost(origin), has_origin: origin !== null,
        guard_version: "ap1", dropped_before: droppedBefore,
      }),
      signal: AbortSignal.timeout(1500),
    })
      .then((res) => {
        if (!res.ok) console.warn(`[autopay AP-1] event insert failed: ${res.status}`);
      })
      .catch(() => {});
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(write);
  } catch {
    // never let logging affect the reply
  }
}

async function ap1Hash(kind: string, value: string): Promise<string> {
  const key = Deno.env.get("GUARD_HASH_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`ap1|${kind}|${value}`)));
  return `ap1:${kind}:` + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function ap1Rpc(name: string, args: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("db not configured");
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return await res.json();
}

// [AP1-RETRY-1007] Queue write for a matched cancel that CellPay refused or that failed. Runs in the background
// (EdgeRuntime.waitUntil) so the customer's padded neutral reply and its timing are unchanged, with a 3 s budget and one
// retry (the old inline 400 ms budget expired before the write reached the database: no row on Oct 7 18:22 CT).
// ap1_retry_record does not count a second write for the same open row within 10 s as a new attempt, so a slow first
// write that still commits plus the retry give one row. Last resort log line: transaction_log_id + masked phone
// (***last4) only, never the full number. Never throws.
const AP1_RETRY_WRITE_TIMEOUT_MS = 3000;
// [AP1-NOTENROLLED-1009] CellPay's own refusal reason, kept for the alarm: control chars -> space, emails -> [email],
// every digit -> #, spaces collapsed, max 120 chars (ap1_retry_record_v2 applies the same rule again in the database).
function ap1MaskReason(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[^\s@<>"]+@[^\s@<>"]+/g, "[email]").replace(/[0-9]/g, "#")
    .replace(/\s+/g, " ").trim().slice(0, 120).trim();
  return s.length > 0 ? s : null;
}
// "This number has no Auto Pay" answers. Safe default: not_enrolled ONLY when HTTP 200 AND data.status === false (boolean)
// AND the masked reason matches one of these AND it has no transient wording; everything else stays error_body (alarms).
const AP1_NOT_ENROLLED_RE =
  /\b(?:not|isn'?t|is not|no longer)\s+(?:enrolled|subscribed|registered|signed up)\b|\bno\s+(?:active\s+)?(?:auto\s*-?\s*pay|autopay|subscription|recurring)\b|\b(?:auto\s*-?\s*pay|autopay|subscription)\s+(?:not\s+found|does\s*n[o']?t\s+exist|not\s+(?:active|enabled|set\s*up))\b|\bnot\s+an?\s+(?:auto\s*-?\s*pay|autopay)\s+(?:customer|user|number)\b|\balready\s+(?:unsubscribed|cancell?ed)\b/i;
const AP1_TRANSIENT_RE = /\b(?:try\s+again|temporar\w*|time[sd]?\s*out|unavailable|server|internal|exception|database|network|later)\b/i;
function ap1IsNotEnrolled(httpStatus: number, st: unknown, reason: string | null): boolean {
  return httpStatus === 200 && st === false && reason !== null && AP1_NOT_ENROLLED_RE.test(reason) && !AP1_TRANSIENT_RE.test(reason);
}
async function ap1RetryWrite(
  owner: string,
  phone: string,
  fail: { kind: string; status: number | null; reason?: string | null },
  domain: string,
  origin: string | null,
): Promise<void> {
  let reason = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // [AP1-NOTENROLLED-1009] v2 also saves the masked reason and closes a not_enrolled row as done (no alarm).
      const rid = await ap1Rpc("ap1_retry_record_v2", { _log_id: owner, _kind: fail.kind, _status: fail.status, _domain: domain, _reason: fail.reason ?? null }, AP1_RETRY_WRITE_TIMEOUT_MS);
      if (rid !== null && rid !== undefined) {
        ap1Event(fail.kind === "not_enrolled" ? "ap1:retry_closed_not_enrolled" : "ap1:retry_queued", origin);
        return;
      }
      reason = "no_row";
      break; // transaction_logs row not found: a retry can't help
    } catch (e) {
      reason = e instanceof Error ? (e.name === "TimeoutError" || e.name === "AbortError" ? "timeout" : e.message.slice(0, 60)) : "error";
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (reason !== "no_row") {
    // [AP1-NOTENROLLED-1009] fallback = the pre-1009 call (no reason; a not_enrolled answer is queued as error_body, so it alarms).
    try {
      const rid = await ap1Rpc("ap1_retry_record", { _log_id: owner, _kind: fail.kind === "not_enrolled" ? "error_body" : fail.kind, _status: fail.status, _domain: domain }, AP1_RETRY_WRITE_TIMEOUT_MS);
      if (rid !== null && rid !== undefined) {
        ap1Event("ap1:retry_queued", origin);
        return;
      }
      reason = "no_row";
    } catch (e) {
      reason = e instanceof Error ? (e.name === "TimeoutError" || e.name === "AbortError" ? "timeout" : e.message.slice(0, 60)) : "error";
    }
  }
  ap1Event("ap1:retry_write_error", origin);
  const masked = "***" + String(phone).replace(/\D/g, "").slice(-4);
  console.error(`[autopay AP-1] retry row NOT written: transaction_log_id=${owner} phone=${masked} kind=${fail.kind} status=${fail.status ?? "none"} reason=${reason}`);
}

/** Turnstile, SHADOW only: returns a verdict for the log. Never blocks and never logs the token or secret. */
async function ap1TurnstileVerdict(token: unknown, ip: string | null): Promise<string> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return "missing";
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return "nosecret";
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set("remoteip", ip);
    const res = await fetch(Deno.env.get("TURNSTILE_VERIFY_URL") || "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return "unavailable";
    const v = asRecord(await res.json());
    return v.success === true && v.action === AP1_TS_ACTION && AP1_HOSTS.has(String(v.hostname || "")) ? "ok" : "invalid";
  } catch {
    return "unavailable";
  }
}

function ap1Json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function ap1Padded(started: number, cors: Record<string, string>, body: unknown): Promise<Response> {
  const wait = AP1_MIN_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return ap1Json(cors, 200, body);
}

/**
 * Handles POST autopay/unsubscribe end to end. The upstream request is the old cellpay.us one:
 * same method/path, the same header set the proxy always sent, and body JSON.stringify({ phone }).
 * The verification fields (verify.email / verify.last4) and the Turnstile token ride OUTSIDE payload
 * and are never forwarded.
 */
async function ap1HandleUnsubscribe(
  req: Request,
  body: Record<string, unknown>,
  cors: Record<string, string>,
  apiKey: string,
  apiSecret: string,
): Promise<Response> {
  const started = Date.now();
  const origin = req.headers.get("origin");
  if (origin === null || !AP1_ORIGINS.has(origin)) {
    ap1Event("ap1:bad_origin", origin);
    return ap1Json(cors, 403, { success: false, blocked: true, code: "not_allowed", error: "This request is not allowed.", message: "This request is not allowed." });
  }

  // Exact old body: payload is { phone } and nothing else; phone is the old toPhone() output (10 digits).
  const payload = asRecord(body.payload);
  const keys = Object.keys(payload);
  const phone = payload.phone;
  const verify = asRecord(body.verify);
  const email = typeof verify.email === "string" ? verify.email.trim().toLowerCase() : "";
  const last4 = typeof verify.last4 === "string" ? verify.last4.trim().toLowerCase() : "";
  const emailOk = email.length > 0 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const last4Ok = /^[a-z0-9]{4}$/.test(last4);
  if (keys.length !== 1 || keys[0] !== "phone" || typeof phone !== "string" || !/^\d{10}$/.test(phone) || (!emailOk && !last4Ok)) {
    ap1Event("ap1:invalid", origin);
    return ap1Json(cors, 400, { success: false, blocked: true, code: "invalid_request", error: "Invalid request.", message: "Invalid request." });
  }

  const ip = ap1ClientIp(req);
  // Rate limits: both buckets are always counted (same work either way).
  let limited: string | null = null;
  try {
    const [ipOk, phoneOk] = await Promise.all([
      ap1Rpc("ap1_rate_limit_hit", { _bucket: await ap1Hash("ip", ip ?? "none"), _limit: AP1_LIMITS.ip.max, _window_seconds: AP1_LIMITS.ip.windowS }, AP1_RL_TIMEOUT_MS), // [AP1-RL-1018]
      ap1Rpc("ap1_rate_limit_hit", { _bucket: await ap1Hash("ph", phone), _limit: AP1_LIMITS.phone.max, _window_seconds: AP1_LIMITS.phone.windowS }, AP1_RL_TIMEOUT_MS), // [AP1-RL-1018]
    ]);
    if (ipOk !== true) limited = "ap1:rl_ip";
    else if (phoneOk !== true) limited = "ap1:rl_phone";
  } catch {
    limited = "ap1:rl_error"; // fail closed: no cancel without a working limiter
  }
  if (limited) {
    ap1Event(limited, origin);
    return ap1Padded(started, cors, AP1_TRY_LATER);
  }

  // Turnstile (shadow) and the ownership check run side by side.
  const [tsVerdict, owner] = await Promise.all([
    ap1TurnstileVerdict(body.turnstile, ip),
    ap1Rpc("ap1_owner_match", { _phone: phone, _email: emailOk ? email : null, _last4: last4Ok ? last4 : null }, 1500)
      .then((v) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null))
      .catch(() => "error" as const),
  ]);
  ap1Event(`ap1:ts_${AP1_TS_MODE}:${tsVerdict}`, origin);
  if (owner === "error") {
    ap1Event("ap1:verify_error", origin);
    return ap1Padded(started, cors, AP1_TRY_LATER);
  }
  if (owner === null) {
    ap1Event("ap1:no_match", origin);
    return ap1Padded(started, cors, AP1_NEUTRAL);
  }

  // The old call. X-Cellpay-Domain is a server-side constant picked by the validated Origin, never a body value
  // (Yasir hard lock 3): the same rule as 1b's `callerHost ? domainForOrigin(origin) : FALLBACK_DOMAIN`. On 1a bases it
  // equals the old resolveCellpayDomain(callerHost) for every real browser (callerHost is the page's own host).
  const cellpayDomain = body.callerHost ? AP1_ORIGIN_DOMAIN[origin] : FALLBACK_DOMAIN;
  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    "X-Api-Secret": apiSecret,
    "X-Cellpay-Domain": cellpayDomain,
    "Content-Type": "application/json",
    "Accept": "*/*",
  };
  if (typeof body.bearerToken === "string" && body.bearerToken) headers["Authorization"] = `Bearer ${body.bearerToken}`;
  let fail: { kind: string; status: number | null; reason?: string | null } | null = null;
  try {
    const res = await fetch(`${API_BASE}/${AP1_ENDPOINT}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(AP1_UPSTREAM_TIMEOUT_MS),
    });
    const raw = await res.text();
    let d: unknown = undefined;
    try {
      d = JSON.parse(raw);
    } catch {
      d = undefined;
    }
    if (res.status >= 500) {
      fail = { kind: "http_5xx", status: res.status };
    } else if (!d || typeof d !== "object" || Array.isArray(d)) {
      fail = { kind: "non_json", status: res.status };
    } else {
      const top = d as Record<string, unknown>;
      const inner = top.data && typeof top.data === "object" ? asRecord(top.data) : top;
      const st = inner.status;
      const ok = res.ok && (st === true || st === "true" || String(st || "").toLowerCase() === "success");
      if (!ok) {
        // [AP1-NOTENROLLED-1009] keep CellPay's reason (masked) for the alarm; a known "no Auto Pay on this number" answer
        // (HTTP 200 + status false + known wording) is labelled not_enrolled: row closed as done, no alarm. Reply unchanged.
        const why = ap1MaskReason(inner.msg ?? inner.message ?? top.msg ?? top.message ?? top.error);
        fail = { kind: ap1IsNotEnrolled(res.status, st, why) ? "not_enrolled" : "error_body", status: res.status, reason: why };
      }
    }
  } catch (e) {
    fail = { kind: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", status: null };
  }
  if (!fail) {
    ap1Event("ap1:sent_ok", origin);
  } else {
    // [AP1-NOTENROLLED-1009] not_enrolled is not a failure: its own event code, outside the sweep's ap1:sent_fail:* check.
    ap1Event(fail.kind === "not_enrolled" ? "ap1:sent_not_enrolled" : `ap1:sent_fail:${fail.kind}`, origin);
    // [AP1-RETRY-1007] Queue it (reference + kind + status only) in the background: 3 s budget + one retry, reply unchanged.
    const write = ap1RetryWrite(owner, phone, fail, cellpayDomain, origin).catch(() => {});
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(write);
    else await write;
  }
  return ap1Padded(started, cors, AP1_NEUTRAL);
}

/** PII-free shape for logs: literal words kept, anything with digits or symbols becomes ":x". */
function endpointShape(endpoint: unknown): string {
  if (typeof endpoint !== "string") return `<${endpoint === null ? "null" : typeof endpoint}>`;
  const segs = guardDecode(endpoint).toLowerCase().split(/[\/?]/);
  const shown = segs.slice(0, 5).map((s) => (/^[a-z][a-z-]{0,31}$/.test(s) ? s : ":x"));
  return (shown.join("/") + (segs.length > 5 ? "/..." : "")).slice(0, 120);
}

function originHost(origin: string | null): string | null {
  if (origin === null) return null;
  try {
    return new URL(origin).host.toLowerCase().slice(0, 100);
  } catch {
    return "invalid";
  }
}

function methodLabel(method: unknown): string {
  return typeof method === "string" ? method.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10) : `<${typeof method}>`;
}

// Refusal counter for the watch: one PII-free row per refusal in public.proxy_guard_events
// (service role only). Fire-and-forget, never on the allowed path, capped per isolate.
const GUARD_EVENT_CAP_PER_MINUTE = 60;
let guardEventMinute = 0;
let guardEventsThisMinute = 0;
let guardEventsDropped = 0;

// KLARNA-MIN25-1017: mirrors KLARNA_MIN_TOTAL in src/lib/declineRecovery.ts (Klarna under $25 always fails upstream).
const KLARNA_MIN_TOTAL = 25; // KLARNA-MIN25-1017
export function klarnaMinRefusal(total: unknown, lang: unknown): Record<string, unknown> | null { // KLARNA-MIN25-1017
  const t = Number(total);
  if (!Number.isFinite(t) || t >= KLARNA_MIN_TOTAL) return null;
  const message = lang === "es"
    ? "Klarna está disponible para pedidos de $25 o más. Por favor, elija otra forma de pago. No se le cobró."
    : "Klarna is available for orders of $25 or more. Please choose another way to pay. You were not charged.";
  return { success: false, blocked: true, code: "KLARNA_MIN_TOTAL", message };
}
export function klarnaTotalBand(v: unknown): string { // KLARNA-LOG-1017
  if (v === null || v === undefined || v === "") return "unknown"; // KLARNA-LOG-1017
  const n = Number(v); // KLARNA-LOG-1017
  return !Number.isFinite(n) ? "unknown" : n < 25 ? "<25" : n < 50 ? "25-50" : n < 100 ? "50-100" : "100+"; // KLARNA-LOG-1017
} // KLARNA-LOG-1017
export function klarnaSrcLabel(v: unknown): string { // KLARNA-LOG-1017
  return v === "method_list" ? "list" : v === "decline_nsf" ? "funds-klarna" : v === "decline_other" ? "decline-klarna" : "unknown"; // KLARNA-LOG-1017
} // KLARNA-LOG-1017
export function klarnaSessionOutcome(httpOk: boolean, data: unknown): "ok" | "no_token" | "http_error" { // KLARNA-LOG-1017
  if (!httpOk) return "http_error"; // KLARNA-LOG-1017
  let level = data; // KLARNA-LOG-1017
  for (let i = 0; i < 3; i++) { // KLARNA-LOG-1017
    if (!level || typeof level !== "object") break; // KLARNA-LOG-1017
    const row = level as Record<string, unknown>; // KLARNA-LOG-1017
    if (typeof row.client_token === "string" && row.client_token.trim()) return "ok"; // KLARNA-LOG-1017
    level = row.data; // KLARNA-LOG-1017
  } // KLARNA-LOG-1017
  return "no_token"; // KLARNA-LOG-1017
} // KLARNA-LOG-1017
export function klarnaCategories(data: unknown): string { // KLARNA-LOG-1017
  let level = data; // KLARNA-LOG-1017
  for (let i = 0; i < 3; i++) { // KLARNA-LOG-1017
    if (!level || typeof level !== "object") break; // KLARNA-LOG-1017
    const row = level as Record<string, unknown>; // KLARNA-LOG-1017
    if (Array.isArray(row.payment_method_categories)) { // KLARNA-LOG-1017
      const ids = row.payment_method_categories.flatMap((item: unknown) => { // KLARNA-LOG-1017
        if (!item || typeof item !== "object") return []; // KLARNA-LOG-1017
        const id = (item as Record<string, unknown>).identifier; // KLARNA-LOG-1017
        return typeof id === "string" && /^[a-z_]{1,30}$/.test(id) ? [id] : []; // KLARNA-LOG-1017
      }).slice(0, 5); // KLARNA-LOG-1017
      return ids.join("+") || "none"; // KLARNA-LOG-1017
    } // KLARNA-LOG-1017
    level = row.data; // KLARNA-LOG-1017
  } // KLARNA-LOG-1017
  return "none"; // KLARNA-LOG-1017
} // KLARNA-LOG-1017
export function klarnaSessionEvent(outcome: string, httpStatus: number, total: unknown, host: string | null, hasOrigin: boolean, log: unknown, categories = "none"): Record<string, unknown> { // KLARNA-LOG-1017
  const row = log && typeof log === "object" ? log as Record<string, unknown> : {}; // KLARNA-LOG-1017
  const lang = row.lang === "en" || row.lang === "es" ? row.lang : "unknown"; // KLARNA-LOG-1017
  const src = klarnaSrcLabel(row.src); // KLARNA-LOG-1017
  return { code: `klarna_session:${outcome}`, method: "POST", endpoint_shape: `klarna_session|${httpStatus}|${klarnaTotalBand(total)}|${lang}|${src}|${categories}`, origin_host: host, has_origin: hasOrigin }; // KLARNA-LOG-1017
} // KLARNA-LOG-1017
function logKlarnaSession(outcome: string, httpStatus: number, total: unknown, guardOrigin: string | null, body: unknown, categories = "none"): void { // KLARNA-LOG-1017
  try { recordGuardEvent(klarnaSessionEvent(outcome, httpStatus, total, originHost(guardOrigin), guardOrigin !== null, (body as Record<string, unknown>)?.klarna_log, categories)); } catch { /* never affects the request */ } // KLARNA-LOG-1017
} // KLARNA-LOG-1017

function recordGuardEvent(event: Record<string, unknown>): void {
  try {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== guardEventMinute) {
      guardEventMinute = minute;
      guardEventsThisMinute = 0;
    }
    if (guardEventsThisMinute >= GUARD_EVENT_CAP_PER_MINUTE) {
      guardEventsDropped++;
      return;
    }
    guardEventsThisMinute++;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    const droppedBefore = guardEventsDropped;
    guardEventsDropped = 0;
    const write = fetch(`${supabaseUrl}/rest/v1/proxy_guard_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({ ...event, guard_version: GUARD_VERSION, dropped_before: droppedBefore }),
      signal: AbortSignal.timeout(1500),
    })
      .then((res) => {
        if (!res.ok) console.warn(`[proxy-guard] event insert failed: ${res.status}`);
      })
      .catch(() => {});
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(write);
  } catch {
    // never let refusal logging affect the response
  }
}

// REFUNDED-STATE-1017: BAD_PHONE refusal. Failed order row ("Blocked: invalid phone number"), proxy_guard_events "bad_phone" (no phone).
const BAD_PHONE_LOG = "Blocked: invalid phone number";
async function badPhoneReply(p: Record<string, unknown>, callerHost: string | undefined, ua: string | null, cors: Record<string, string>, origin: string | null, shape: string): Promise<Response> {
  try {
    const id = await Promise.race([createTransactionLog(p, callerHost, ua), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    if (id) await finishTransactionLog(id, { success: false, error: BAD_PHONE_LOG, data: { status: false, message: BAD_PHONE_LOG } }, text(p.payment_method ?? p.paymentMethod));
  } catch (e) { console.error("[tx-log] bad_phone log failed:", e instanceof Error ? e.message : e); }
  try { recordGuardEvent({ code: "bad_phone", method: "POST", endpoint_shape: shape, origin_host: originHost(origin), has_origin: origin !== null }); } catch { /* ignore */ }
  return new Response(JSON.stringify({ success: false, code: "BAD_PHONE", error: "Please enter the full 10-digit phone number." }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}

function guardRefusal(
  cors: Record<string, string>,
  status: number,
  code: GuardCode,
  method: unknown,
  endpoint: unknown,
  origin: string | null,
): Response {
  const shape = endpointShape(endpoint);
  const host = originHost(origin);
  const m = methodLabel(method);
  console.warn(`[proxy-guard ${GUARD_VERSION}] refused code=${code} method=${m} shape=${shape} origin=${host ?? "none"}`);
  recordGuardEvent({ code, method: m, endpoint_shape: shape, origin_host: host, has_origin: origin !== null });
  const message = GUARD_MESSAGES[code];
  return new Response(JSON.stringify({ success: false, blocked: true, code, error: message, message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const GUARD_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

// ---------------------------------------------------------------------------
// [SEC-1] Order history needs a verified login (QA account audit, Oct 4 2026, finding 1).
// Every proxied call carries our API key + secret, so an order-history request without a user token must never reach CellPay.
// GET "transactions" is served only after GET users/profile with the caller's Bearer returns a user (API 1.2.27); the list call
// carries that same Bearer and nothing from the client (GET bodies are never forwarded, "?" is refused by 1a). Rows naming another
// user are dropped; an oversized answer is treated as unscoped and replaced by an empty list. No/bad token -> 401.
// Every other path in the transactions/orders family is refused (403 not_allowed) except GET transactions/view/{hashid} (receipt).
// Logs: PII-free proxy_guard_events rows, code "sec1:*" (counts only). Never a token, user id, phone, email or hashid.
// ---------------------------------------------------------------------------
const SEC1_VERIFY_TIMEOUT_MS = 4000;
const SEC1_LIST_TIMEOUT_MS = 10000;
const SEC1_MAX_ROWS = 500;
const SEC1_MAX_TOTAL = 5000;
const SEC1_FAMILY = /^(transactions?|orders?)(\.[a-z0-9]{1,8})?$/;
const SEC1_LOGIN = { success: false, blocked: true, code: "login_required", error: "Please log in to see your orders.", message: "Please log in to see your orders." };
const SEC1_TRY_LATER = { success: false, blocked: true, code: "try_later", error: "We couldn't load your orders right now. Please try again later.", message: "We couldn't load your orders right now. Please try again later." };

type Sec1Route = "list" | "receipt" | "refuse" | null;

/** Which SEC route an endpoint belongs to. Canonical spellings only: anything else in the family is refused. */
function sec1Route(endpoint: string, method: string): Sec1Route {
  const n = normalizeEndpoint(endpoint);
  if (!n) return null;
  if (n.segments.join("/") === "checkout/transaction") return null; // the checkout itself is not order history
  if (!n.segments.some((s) => SEC1_FAMILY.test(s))) return null;
  const r = n.rawSegments;
  if (r.length === 1 && r[0] === "transactions" && method === "GET") return "list";
  if (r.length === 3 && r[0] === "transactions" && r[1] === "view" && method === "GET" && /^[A-Za-z0-9_-]{1,64}$/.test(r[2])) return "receipt";
  return "refuse";
}

function sec1Token(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 16 && t.length <= 4096 && /^[A-Za-z0-9._~+\/=-]+$/.test(t) ? t : null;
}

function sec1Event(code: string, shape: string, method: unknown, origin: string | null): void {
  recordGuardEvent({ code, method: methodLabel(method), endpoint_shape: shape, origin_host: originHost(origin), has_origin: origin !== null });
}

function sec1Json(cors: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function sec1Headers(apiKey: string, apiSecret: string, callerHost: unknown): Record<string, string> {
  return {
    "X-Api-Key": apiKey,
    "X-Api-Secret": apiSecret,
    "X-Cellpay-Domain": resolveCellpayDomain(typeof callerHost === "string" ? callerHost : undefined),
    "Content-Type": "application/json",
    "Accept": "*/*",
  };
}

function sec1IdText(v: unknown): string | null {
  if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) return String(v);
  if (typeof v === "string" && /^\d{1,18}$/.test(v.trim())) return v.trim();
  return null;
}

/** GET users/profile with the caller's Bearer: the user id, "invalid" (401/403/no user/inactive) or "error" (down, timeout, non-JSON). */
async function sec1VerifyUser(token: string, base: Record<string, string>): Promise<{ id: string } | "invalid" | "error"> {
  try {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: "GET",
      headers: { ...base, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(SEC1_VERIFY_TIMEOUT_MS),
    });
    const raw = await res.text();
    if (res.status === 401 || res.status === 403) return "invalid";
    if (!res.ok) return "error";
    let d: unknown;
    try { d = JSON.parse(raw); } catch { return "error"; }
    const top = asRecord(d);
    if (top.success === false) return "invalid";
    const data = asRecord(top.data);
    const user = asRecord(data.user ?? asRecord(data.data).user);
    const id = sec1IdText(user.id);
    if (!id || user.active === false) return "invalid";
    return { id };
  } catch {
    return "error";
  }
}

function sec1RowOwner(row: unknown): string | null {
  const r = asRecord(row);
  return sec1IdText(r.user_id) ?? sec1IdText(r.userId) ?? sec1IdText(asRecord(r.user).id);
}

/** Keeps only rows of `uid` (rows with no owner field are kept: upstream scoped them by the Bearer). */
function sec1Scope(data: unknown, uid: string): { data: unknown; rows: number; dropped: number; unknown: number; suspect: boolean } {
  let holder: Record<string, unknown> | null = null;
  let key = "";
  let cur: unknown = data;
  for (let i = 0; i < 5 && cur && typeof cur === "object" && !Array.isArray(cur); i++) {
    const o = cur as Record<string, unknown>;
    const k = ["transactions", "orders", "data"].find((x) => Array.isArray(o[x]));
    if (k) { holder = o; key = k; break; }
    cur = o.data;
  }
  if (Array.isArray(data)) { holder = { list: data }; key = "list"; }
  if (!holder) return { data, rows: 0, dropped: 0, unknown: 0, suspect: false };
  const list = holder[key] as unknown[];
  const totals = [holder.total, holder.count, holder.totalCount, asRecord(holder.pagination).count, asRecord(holder.pagination).total,
    asRecord(holder.meta).total, asRecord(holder.paging).count].map(Number).filter((n) => Number.isFinite(n));
  if (list.length > SEC1_MAX_ROWS || totals.some((n) => n > SEC1_MAX_TOTAL)) {
    return { data: { transactions: [] }, rows: list.length, dropped: list.length, unknown: 0, suspect: true };
  }
  let dropped = 0, unknown = 0;
  const kept = list.filter((row) => {
    const owner = sec1RowOwner(row);
    if (owner === null) { unknown++; return true; }
    if (owner !== uid) { dropped++; return false; }
    return true;
  });
  holder[key] = kept;
  return { data: key === "list" ? kept : data, rows: list.length, dropped, unknown, suspect: false };
}

async function sec1HandleList(req: Request, body: Record<string, unknown>, cors: Record<string, string>, apiKey: string, apiSecret: string): Promise<Response> {
  const origin = req.headers.get("origin");
  const token = sec1Token(body.bearerToken);
  if (!token) {
    sec1Event(body.bearerToken ? "sec1:bad_token_shape" : "sec1:no_token", "transactions", "GET", origin);
    return sec1Json(cors, 401, SEC1_LOGIN);
  }
  const base = sec1Headers(apiKey, apiSecret, body.callerHost);
  const who = await sec1VerifyUser(token, base);
  if (who === "invalid") { sec1Event("sec1:bad_token", "transactions", "GET", origin); return sec1Json(cors, 401, SEC1_LOGIN); }
  if (who === "error") { sec1Event("sec1:verify_error", "transactions", "GET", origin); return sec1Json(cors, 503, SEC1_TRY_LATER); }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/transactions`, {
      method: "GET",
      headers: { ...base, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(SEC1_LIST_TIMEOUT_MS),
    });
  } catch {
    sec1Event("sec1:list_error", "transactions", "GET", origin);
    return sec1Json(cors, 503, SEC1_TRY_LATER);
  }
  const raw = await res.text();
  let data: unknown;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (res.status === 401 || res.status === 403) { sec1Event("sec1:list_401", "transactions", "GET", origin); return sec1Json(cors, 401, SEC1_LOGIN); }
  if (!res.ok || data === null || typeof data !== "object") {
    sec1Event(`sec1:list_fail:http${res.status}`, "transactions", "GET", origin);
    return sec1Json(cors, 200, { success: false, error: "Request failed", data: {} });
  }
  const s = sec1Scope(data, who.id);
  sec1Event(s.suspect ? `sec1:scope_suspect:rows=${s.rows}` : `sec1:list_ok:rows=${s.rows}:dropped=${s.dropped}:noowner=${s.unknown}`, "transactions", "GET", origin);
  return sec1Json(cors, 200, { success: true, data: s.data });
}

// [VEL1-1007] Server velocity, LOG-ONLY. Card attempts only. Fire-and-forget AFTER the log row exists: never awaited, never
// changes the response, never refuses. The RPC records hashed/lowercased keys and logs would-refuse hits to proxy_guard_events
// (codes vel1_shadow:declines:<phone|email|visitor>, vel1_shadow:names:phone). visitorId is HMAC'd here; the raw id is not stored.
function velocityShadow(logId: string | null, p: Record<string, unknown>, method: string | null): void {
  try {
    if (!logId || (method || "").toLowerCase() !== "cardpayment") return;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const hashKey = Deno.env.get("GUARD_HASH_KEY") || serviceKey;
    if (!supabaseUrl || !serviceKey || !hashKey) return;
    const pay = asRecord(p.payment);
    const run = (async () => {
      let visitor: string | null = null;
      try { visitor = text(asRecord(JSON.parse(String(p.browser_info ?? "{}"))).visitorId); } catch { visitor = null; }
      let visitorH: string | null = null;
      if (visitor) {
        const enc = new TextEncoder();
        const k = await crypto.subtle.importKey("raw", enc.encode(hashKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`vel1|visitor|${visitor}`)));
        visitorH = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
      }
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/velocity_shadow_record`, {
        method: "POST",
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          _log_id: logId,
          _phone: text(p.phone_number ?? p.phoneNumber),
          _email: text(pay.email ?? p.email),
          _visitor_h: visitorH,
          _first: text(pay.firstName ?? pay.first_name ?? p.first_name),
          _last: text(pay.lastName ?? pay.last_name ?? p.last_name),
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) console.warn(`[vel1] shadow record failed: ${res.status}`);
    })().catch(() => {});
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(run);
  } catch {
    // log-only: never affect checkout
  }
}

// ---------------------------------------------------------------------------
// [GPAY-AP-SERVER-1008] Google Pay Auto Pay server gate (Fraud & QA, Oct 8 2026). The site gates the Auto Pay offer in the browser
// (gpay_autopay_check); this re-runs the gates here so a direct API caller cannot skip them. Only for Google Pay checkouts that ask
// for Auto Pay (payment.autopay / payment.autopay_agreement, or the API's top-level autopay / autopay_agreement / subscriberARB).
// gpay_autopay_check_server (service role only): site switch not off, blocklist phone/email, VEL1 24 h, <=1 failed attempt 24 h,
// 1 name per phone 30 d (incl. the Google billing name), Google billing country US, A4 when its flag is on.
// Pass = request unchanged. Refuse, DB error or timeout (GPAY_AP_TIMEOUT_MS) = every Auto Pay key is removed and the order goes on
// as a normal one-time Google Pay payment. The payment itself is never refused or delayed beyond the timeout here.
// Logs: the DB function writes gpay_ap:server:pass|refuse:<gate> to proxy_guard_events (guard_version 'gpayap1'); an error or
// timeout is written from here as gpay_ap:server:refuse:error|timeout. No phone, email, name or token in any log row.
// ---------------------------------------------------------------------------
const GPAY_AP_TIMEOUT_MS = 1500;
const GPAY_AP_PAYMENT_KEYS = ["autopay", "autopay_agreement"];
const GPAY_AP_ROOT_KEYS = ["autopay", "autopay_agreement", "subscriberARB"];

function gpApIsGooglePay(p: Record<string, unknown>, method: string | null): boolean {
  const m = (method || "").toLowerCase().replace(/[^a-z]/g, "");
  return m === "googlepay" || (p.google_pay_token !== undefined && p.google_pay_token !== null && p.google_pay_token !== "");
}

/** Any Auto Pay key present with a value other than false counts as asking (a string "false" is truthy to many backends). */
function gpApWants(p: Record<string, unknown>): boolean {
  const pay = asRecord(p.payment);
  return GPAY_AP_PAYMENT_KEYS.some((k) => k in pay && pay[k] !== false) || GPAY_AP_ROOT_KEYS.some((k) => k in p && p[k] !== false);
}

function gpApStrip(p: Record<string, unknown>): void {
  const pay = p.payment;
  if (pay && typeof pay === "object" && !Array.isArray(pay)) for (const k of GPAY_AP_PAYMENT_KEYS) delete (pay as Record<string, unknown>)[k];
  for (const k of GPAY_AP_ROOT_KEYS) delete p[k];
}

function gpApBilling(p: Record<string, unknown>): { first: string | null; last: string | null; country: string | null } {
  let b: Record<string, unknown> = {};
  try { b = typeof p.gpay_billing_details === "string" ? asRecord(JSON.parse(p.gpay_billing_details)) : asRecord(p.gpay_billing_details); } catch { b = {}; }
  const pay = asRecord(p.payment);
  const parts = String(b.name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts.length ? parts[0] : text(pay.firstName ?? pay.first_name);
  const last = parts.length ? parts.slice(1).join(" ") : text(pay.lastName ?? pay.last_name);
  const country = text(b.countryCode ?? b.country_code);
  return { first: first ? first.slice(0, 100) : null, last: last ? last.slice(0, 100) : null, country: country ? country.slice(0, 8) : null };
}

async function gpApServerGate(p: Record<string, unknown>): Promise<{ ok: boolean; gate: string; logged: boolean }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { ok: false, gate: "error", logged: false };
  const pay = asRecord(p.payment);
  const b = gpApBilling(p);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/gpay_autopay_check_server`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({ _phone: text(p.phone_number ?? p.phoneNumber), _email: text(pay.email ?? p.email), _first: b.first, _last: b.last, _country: b.country }),
      signal: AbortSignal.timeout(GPAY_AP_TIMEOUT_MS),
    });
    if (!res.ok) { console.warn(`[gpay-ap] server gate failed: ${res.status}`); await res.body?.cancel(); return { ok: false, gate: "error", logged: false }; }
    const r = asRecord(await res.json());
    if (r.ok === true) return { ok: true, gate: "pass", logged: true };
    const g = typeof r.gate === "string" ? r.gate.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32) : "";
    return { ok: false, gate: g || "unknown", logged: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return { ok: false, gate: name === "TimeoutError" || name === "AbortError" ? "timeout" : "error", logged: false };
  }
}

// Own per-isolate cap (like ap1Event) so this can never crowd out other refusal rows. Fire-and-forget, never throws.
const GPAY_AP_EVENT_CAP_PER_MINUTE = 60;
let gpApEventMinute = 0;
let gpApEventsThisMinute = 0;
let gpApEventsDropped = 0;
function gpApEvent(code: string, origin: string | null): void {
  try {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== gpApEventMinute) { gpApEventMinute = minute; gpApEventsThisMinute = 0; }
    if (gpApEventsThisMinute >= GPAY_AP_EVENT_CAP_PER_MINUTE) { gpApEventsDropped++; return; }
    gpApEventsThisMinute++;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    const droppedBefore = gpApEventsDropped;
    gpApEventsDropped = 0;
    const write = fetch(`${supabaseUrl}/rest/v1/proxy_guard_events`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({
        code, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(origin), has_origin: origin !== null,
        guard_version: "gpayap1", dropped_before: droppedBefore,
      }),
      signal: AbortSignal.timeout(1500),
    })
      .then((res) => { if (!res.ok) console.warn(`[gpay-ap] event insert failed: ${res.status}`); })
      .catch(() => {});
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(write);
  } catch {
    // never let logging affect the payment
  }
}

// [VEL1-ENFORCE-1009] Server velocity, ENFORCED for CARD payments only (Parvez approved Oct 9 13:40 CT). One RPC, vel1_enforce_check
// (service_role): refuse a card try when the phone has 5+ real bank declines in 30 min with no success, or 4+ cardholder names in 60 min
// (3+ with a stolen/lost, bad-CVV or invalid-account decline); not_block phones exempt. Kill switch (SQL, no deploy):
// checkout_guard_controls key 'vel1' = on | shadow (log only) | off; a missing row = off. Fail-open: 800 ms budget, any error = no check
// (counted as proxy_guard_events vel1e_failopen). The DB answers refuse=true only in mode on. Never called for any other method.
const VEL1_TIMEOUT_MS = 800;
async function vel1Refuse(p: Record<string, unknown>, method: string | null, origin: string | null): Promise<boolean> {
  if ((method || "").toLowerCase() !== "cardpayment") return false;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return false;
  const failOpen = (why: string): boolean => {
    try { recordGuardEvent({ code: "vel1e_failopen", method: "POST", endpoint_shape: `checkout/transaction#${why}`, origin_host: originHost(origin), has_origin: origin !== null }); } catch { /* ignore */ }
    return false;
  };
  try {
    const pay = asRecord(p.payment);
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/vel1_enforce_check`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        _phone: text(p.phone_number ?? p.phoneNumber),
        _email: text(pay.email ?? p.email),
        _first: text(pay.firstName ?? pay.first_name ?? p.first_name),
        _last: text(pay.lastName ?? pay.last_name ?? p.last_name),
        _method: method,
      }),
      signal: AbortSignal.timeout(VEL1_TIMEOUT_MS),
    });
    if (!res.ok) { await res.body?.cancel(); return failOpen(`http_${res.status}`); }
    const r = asRecord(await res.json());
    return r.refuse === true;
  } catch (e) {
    return failOpen(e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "error");
  }
}

// [FRAUD-MULTIBLOCK-1012] Multi-factor block keys: device fingerprint (own, fp1:), device id, exact card (BIN6:last4 + MMYY) and
// normalized billing address. Built from the checkout payload inside the proxy; the full card number never leaves this function
// except as a keyed hash (mf_card_fp). Kill switch checkout_guard_controls.mfblock = on | shadow | off (missing row = off).
type Mf = { device: string | null; did: string | null; visitor: string | null; card: string | null; card_exp: string | null; addr: string | null; cardFpSrc: string | null; bin6: string | null; last4: string | null };

// Same rules as SQL public.addr_norm (keep in sync).
function mfAddrNorm(line: unknown, zip: unknown): string | null {
  let v = String(line ?? "").toLowerCase();
  const z = String(zip ?? "").replace(/\D/g, "").slice(0, 5);
  v = v.replace(/[^a-z0-9 ]/g, " ");
  v = " " + v.replace(/\s+/g, " ") + " ";
  const subs: Array<[RegExp, string]> = [
    [/ (street|str) /g, " st "], [/ (avenue|av|ave) /g, " ave "], [/ (road) /g, " rd "], [/ (drive) /g, " dr "],
    [/ (boulevard|blv) /g, " blvd "], [/ (lane) /g, " ln "], [/ (court) /g, " ct "], [/ (place) /g, " pl "],
    [/ (apartment|apt|unit|suite|ste|#) /g, " apt "], [/ (north) /g, " n "], [/ (south) /g, " s "], [/ (east) /g, " e "], [/ (west) /g, " w "],
  ];
  for (const [re, rp] of subs) v = v.replace(re, rp);
  v = v.replace(/\s+/g, " ").trim();
  if (v.length < 4 || z.length !== 5) return null;
  return `${v}|${z}`;
}

function mfJson(v: unknown): Record<string, unknown> {
  if (typeof v !== "string") return asRecord(v);
  try { return asRecord(JSON.parse(v)); } catch { return {}; }
}

function buildMf(p: Record<string, unknown>, cpDev: Record<string, unknown>, method: string | null): Mf {
  const out: Mf = { device: null, did: null, visitor: null, card: null, card_exp: null, addr: null, cardFpSrc: null, bin6: null, last4: null };
  try {
    const fp = String(cpDev.dev_fp ?? "");
    if (/^fp1:[0-9a-f]{40}$/.test(fp)) out.device = fp;
    const did = String(cpDev.dev_id ?? "");
    if (/^[0-9a-z-]{8,64}$/i.test(did)) out.did = did.toLowerCase();
    try { out.visitor = text(asRecord(JSON.parse(String(p.browser_info ?? "{}"))).visitorId); } catch { out.visitor = null; }
    const m = String(method || "").toLowerCase();
    const pay = asRecord(p.payment);
    if (m.startsWith("card")) {
      const pan = String(pay.cc_number ?? p.cc_number ?? "").replace(/\D/g, "");
      if (pan.length >= 12) {
        out.bin6 = pan.slice(0, 6); out.last4 = pan.slice(-4); out.card = `${out.bin6}:${out.last4}`;
        const mm = String(pay.cc_exp_month ?? p.cc_exp_month ?? "").replace(/\D/g, "").padStart(2, "0").slice(-2);
        const yy = String(pay.cc_exp_year ?? p.cc_exp_year ?? "").replace(/\D/g, "").slice(-2);
        if (/^(0[1-9]|1[0-2])$/.test(mm) && /^\d{2}$/.test(yy)) out.card_exp = mm + yy;
        out.cardFpSrc = "fpc1:" + pan + (out.card_exp ?? "");
      }
    }
    let line: unknown = null, zip: unknown = null;
    if (m === "applepay") {
      const bc = mfJson(p.apple_pay_billing_contact);
      line = Array.isArray(bc.addressLines) ? bc.addressLines[0] : null; zip = bc.postalCode;
    } else if (m === "googlepay") {
      const ba = mfJson(p.gpay_billing_details);
      line = ba.address1; zip = ba.postalCode;
    } else if (m === "klarna") {
      const kb = asRecord(p.billing_address);
      line = kb.street_address; zip = kb.postal_code;
    } else if (m.startsWith("card")) {
      line = pay.address; zip = pay.zip;
    }
    if (!line) { const b = asRecord(p.billing); line = b.street ?? b.address ?? b.street_address ?? null; zip = zip ?? b.zip ?? b.postal_code; }
    out.addr = mfAddrNorm(line, zip);
  } catch { /* partial mf is fine */ }
  return out;
}

async function mfHex(buf: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function mfLogMeta(mf: Mf, ipInfo: Record<string, unknown> | null): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    if (mf.device) out.mf_device = mf.device;
    if (mf.did) out.mf_did = mf.did;
    if (mf.card) out.mf_card = mf.card;
    if (mf.addr) out.mf_addr = mf.addr;
  } catch { /* best effort */ }
  try {
    if (mf.addr) out.mf_addr_h = await mfHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mf.addr)));
  } catch { /* hash failure never affects the payment */ }
  try {
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (mf.cardFpSrc && sk) {
      const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mf-card-fp-v1:" + sk));
      const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      out.mf_card_fp = (await mfHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(mf.cardFpSrc)))).slice(0, 32);
    }
  } catch { /* HMAC failure never affects the payment */ }
  try {
    if (ipInfo && (ipInfo.asn !== undefined || ipInfo.country !== undefined)) {
      out.mf_ip = { asn: ipInfo.asn ?? null, country: ipInfo.country ?? null, datacenter: ipInfo.datacenter === true };
    }
  } catch { /* best effort */ }
  return out;
}

// deno-lint-ignore no-explicit-any
function mfWaitUntil(p: Promise<unknown>): void { try { const rt = (globalThis as any).EdgeRuntime; if (rt && typeof rt.waitUntil === "function") rt.waitUntil(p); } catch { /* ignore */ } }

// [FRAUD-MULTIBLOCK-1012 FIX] shadow: blocklist check + guard event entirely in the background (never awaited by the request).
function mfShadowLater(mf: Mf, shape: string, host: string | null, hasOrigin: boolean): void {
  try {
    mfWaitUntil((async () => {
      try {
        const hit = await mfBlocklistCheck(mf);
        if (hit) recordGuardEvent({ code: `mfblock_shadow:${hit.reason}:${hit.key_type}`, method: "POST", endpoint_shape: shape, origin_host: host, has_origin: hasOrigin });
      } catch { /* ignore */ }
    })());
  } catch { /* ignore */ }
}

// [FRAUD-MULTIBLOCK-1012 FIX] mf_ip merged into the log row's metadata in the background (read-merge-patch, 3 s cap).
function mfIpPatchLater(logId: string, ipP: Promise<Record<string, unknown> | null>): void {
  try {
    mfWaitUntil((async () => {
      try {
        const ip = await Promise.race([ipP, new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
        if (!ip || (ip.asn === undefined && ip.country === undefined)) return;
        const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!url || !key) return;
        const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
        const g = await fetch(`${url}/rest/v1/transaction_logs?id=eq.${encodeURIComponent(logId)}&select=metadata`, { headers: h, signal: AbortSignal.timeout(1500) });
        if (!g.ok) { await g.body?.cancel(); return; }
        const rows = await g.json();
        const meta = asRecord(asRecord(Array.isArray(rows) ? rows[0] : rows).metadata);
        const mf_ip = { asn: ip.asn ?? null, country: ip.country ?? null, datacenter: ip.datacenter === true };
        const p = await fetch(`${url}/rest/v1/transaction_logs?id=eq.${encodeURIComponent(logId)}`, {
          method: "PATCH", headers: { ...h, prefer: "return=minimal" }, body: JSON.stringify({ metadata: { ...meta, mf_ip } }), signal: AbortSignal.timeout(1500),
        });
        await p.body?.cancel();
      } catch { /* ignore */ }
    })());
  } catch { /* ignore */ }
}

let mfModeCache: { v: string; t: number } | null = null;
async function mfBlockMode(): Promise<string> {
  if (mfModeCache && Date.now() - mfModeCache.t < 60000) return mfModeCache.v;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return "off";
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/checkout_guard_controls?key=eq.mfblock&select=value`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(300),
    });
    if (!res.ok) { await res.body?.cancel(); return "off"; }
    const rows = await res.json();
    const v = String(asRecord(Array.isArray(rows) ? rows[0] : rows).value ?? "off");
    mfModeCache = { v, t: Date.now() };
    return v;
  } catch {
    return "off";
  }
}

async function mfBlocklistCheck(mf: Mf): Promise<{ key_type: string; reason: string } | null> {
  try {
    if (!mf.device && !mf.did && !mf.card && !mf.addr) return null;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/checkout_blocklist_check_mf`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({ _devices: [mf.device, mf.did].filter(Boolean), _card: mf.card, _card_exp: mf.card_exp, _address: mf.addr }),
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    const rows = await res.json();
    const r = asRecord(Array.isArray(rows) ? rows[0] : rows);
    return r.blocked === true ? { key_type: String(r.key_type), reason: String(r.reason) } : null;
  } catch {
    return null;
  }
}

// IP -> ASN/country (best effort, 300 ms). Never a block.
async function mfIpEnrich(ip: string | null): Promise<Record<string, unknown> | null> {
  try {
    if (!ip) return null;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/ip_enrich`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({ _ip: ip }), signal: AbortSignal.timeout(300),
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    const rows = await res.json();
    return asRecord(Array.isArray(rows) ? rows[0] : rows);
  } catch {
    return null;
  }
}

async function blocklistCheck(p: Record<string, unknown>, cardH: string | null): Promise<{ key_type: string; reason: string } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  const pay = asRecord(p.payment);
  let visitor: string | null = null;
  try { visitor = text(asRecord(JSON.parse(String(p.browser_info ?? "{}"))).visitorId); } catch { visitor = null; }
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/checkout_blocklist_check`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ _phone: text(p.phone_number ?? p.phoneNumber), _email: text(pay.email ?? p.email), _card_h: cardH, _visitor: visitor, _session: text(p.kount_ssid ?? p.riskified_sessionid ?? p.cbsys_sessionid) }),
    signal: AbortSignal.timeout(1200),
  });
  if (!res.ok) { console.warn(`[blocklist] check failed: ${res.status}`); return null; }
  const rows = await res.json();
  const r = asRecord(Array.isArray(rows) ? rows[0] : rows);
  return r.blocked === true ? { key_type: String(r.key_type), reason: String(r.reason) } : null;
}

// [DUPCHARGE-1008] Duplicate-charge guard, order level (Fraud & QA, Parvez OK'd Oct 8; Aug 26 T-Mobile ***7290 Apple Pay $39.99 x2
// 6 min apart in one session). rpc dupcharge_check (service_role, read-only) answers for this phone + amount + checkout session:
// session_paid = this checkout session already has a successful charge; recent = this phone paid this same amount in the last
// 10 min. Kill switch checkout_guard_controls.dupcharge (on | shadow | off). Fail-open: 800 ms budget; any error = no check.
const DUPCHARGE_TIMEOUT_MS = 800;
// [DUPCHARGE-FOLLOWUPS-1008 b] Still fail-open (null = no check), but every fail-open is now counted when the caller passes ctx:
// proxy_guard_events code "dupcharge_failopen", endpoint_shape "<shape>#timeout" | "#http_<status>" | "#error". Mode off is a
// normal answer (no event). in_flight (DB, Oct 8): same phone with a non-Cash-App, non-PayPal 'pending' row < 2 min old for the same
// checkout session or the same amount = the first charge is still at CellPay.
async function dupchargeCheck(p: Record<string, unknown>, ctx?: { shape: string; origin: string | null }): Promise<Record<string, unknown> | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  const failOpen = (why: string): null => {
    if (ctx) {
      try { recordGuardEvent({ code: "dupcharge_failopen", method: "POST", endpoint_shape: `${ctx.shape}#${why}`, origin_host: originHost(ctx.origin), has_origin: ctx.origin !== null }); } catch { /* ignore */ }
    }
    return null;
  };
  const errWhy = (e: unknown) => (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "error");
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/rpc/dupcharge_check`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        _phone: text(p.phone_number ?? p.phoneNumber),
        _amount: numberText(p.amount),
        _session: text(p.kount_ssid ?? p.riskified_sessionid ?? p.cbsys_sessionid),
      }),
      signal: AbortSignal.timeout(DUPCHARGE_TIMEOUT_MS),
    });
  } catch (e) {
    console.warn(`[dupcharge] check failed: ${errWhy(e)}`);
    return failOpen(errWhy(e));
  }
  if (!res.ok) { console.warn(`[dupcharge] check failed: ${res.status}`); return failOpen(`http_${res.status}`); }
  try {
    return asRecord(await res.json());
  } catch (e) {
    return failOpen(errWhy(e));
  }
}

// [dedupe BL-3] Duplicate-charge guard: phone|amount|method|card-or-token, HMAC'd in memory (PAN/token never stored or logged).
// One atomic RPC (checkout_dedupe_claim, advisory lock): first claim in 10 s passes, repeats are refused. Fail-open, 1 s timeout.
async function dedupeClaim(p: Record<string, unknown>, method: string | null): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hashKey = Deno.env.get("GUARD_HASH_KEY") || serviceKey;
  if (!supabaseUrl || !serviceKey || !hashKey) return false;
  const pay = asRecord(p.payment);
  let phone = String(p.phone_number ?? p.phoneNumber ?? "").replace(/\D/g, "");
  if (phone.length === 11 && phone.startsWith("1")) phone = phone.slice(1);
  const amt = Number(p.amount);
  const amount = Number.isFinite(amt) ? amt.toFixed(2) : String(p.amount ?? "").trim();
  const pm = (method || "").trim().toLowerCase();
  const tok = (v: unknown) => (v === undefined || v === null || v === "" ? "" : typeof v === "string" ? v : JSON.stringify(v));
  const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  const pan = digits(pay.cc_number ?? p.cc_number);
  const fp = pan
    ? `pan:${pan}:${digits(pay.cc_exp_month ?? p.cc_exp_month)}/${digits(pay.cc_exp_year ?? p.cc_exp_year)}`
    : tok(p.google_pay_token) || tok(p.apple_pay_token) || tok(p.plaid_token) || tok(p.klarna_auth_token) || tok(p.payment_token) || tok(ppAuthOrderId(p.paypal_authorization)); // [PAYPAL-REBUILD-1009] same approval twice = duplicate
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(hashKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${phone}|${amount}|${pm}|${fp}`)));
  const key = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/checkout_dedupe_claim`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ _key: key, _phone: phone || null, _method: pm || null }),
    signal: AbortSignal.timeout(1000),
  });
  if (!res.ok) { console.warn(`[dedupe] claim failed: ${res.status}`); return false; }
  const rows = await res.json();
  const r = asRecord(Array.isArray(rows) ? rows[0] : rows);
  return r.duplicate === true;
}

// [refill-cooldown Fix F] CellPay's refill-error result ("There was some error during refill. This transaction has been auto
// refunded.") puts the SAME phone + plan on a 10-min cooldown: the next checkout for that pair is refused before the log and CellPay.
// Key = HMAC-SHA256("refill|phone|plan") computed in memory; the phone and plan id never leave the function. Fail-open, 1 s timeout.
// Marks ONLY on that result: never on declines, throttles, validation errors, non-JSON/gateway pages (504) or timeouts.
const REFILL_COOLDOWN_S = 600;
const REFILL_ERROR_RE = /error during refill|auto[- ]?refunded/i;
const RETRY_BLOCK_RE = /error during refill|auto[- ]?refunded|backend exception/i; // BACKEND-EXC-1019

// PLAN-RANGES-1016: plan_guard. Server amount check against carriers/view hub data BEFORE anything is sent to CellPay. Fail-open on hub errors.
type PlanGuardResult = { ok: boolean; reason?: string; message?: string; source: "hub" | "cache" | "failopen" | "none" }; // PLAN-RANGES-1016
const PG_CACHE = new Map<string, { at: number; data: Record<string, unknown> }>(); // PLAN-RANGES-1016
const PG_TTL_MS = 10 * 60 * 1000; // PLAN-RANGES-1016
const PG_DEAD_AMOUNTS = true; // LYCA-SKU-FIX-1024
let pgDeadCache: { at: number; rows: Array<{ carrier_slug: string; plan_id: string }> } | null = null; // LYCA-SKU-FIX-1024
async function pgDeadMatch(slug: string, plan: string): Promise<boolean> { // LYCA-SKU-FIX-1024
  try { // LYCA-SKU-FIX-1024
    if (!PG_DEAD_AMOUNTS || !slug || !plan || slug === "ultra-mobile") return false; // LYCA-SKU-FIX-1024
    if (pgDeadCache && Date.now() - pgDeadCache.at < PG_TTL_MS) return pgDeadCache.rows.some((r) => r.carrier_slug === slug && r.plan_id === plan); // LYCA-SKU-FIX-1024
    const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) return false; // LYCA-SKU-FIX-1024
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); // LYCA-SKU-FIX-1024
    const result = await raceNull((async () => await db.from("dead_amounts").select("carrier_slug, plan_id").is("restored_at", null).abortSignal(AbortSignal.timeout(1500)))(), 1500); // LYCA-SKU-FIX-1024
    if (!result || result.error || !Array.isArray(result.data)) return false; // LYCA-SKU-FIX-1024
    const rows = result.data.filter((r) => r.carrier_slug !== "ultra-mobile").map((r) => ({ carrier_slug: String(r.carrier_slug), plan_id: String(r.plan_id) })); // LYCA-SKU-FIX-1024
    pgDeadCache = { at: Date.now(), rows }; return rows.some((r) => r.carrier_slug === slug && r.plan_id === plan); // LYCA-SKU-FIX-1024
  } catch { return false; } // LYCA-SKU-FIX-1024
} // LYCA-SKU-FIX-1024
const PG_RANGE_OVERRIDES: Record<string, { min?: number; max?: number }> = { "66666": { max: 199 }, "23915": { min: 15, max: 100 }, "291945": { min: 15, max: 150 } }; // PLAN-RANGES-1016
const PG_MSG_FIXED = { en: "This plan amount is not available. Please choose a plan from the list.", es: "Este monto no está disponible. Elija un plan de la lista." }; // PLAN-RANGES-1016
async function pgHub(slug: string, headers: Record<string, string>): Promise<{ data: Record<string, unknown> | null; source: "hub" | "cache" }> { // PLAN-RANGES-1016
  const c = PG_CACHE.get(slug);
  if (c && Date.now() - c.at < PG_TTL_MS) return { data: c.data, source: "cache" };
  const res = await fetch(`${API_BASE}/carriers/view/${encodeURIComponent(slug)}`, { method: "GET", headers, signal: AbortSignal.timeout(2000) });
  if (!res.ok) { await res.body?.cancel(); return { data: null, source: "hub" }; }
  const raw = await res.json() as Record<string, unknown>;
  let d = (raw && typeof raw.data === "object" && raw.data ? raw.data : raw) as Record<string, unknown>;
  if (d && d.data && typeof d.data === "object" && !Array.isArray(d.data)) d = d.data as Record<string, unknown>;
  if (!d || typeof d !== "object" || d.carrier_plans == null) return { data: null, source: "hub" };
  PG_CACHE.set(slug, { at: Date.now(), data: d });
  return { data: d, source: "hub" };
}
async function planGuard(pr: Record<string, unknown>, headers: Record<string, string>, lang: unknown): Promise<PlanGuardResult> { // PLAN-RANGES-1016
  const es = lang === "es";
  const slug = String(pr.carrier_slug ?? "").trim().toLowerCase();
  const plan = String(pr.plan_id ?? pr.planId ?? "").trim();
  const amt = Number(pr.amount ?? pr.refill_amount ?? NaN);
  if (plan === "8282" || plan === "325635" || plan === "547871") return { ok: false, reason: `h2o_${plan}`, message: es ? "Este plan no está disponible ahora. Elija otro plan." : "This plan is not available right now. Please choose another plan.", source: "none" }; // H2O-HIDE-325635-1017 // PLAN-BLOCK-CLEANUP-1017
  if (plan === "32993000") return { ok: false, reason: "ultra_32993000", message: es ? "Este plan no está disponible ahora. Elija otro plan." : "This plan is not available right now. Please choose another plan.", source: "none" }; // ULTRA64-HIDE-1017
  if (plan === "8947005") return { ok: false, reason: "lyca_8947005", message: es ? "Este plan no está disponible ahora. Elija otro plan." : "This plan is not available right now. Please choose another plan.", source: "none" }; // LYCA10-HIDE-1017
  if (await pgDeadMatch(slug, plan)) return { ok: false, reason: `dead_${plan}`, message: es ? "Este plan no está disponible ahora. Elija otro plan." : "This plan is not available right now. Please choose another plan.", source: "none" }; // LYCA-SKU-FIX-1024
  if ((plan === "238888" || slug === "tmobile" || slug === "tmobile-flexi") && Number.isFinite(amt) && amt > 200) return { ok: false, reason: "tmo_cap_200", message: es ? "Las recargas de T-Mobile tienen un límite de $200 por ahora. Ingrese $200 o menos." : "T-Mobile refills are limited to $200 right now. Please enter $200 or less.", source: "none" }; // TMO-CAP-200-1022
  if (!slug || !plan || !Number.isFinite(amt)) return { ok: true, source: "none" };
  let hub: { data: Record<string, unknown> | null; source: "hub" | "cache" };
  try { hub = await pgHub(slug, headers); } catch { hub = { data: null, source: "hub" }; }
  if (!hub.data) { recordGuardEvent({ code: "plan_guard_failopen", method: "POST", endpoint_shape: `checkout/transaction#${slug}:${plan}:${amt}` }); return { ok: true, source: "failopen" }; }
  const cpAny = hub.data.carrier_plans as unknown;
  const cp = (cpAny && typeof cpAny === "object" ? cpAny : {}) as Record<string, unknown>;
  const cpCarrier = (!Array.isArray(cpAny) && cp.carrier && typeof cp.carrier === "object" ? cp.carrier : {}) as Record<string, unknown>;
  let rangeId = "";
  if (!Array.isArray(cpAny) && (cp.rangePlan === true || (typeof cp.rangePlan === "string" && cp.rangePlan !== ""))) {
    rangeId = String(cpCarrier.rangePlan ?? (typeof cp.rangePlan === "string" ? cp.rangePlan : "") ?? "").trim();
  }
  const fixed = (Array.isArray(cpAny) ? cpAny : Array.isArray(cp.fixed_plans) ? cp.fixed_plans : Array.isArray(cp.plans) ? cp.plans : []) as Array<Record<string, unknown>>;
  if (rangeId && plan === rangeId) {
    let min = Number(cpCarrier.rangeMin ?? 5); let max = Number(cpCarrier.rangeMax ?? 300);
    if (!Number.isFinite(min)) min = 5; if (!Number.isFinite(max)) max = 300;
    const ov = PG_RANGE_OVERRIDES[plan];
    if (ov?.min !== undefined) min = Math.max(min, ov.min);
    if (ov?.max !== undefined) max = Math.min(max, ov.max);
    const isBoost = plan === "66666" || slug === "boost" || slug === "bmobile";
    if (isBoost) max = Math.min(max, 199);
    if (amt < min || amt > max) {
      const message = plan === "23915" || slug === "topup-at" ? (es ? "Pagos de AT&T: de $15 a $100" : "AT&T payments: $15 to $100")
        : plan === "291945" || slug === "verizon" ? (es ? "Pagos de Verizon: de $15 a $150" : "Verizon payments: $15 to $150")
        : isBoost ? (es ? "Pagos de Boost: máximo $199" : "Boost payments max $199")
        : (es ? `Elija un monto de $${min} a $${max}.` : `Please choose an amount from $${min} to $${max}.`);
      return { ok: false, reason: "range", message, source: hub.source };
    }
    return { ok: true, source: hub.source };
  }
  const item = fixed.find((f) => String(f.planId ?? f.plan_id ?? f.id ?? "").trim() === plan);
  if (item) {
    const pa = Number(item.amount ?? NaN);
    if (Number.isFinite(pa) && Math.abs(amt - pa) > 0.01) return { ok: false, reason: "fixed_amount", message: es ? PG_MSG_FIXED.es : PG_MSG_FIXED.en, source: hub.source };
    return { ok: true, source: hub.source };
  }
  if (rangeId || fixed.length > 0) return { ok: false, reason: "no_plan", message: es ? PG_MSG_FIXED.es : PG_MSG_FIXED.en, source: hub.source };
  return { ok: true, source: hub.source };
}
function pgHeaders(apiKey: string, apiSecret: string, callerHost: string): Record<string, string> { // PLAN-RANGES-1016: same headers as the GET forward
  return { "X-Api-Key": apiKey, "X-Api-Secret": apiSecret, "X-Cellpay-Domain": resolveCellpayDomain(callerHost), "Content-Type": "application/json", "Accept": "*/*" };
}
const ULTRA_MDN_CACHE = new Map<string, { at: number; data: Record<string, unknown> }>(); // ULTRA-MDN-1029: per-isolate, 200 success bodies only
const ULTRA_MDN_TTL = 5 * 60 * 1000; // ULTRA-MDN-1029
type UltraMdnFetch = { ok: true; data: Record<string, unknown> } | { ok: false; status: number; message?: string }; // ULTRA-MDN-1029
async function ultraMdnFetch(mdn: string, headers: Record<string, string>): Promise<UltraMdnFetch> { // ULTRA-MDN-1029
  const c = ULTRA_MDN_CACHE.get(mdn); // ULTRA-MDN-1029
  if (c && Date.now() - c.at < ULTRA_MDN_TTL) return { ok: true, data: c.data }; // ULTRA-MDN-1029
  try { // ULTRA-MDN-1029
    const r = await fetch(`${API_BASE}/plans/ultra-plans?mdn=${mdn}`, { method: "GET", headers, signal: AbortSignal.timeout(6000) }); // ULTRA-MDN-1029
    const txt = await r.text(); // ULTRA-MDN-1029: JSON.parse keeps string barcodes as strings
    let raw: Record<string, unknown> = {}; // ULTRA-MDN-1029
    try { const j = JSON.parse(txt); if (j && typeof j === "object") raw = j as Record<string, unknown>; } catch { /* non-JSON */ } // ULTRA-MDN-1029
    const msgOf = () => { const m = raw.message ?? raw.error ?? raw.msg; const s = typeof m === "string" ? m : m != null ? JSON.stringify(m) : (Object.keys(raw).length ? "" : txt); return s ? s.slice(0, 300) : undefined; }; // ULTRA-MDN-1029
    if (r.status !== 200 || raw.success === false) return { ok: false, status: r.status === 200 ? 422 : r.status, message: msgOf() }; // ULTRA-MDN-1029
    let d = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>; // ULTRA-MDN-1029
    if (d && d.data && typeof d.data === "object" && !Array.isArray(d.data)) d = d.data as Record<string, unknown>; // ULTRA-MDN-1029
    ULTRA_MDN_CACHE.set(mdn, { at: Date.now(), data: d }); // ULTRA-MDN-1029
    return { ok: true, data: d }; // ULTRA-MDN-1029
  } catch { return { ok: false, status: 502 }; } // ULTRA-MDN-1029
} // ULTRA-MDN-1029
async function ultraMdnPlanCheck(mdn: string, planId: string, barcode: string, amount: number, headers: Record<string, string>): Promise<"ok" | "mismatch" | "fail"> { // ULTRA-MDN-1029
  const r = await ultraMdnFetch(mdn, headers); // ULTRA-MDN-1029
  if (!r.ok) return r.status === 502 ? "fail" : "mismatch"; // ULTRA-MDN-1029
  const list = (k: string) => (Array.isArray(r.data[k]) ? r.data[k] : []) as Array<Record<string, unknown>>; // ULTRA-MDN-1029
  const same = (p: Record<string, unknown>) => String(p.plan_id ?? p.planId ?? "") === planId && String(p.barcode ?? "") === barcode; // ULTRA-MDN-1029
  if (list("fixed_plans").some((p) => same(p) && Math.abs(amount - Number(p.amount)) <= 0.01)) return "ok"; // ULTRA-MDN-1029
  if (list("range_plans").some((p) => same(p) && Number(p.rangeMin ?? p.range_min) <= amount && amount <= Number(p.rangeMax ?? p.range_max))) return "ok"; // ULTRA-MDN-1029
  return "mismatch"; // ULTRA-MDN-1029
} // ULTRA-MDN-1029

// PLAN-RANGES-1016: RETRY-BLOCK. Same phone + plan + amount got CellPay's refill-error result in the last 30 min -> refused. Fail-open (1 s).
const RB_WINDOW_MS = 30 * 60 * 1000; // PLAN-RANGES-1016
async function retryBlockCheck(pr: Record<string, unknown>): Promise<number | null> { // PLAN-RANGES-1016: seconds left, or null = allow
  const rawPhone = String(pr.phone_number ?? "").trim();
  let d = rawPhone.replace(/\D/g, ""); if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  const plan = String(pr.plan_id ?? pr.planId ?? "").trim();
  const amt = Number(pr.amount ?? pr.refill_amount ?? NaN);
  if (!rawPhone || !d || !plan || !Number.isFinite(amt)) return null;
  try {
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const phones = Array.from(new Set([rawPhone, d])).map((v) => `"${v.replace(/"/g, "")}"`).join(",");
    const since = new Date(Date.now() - RB_WINDOW_MS).toISOString();
    const q = `select=created_at,amount,status,error_message&phone_number=in.(${encodeURIComponent(phones)})&plan_id=eq.${encodeURIComponent(plan)}&status=eq.failed&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=10`;
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/transaction_logs?${q}`, { headers: { apikey: sk, authorization: `Bearer ${sk}` }, signal: AbortSignal.timeout(1000) });
    if (!r.ok) { await r.body?.cancel(); return null; }
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const hit = rows.find((row: Record<string, unknown>) => Math.abs(Number(row.amount) - amt) <= 0.01 && RETRY_BLOCK_RE.test(String(row.error_message ?? ""))); // BACKEND-EXC-1019
    if (!hit) return null;
    const left = Math.ceil((Date.parse(String(hit.created_at)) + RB_WINDOW_MS - Date.now()) / 1000);
    return Number.isFinite(left) && left > 0 ? left : null;
  } catch { return null; }
}
const REFILL_COOLDOWN_MSG = "This plan couldn't be refilled just now. Your earlier attempt didn't go through; any pending charge from it will drop off. Please try again in about 10 minutes or choose a different plan.";

async function refillCooldownKey(p: Record<string, unknown>): Promise<string | null> {
  const hashKey = Deno.env.get("GUARD_HASH_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!hashKey) return null;
  let phone = String(p.phone_number ?? p.phoneNumber ?? "").replace(/\D/g, "");
  if (phone.length === 11 && phone.startsWith("1")) phone = phone.slice(1);
  const plan = String(p.plan_id ?? p.planId ?? "").trim().toLowerCase();
  if (phone.length < 7 || phone.length > 15 || !plan || plan.length > 64) return null;
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(hashKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`refill|${phone}|${plan}`)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function refillCooldownRpc(name: "refill_cooldown_check" | "refill_cooldown_mark", key: string): Promise<Record<string, unknown> | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ _key: key }),
    signal: AbortSignal.timeout(1000),
  });
  if (!res.ok) { console.warn(`[refill-cooldown] ${name} failed: ${res.status}`); await res.body?.cancel(); return null; }
  const rows = await res.json();
  return asRecord(Array.isArray(rows) ? rows[0] : rows);
}

/** True only for CellPay's refill-error result: a parsed JSON body, not a success, with the refill-error message. */
function isRefillErrorResult(wrapped: Record<string, unknown>): boolean {
  const data = asRecord(wrapped.data);
  if (data.parseError === true) return false; // HTML / gateway pages (504 etc.): outcome unknown, never mark
  const result = unwrapTransactionResult(wrapped);
  const st = String(result.status ?? "").toLowerCase();
  if (result.status === true || st === "true" || st === "success" || st === "completed") return false; // a success never marks
  const msg = text(result.message ?? result.msg ?? data.message ?? data.msg ?? wrapped.error);
  return msg !== null && REFILL_ERROR_RE.test(msg);
}


// ---------------------------------------------------------------------------
// [plaid v2] Pay by Bank on CellPay's Pay by Bank flow (Parvez, Oct 4 2026). Replaces Fix C's checkout-time exchange.
//  1. Browser action "plaid-v2/link-token" -> POST {API}/payments/plaid/link-token with {phone_number} -> { link_token } only.
//  2. Browser action "plaid-v2/exchange" (after Link onSuccess) -> POST {API}/payments/plaid/exchange-token with
//     {carrierId, plan_id, phone_number, amount, email, slug, public_token, metadata}. decision false or no plaid_ref ->
//     code plaid_declined. Otherwise plaid_ref is bound server-side to those six order values (public.plaid_v2_refs: HMAC'd,
//     single use, at most 1 h) and the browser gets only { decision, plaid_ref, plaid_ref_expires_in, account_name,
//     account_mask, name }.
//  3. checkout/transaction with payment_method "plaid": the plaid_ref is claimed (single use; the six values must be the
//     ones bound in step 2) and CellPay gets exactly {checkout_version "5.0", payment_method "plaid", plaid_ref, carrierId,
//     plan_id, phone_number, amount, agree_desktop true, payment {firstName, lastName, email}}: never plaid_token, plaid_id,
//     plaid_request_id, a public token or Link metadata. CellPay's 422 code "plaid_ref" reaches the browser as code
//     plaid_ref (the site links again).
// No access token or public token is ever returned to the browser or logged. Raw payments/plaid/exchange-token stays 403.
// Kill switch fraud_controls.plaid_exchange_mode = 'off': all three steps answer code plaid_unavailable and nothing is sent
// to CellPay (the site then hides Pay by Bank). Missing row = on. PII-free outcome rows: proxy_guard_events code "plv2:*".
// ---------------------------------------------------------------------------
const PLAID_PUBLIC_TOKEN = /^public-(sandbox|development|production)-[0-9a-f-]{36}$/i;
const PLAID_TOKEN_ANYWHERE = /\b(access|public)-(sandbox|development|production)-[0-9a-f-]{36}\b/gi;
const PLAID_TOKEN_ONE = /\b(access|public|link)-(sandbox|development|production)-[0-9a-f-]{36}\b/i;
const PLAID_SECRET_KEYS = /^(access_token|accessToken|plaid_access_token|public_token|publicToken|plaid_token)$/i;
const PLAID_V2_LINK = "plaid-v2/link-token";
const PLAID_V2_EXCHANGE = "plaid-v2/exchange";
const PLAID_V2_DECLINED = "You need to link a bank account with sufficient funds.";
const PLAID_V2_UNAVAILABLE = "Pay by Bank is unavailable right now. Please choose another payment method.";
const PLAID_V2_RELINK = "Your bank link has expired or no longer matches this order. Please link your bank again.";
const PLAID_V2_FAILED = "We couldn't connect your bank right now. Please try again or choose another payment method.";
const PLAID_V2_REF = /^[A-Za-z0-9_.:-]{8,200}$/;
// Never forwarded or logged from a Plaid checkout body (CellPay's step-3 body is rebuilt from an allowlist anyway).
const PLAID_V2_DROP = ["plaid_token", "plaid_id", "plaid_request_id", "public_token", "publicToken", "plaid_metadata", "metadata",
  "access_token", "accessToken", "plaid_access_token"];

type PlaidV2Order = { carrierId: string; plan: string; phone: string; amount: string; email: string; slug: string };

/** The six order values steps 2 and 3 must share, canonical. null = missing or malformed (plan_id may be absent: range plans). */
function plaidV2Order(p: Record<string, unknown>, email: unknown, slug: unknown): PlaidV2Order | null {
  const carrierId = text(p.carrierId ?? p.carrier_id);
  const plan = text(p.plan_id) ?? "";
  let phone = String(p.phone_number ?? "").replace(/\D/g, "");
  if (phone.length === 11 && phone.startsWith("1")) phone = phone.slice(1);
  const amt = Number(p.amount);
  const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const s = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!carrierId || carrierId.length > 32 || plan.length > 64 || !/^\d{10}$/.test(phone) || !Number.isFinite(amt) || amt <= 0 ||
      mail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || !/^[a-z0-9_-]{1,64}$/.test(s)) return null;
  return { carrierId, plan, phone, amount: amt.toFixed(2), email: mail, slug: s };
}

/** HMAC with the house key (GUARD_HASH_KEY, else the service role key), like ap1Hash / dedupe / cooldown. */
async function plaidV2Hash(label: string, value: string): Promise<string> {
  const key = Deno.env.get("GUARD_HASH_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`plv2|${label}|${value}`)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Store keys: ref_h identifies the plaid_ref, bind_h binds it to the six order values. Neither the ref nor PII is stored. */
async function plaidV2Keys(ref: string, o: PlaidV2Order): Promise<{ refH: string; bindH: string }> {
  return {
    refH: await plaidV2Hash("ref", ref),
    bindH: await plaidV2Hash("bind", [ref, o.carrierId, o.plan, o.phone, o.amount, o.email, o.slug].join("\u001f")),
  };
}

/** Link onSuccess metadata: Plaid's documented non-secret fields only; anything token-like is dropped. */
function plaidV2Meta(v: unknown): Record<string, unknown> {
  const s = (x: unknown, max = 128) => (typeof x === "string" && x.length <= max && !PLAID_TOKEN_ONE.test(x) ? x : undefined);
  const clean = (o: Record<string, unknown>) => JSON.parse(JSON.stringify(o)) as Record<string, unknown>;   // drops undefined
  const acct = (a: unknown) => {
    const r = asRecord(a);
    return clean({ id: s(r.id), name: s(r.name), mask: s(r.mask, 8), type: s(r.type, 32), subtype: s(r.subtype, 32),
      verification_status: s(r.verification_status, 64) });
  };
  const m = asRecord(v), inst = asRecord(m.institution);
  return clean({
    institution: m.institution ? clean({ name: s(inst.name), institution_id: s(inst.institution_id, 64) }) : undefined,
    accounts: Array.isArray(m.accounts) ? m.accounts.slice(0, 10).map(acct) : undefined,
    account: m.account ? acct(m.account) : undefined,
    account_id: s(m.account_id),
    link_session_id: s(m.link_session_id),
    transfer_status: s(m.transfer_status, 32),
  });
}

/** The reply's data layer: { data: { data: {...} } }, { data: {...} } or flat. */
function plaidV2Data(top: Record<string, unknown>): Record<string, unknown> {
  const d = asRecord(top.data), inner = asRecord(d.data);
  return Object.keys(inner).length ? inner : Object.keys(d).length ? d : top;
}

const plaidV2Str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null);
const plaidV2Word = (v: unknown): string => (typeof v === "string" && /^[A-Za-z0-9_]{1,32}$/.test(v) ? v : "none");

/** CellPay's error shape {success:false, error, code?, errors?} for the browser, token-scrubbed. */
function plaidV2Upstream(parsed: unknown, fallback: string): Record<string, unknown> {
  const top = asRecord(parsed);
  const own = plaidV2Str(top.error) ?? plaidV2Str(top.message);
  const msg = own ?? fallback;
  const out: Record<string, unknown> = { success: false, error: msg, message: msg };
  if (!own) out.msg_by = "proxy"; // our fallback text, not CellPay's: the site may show it in the page language
  if (typeof top.code === "string") out.code = top.code.slice(0, 64);
  if (top.errors && typeof top.errors === "object") out.errors = top.errors;
  scrubPlaidSecrets(out);
  return out;
}

/** One PII-free outcome row for the watch: a code word and the step (or the checkout's log id). Never a token or value. */
function plaidV2Event(code: string, shape: string, origin: string | null): void {
  recordGuardEvent({ code: code.slice(0, 100), method: "POST", endpoint_shape: shape, origin_host: originHost(origin), has_origin: origin !== null });
}

/** Steps 1 and 2 (browser actions). Always a 200 JSON reply in the proxy's usual { success, ... } shape. */
async function plaidV2Action(
  action: string,
  body: Record<string, unknown>,
  cors: Record<string, string>,
  apiKey: string,
  apiSecret: string,
  origin: string | null,
): Promise<Response> {
  const reply = (b: Record<string, unknown>) => new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  // msg_by "proxy": the proxy wrote this text (the site shows its own /es wording); CellPay's `error` never carries it.
  const refuse = (code: string, msg: string) => reply({ success: false, code, error: msg, message: msg, msg_by: "proxy" });
  const step = action === PLAID_V2_LINK ? "link" : "exchange";
  if (!(await plaidExchangeOn())) {
    plaidV2Event(`plv2:off:${step}`, action, origin);
    return refuse("plaid_unavailable", PLAID_V2_UNAVAILABLE);
  }
  const p = asRecord(body.payload);
  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    "X-Api-Secret": apiSecret,
    "X-Cellpay-Domain": resolveCellpayDomain(typeof body.callerHost === "string" ? body.callerHost : null),
    "Content-Type": "application/json",
    "Accept": "*/*",
  };
  if (typeof body.bearerToken === "string" && body.bearerToken) headers["Authorization"] = `Bearer ${body.bearerToken}`;
  try {
    if (step === "link") {
      if (!/^1?\d{10}$/.test(String(p.phone_number ?? "").replace(/\D/g, ""))) {
        plaidV2Event("plv2:link:invalid", action, origin);
        return refuse("invalid_request", GUARD_MESSAGES.invalid_request);
      }
      const res = await fetch(`${API_BASE}/payments/plaid/link-token`, {
        method: "POST", headers, body: JSON.stringify({ phone_number: p.phone_number }), signal: AbortSignal.timeout(8000),
      });
      const parsed = await res.json().catch(() => null);
      const lt = plaidV2Data(asRecord(parsed)).link_token;
      const linkToken = typeof lt === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(lt) ? lt : null;
      if (!res.ok || !linkToken || asRecord(parsed).success === false) {
        plaidV2Event(`plv2:link:http${res.status}${linkToken ? "" : ":no_token"}`, action, origin);
        return reply(plaidV2Upstream(parsed, "Could not create Plaid link"));
      }
      plaidV2Event("plv2:link:ok", action, origin);
      return reply({ success: true, data: { link_token: linkToken } });
    }

    const order = plaidV2Order(p, p.email, p.slug);
    const publicToken = typeof p.public_token === "string" ? p.public_token.trim() : "";
    if (!order || !PLAID_PUBLIC_TOKEN.test(publicToken)) {
      plaidV2Event(`plv2:exchange:${order ? "bad_token" : "invalid"}`, action, origin);
      return refuse("invalid_request", GUARD_MESSAGES.invalid_request);
    }
    const exchange: Record<string, unknown> = { carrierId: p.carrierId ?? p.carrier_id };
    if (order.plan) exchange.plan_id = p.plan_id;
    Object.assign(exchange, { phone_number: p.phone_number, amount: p.amount, email: String(p.email).trim(), slug: p.slug,
      public_token: publicToken, metadata: plaidV2Meta(p.metadata) });
    const res = await fetch(`${API_BASE}/payments/plaid/exchange-token`, {
      method: "POST", headers, body: JSON.stringify(exchange), signal: AbortSignal.timeout(10000),
    });
    const parsed = await res.json().catch(() => null);
    const top = asRecord(parsed);
    if (!res.ok || top.success === false) {
      plaidV2Event(`plv2:exchange:http${res.status}:${plaidV2Word(top.code)}`, action, origin);
      return reply(plaidV2Upstream(parsed, PLAID_V2_FAILED));
    }
    const d = plaidV2Data(top);
    const ref = typeof d.plaid_ref === "string" && PLAID_V2_REF.test(d.plaid_ref) ? d.plaid_ref : null;
    const decisionWord = typeof d.decision === "boolean" ? String(d.decision) : plaidV2Word(d.decision);
    plaidV2Event(`plv2:exchange:d=${decisionWord}:ref=${ref ? "yes" : "no"}`, action, origin);
    if (d.decision === false || d.decision === "false" || d.decision === 0 || ref === null) {
      return refuse("plaid_declined", PLAID_V2_DECLINED);
    }
    const ttlIn = Math.round(Number(d.plaid_ref_expires_in));
    const ttl = Number.isFinite(ttlIn) && ttlIn >= 60 ? Math.min(ttlIn, 3600) : 3600;
    const { refH, bindH } = await plaidV2Keys(ref, order);
    const bound = asRecord(await ap1Rpc("plaid_v2_bind", { _ref_h: refH, _bind_h: bindH, _ttl_s: ttl }, 1500).catch(() => null));
    if (bound.bound !== true) {
      plaidV2Event("plv2:exchange:bind_error", action, origin);
      return refuse("plaid_bind", PLAID_V2_FAILED);
    }
    const shown = (x: unknown, max: number) => (typeof x === "string" && !PLAID_TOKEN_ONE.test(x) ? x.slice(0, max) : "");
    return reply({ success: true, data: {
      decision: typeof d.decision === "boolean" || typeof d.decision === "string" ? d.decision : true,
      plaid_ref: ref,
      plaid_ref_expires_in: ttl,
      account_name: shown(d.account_name, 80),
      account_mask: shown(d.account_mask, 8),
      name: shown(d.name, 80),
    } });
  } catch (error) {
    plaidV2Event(`plv2:${step}:error:${error instanceof Error ? error.name.slice(0, 24) : "unknown"}`, action, origin);
    return refuse(step === "link" ? "plaid_link" : "plaid_exchange", step === "link" ? "Could not create Plaid link" : PLAID_V2_FAILED);
  }
}

/** Step 3: claim the bound plaid_ref (single use) and build CellPay's exact v2 checkout body. Never throws, never logs a token. */
async function plaidV2CheckoutBody(p: Record<string, unknown>): Promise<{ body: string } | { fail: Record<string, unknown>; why: string }> {
  const fail = (code: string, msg: string, why: string) =>
    ({ fail: { success: false, code, error: msg, message: msg, msg_by: "proxy", data: { status: false, message: msg } } as Record<string, unknown>, why });
  if (!(await plaidExchangeOn())) return fail("plaid_unavailable", PLAID_V2_UNAVAILABLE, "off");
  const ref = typeof p.plaid_ref === "string" && PLAID_V2_REF.test(p.plaid_ref) ? p.plaid_ref : null;
  if (!ref) return fail("plaid_ref", PLAID_V2_RELINK, "no_ref");
  const pay = asRecord(p.payment);
  const order = plaidV2Order(p, pay.email, p.carrier_slug ?? p.slug);
  if (!order) return fail("invalid_request", GUARD_MESSAGES.invalid_request, "bad_order");
  try {
    const { refH, bindH } = await plaidV2Keys(ref, order);
    const claim = asRecord(await ap1Rpc("plaid_v2_claim", { _ref_h: refH, _bind_h: bindH }, 1500));
    if (claim.result !== "ok") return fail("plaid_ref", PLAID_V2_RELINK, `bind_${plaidV2Word(claim.result)}`);
  } catch {
    return fail("plaid_bind", PLAID_V2_FAILED, "claim_error");
  }
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const out: Record<string, unknown> = { checkout_version: "5.0", payment_method: "plaid", plaid_ref: ref, carrierId: p.carrierId ?? p.carrier_id };
  if (order.plan) out.plan_id = p.plan_id;
  Object.assign(out, { phone_number: p.phone_number, amount: p.amount, agree_desktop: true,
    payment: { firstName: str(pay.firstName, 64), lastName: str(pay.lastName, 64), email: str(pay.email, 254) } });
  return { body: JSON.stringify(out) };
}

/** Removes any Plaid token from an upstream response before it is logged or returned to the browser. */
function scrubPlaidSecrets(value: unknown, depth = 0): void {
  if (depth > 8 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === "string") value[i] = (value[i] as string).replace(PLAID_TOKEN_ANYWHERE, "[redacted]");
      else scrubPlaidSecrets(value[i], depth + 1);
    }
    return;
  }
  const r = value as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (PLAID_SECRET_KEYS.test(k)) delete r[k];
    else if (typeof v === "string") r[k] = v.replace(PLAID_TOKEN_ANYWHERE, "[redacted]");
    else scrubPlaidSecrets(v, depth + 1);
  }
}

// [plaid v2] Kill switch: fraud_controls.plaid_exchange_mode = 'off' disables Pay by Bank server-side (all three steps answer
// code plaid_unavailable; nothing is sent to CellPay). It was Fix C's "forward as before" switch.
// Missing row = on. A failed or slow read keeps the LAST KNOWN mode (on only if this isolate has never read it), so a slow
// read right after KILL-C can't switch the exchange back on. Read only for Plaid checkouts, cached 30 s.
let plaidModeCache: { at: number; on: boolean } | null = null;
async function plaidExchangeOn(): Promise<boolean> {
  if (plaidModeCache && Date.now() - plaidModeCache.at < 30000) return plaidModeCache.on;
  const fallback = plaidModeCache?.on ?? true;
  let on = fallback;
  try {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/fraud_control_get`, { method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ _key: "plaid_exchange_mode" }), signal: AbortSignal.timeout(800) });
    if (r.ok) { const t = await r.text(); on = !(t && JSON.parse(t) === "off"); } else { await r.body?.cancel(); }
  } catch { on = fallback; }
  plaidModeCache = { at: Date.now(), on };
  return on;
}

// [PAYPAL-1008] PayPal create-order / capture-order (Parvez, Oct 8 2026). Same order log as cards (transaction_logs via
// log_transaction_attempt, payment_method 'paypal', metadata.paypal_order_id + paypal_step) and the same server-side guards as cards:
// BL-2 blocklist + Fix F refill cooldown before create-order, BL-3 duplicate claim before capture-order (the charge). Every guard and
// every log write fails open: a database error or timeout never changes or blocks a PayPal answer. The site adds pp_meta (log and
// guard fields only); it is removed here, so CellPay receives exactly the payload it received before. The reply to the browser is
// CellPay's reply as before, plus pending_log_id on create-order; a refused request gets the same calm 200 shape as a card refusal.
const PP_CREATE = "payments/paypal/create-order";
const PP_CAPTURE = "payments/paypal/capture-order";
const PP_CREATE_ENABLED = true; // [PAYPAL-REBUILD-1009] deploy 3: on for everyone; kill switch fraud_controls.paypal_mode = 'off' (instant)
// [PAYPAL-REBUILD-1009] CellPay's PayPal flow (Yasir, Oct 9 2026 08:27 CT): the PayPal button only gets the buyer's approval. The site
// then sends POST checkout/transaction with payment_method "paypal", paypal_authorization (the whole onApprove object as ONE JSON
// string, incl. orderID + payerID) and payment {firstName, lastName, email}; CellPay takes the money. We never capture.
const PP_TX_ENABLED = true; // [PAYPAL-REBUILD-1009] deploy 3: on for everyone; kill switch fraud_controls.paypal_mode = 'off' (instant)
const PP_CAPTURE_RETIRED = true; // capture-order is never forwarded any more (capturing ourselves was the wrong flow)
const PP_AUTH_MAX = 4096;
const PP_ORDER_RE = /^[A-Z0-9]{8,32}$/;
const PP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PP_UNAVAILABLE_MSG = "PayPal is not available right now. Please use another payment method. You were not charged.";
// Switches: code constant true = live for everyone unless fraud_controls.paypal_mode = 'off' (kill switch; a failed read keeps it on).
// Code constant false = only fraud_controls.paypal_mode = 'qa' AND the phone listed in fraud_controls.paypal_qa_phones (comma list of
// 10-digit numbers); missing rows or a failed read = refused. Cached 30 s.
let ppModeCache: { at: number; mode: string | null; qa: string[] } | null = null;
async function ppControls(): Promise<{ mode: string | null; qa: string[] } | null> {
  if (ppModeCache && Date.now() - ppModeCache.at < 30000) return ppModeCache;
  try {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const get = async (k: string): Promise<string | null> => {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/fraud_control_get`, { method: "POST",
        headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ _key: k }), signal: AbortSignal.timeout(800) });
      if (!r.ok) { await r.body?.cancel(); throw new Error(`http_${r.status}`); }
      const t = await r.text();
      const v = t ? JSON.parse(t) : null;
      return typeof v === "string" ? v : null;
    };
    const [mode, qa] = await Promise.all([get("paypal_mode"), get("paypal_qa_phones")]);
    ppModeCache = { at: Date.now(), mode: mode ? mode.trim().toLowerCase() : null,
      qa: (qa ?? "").split(",").map((x) => x.replace(/\D/g, "").slice(-10)).filter((x) => x.length === 10) };
    return ppModeCache;
  } catch {
    return null;
  }
}
async function ppAllowed(liveFlag: boolean, phone: unknown): Promise<boolean> {
  const c = await ppControls();
  if (liveFlag) return !c || c.mode !== "off";
  if (!c || c.mode !== "qa") return false;
  const ph = String(phone ?? "").replace(/\D/g, "").slice(-10);
  return ph.length === 10 && c.qa.includes(ph);
}
/** paypal_authorization must be ONE JSON string (<= 4 KB) of PayPal's approval object with orderID + payerID. Returns orderID or null. */
function ppAuthOrderId(v: unknown): string | null {
  if (typeof v !== "string" || v.length < 10 || v.length > PP_AUTH_MAX) return null;
  try {
    const o = asRecord(JSON.parse(v));
    const oid = typeof o.orderID === "string" ? o.orderID.trim() : "";
    const payer = typeof o.payerID === "string" ? o.payerID.trim() : "";
    return PP_ORDER_RE.test(oid) && /^[A-Z0-9]{6,32}$/.test(payer) ? oid : null;
  } catch {
    return null;
  }
}
/** Removes PayPal approval secrets (facilitatorAccessToken, a paypal_authorization echo) from a reply before it is logged or returned. */
function ppScrub(value: unknown, depth = 0): void {
  if (depth > 8 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const x of value) ppScrub(x, depth + 1); return; }
  const r = value as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    if (/^(facilitatorAccessToken|facilitator_access_token|paypal_authorization|access_token)$/i.test(k)) delete r[k];
    else ppScrub(r[k], depth + 1);
  }
}
const PP_META_KEYS = ["phone_number", "carrierId", "plan_id", "amount", "total", "email", "carrier_slug", "carrier_name", "browser_info", "kount_ssid", "source"];
const PP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PP_BLOCK_MSG = "We couldn't process this payment right now. Please try again in about 30 minutes or use a different payment method. You were not charged.";
const PP_DUP_MSG = "This payment is already being processed. Please wait a moment before trying again; you will not be charged twice.";

/** First non-empty value of one of `keys` in CellPay's reply, up to 5 objects deep (arrays skipped). */
function ppDeep(v: unknown, keys: string[], depth = 0): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v) || depth > 5) return null;
  const r = v as Record<string, unknown>;
  for (const k of keys) {
    const x = r[k];
    if ((typeof x === "string" && x.trim()) || (typeof x === "number" && Number.isFinite(x))) return String(x).trim().slice(0, 128);
  }
  for (const x of Object.values(r)) {
    const f = ppDeep(x, keys, depth + 1);
    if (f) return f;
  }
  return null;
}

async function paypalAction(
  path: string,
  body: Record<string, unknown>,
  url: string,
  headers: Record<string, string>,
  cors: Record<string, string>,
  callerHost: string | undefined,
  userAgent: string | null,
  origin: string | null,
): Promise<Response> {
  const reply = (obj: unknown) => new Response(JSON.stringify(obj), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  const isCreate = path === PP_CREATE;
  // [PAYPAL-HIDE-1154] Oct 8 2026: new PayPal orders refused server-side (nothing sent to CellPay or PayPal). Capture-order is NOT
  // affected, so orders already approved are still captured and logged. Re-enable: set PP_CREATE_ENABLED = true.
  // [PAYPAL-REBUILD-1009] PP_CREATE_ENABLED stays the master switch; while it is false only the QA allowlist (fraud_controls) passes.
  if (isCreate && !(await ppAllowed(PP_CREATE_ENABLED, asRecord(body.payload).phone_number))) {
    try { recordGuardEvent({ code: "paypal_disabled", method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null }); } catch { /* ignore */ }
    return reply({ success: false, blocked: true, code: "PAYPAL_UNAVAILABLE", message: "PayPal is not available right now. Please use another payment method. You were not charged." });
  }
  // [PAYPAL-REBUILD-1009] capture-order retired: CellPay takes the money inside checkout/transaction. Nothing is sent to CellPay or
  // PayPal; an approved-but-uncaptured PayPal order moves no money.
  if (!isCreate && PP_CAPTURE_RETIRED) {
    try { recordGuardEvent({ code: "paypal_capture_retired", method: "POST", endpoint_shape: PP_CAPTURE, origin_host: originHost(origin), has_origin: origin !== null }); } catch { /* ignore */ }
    return reply({ success: false, blocked: true, code: "PAYPAL_CAPTURE_RETIRED", message: "Please refresh the page and tap PayPal again. You were not charged." });
  }
  const payload = asRecord(body.payload);
  // REFUNDED-STATE-1017: BAD_PHONE guard on PayPal create-order (nothing sent to CellPay or PayPal).
  if (isCreate && !phoneOk10(payload)) return await badPhoneReply(payload, callerHost, userAgent, cors, origin, PP_CREATE);
  const meta = asRecord(payload.pp_meta);
  const fwd: Record<string, unknown> = { ...payload };
  delete fwd.pp_meta;
  // [PAYPAL-CAPTURE-1008] CellPay capture-order validates orderID + payerID ("orderID is required, payerID is required", 08:45 CT).
  // The site now sends order_id + orderID + payerID (from PayPal onApprove). A page loaded before that publish sends only order_id,
  // so orderID is filled from it here; payerID can only come from PayPal in the browser.
  if (!isCreate && (fwd.orderID === undefined || fwd.orderID === null || fwd.orderID === "") && typeof fwd.order_id === "string" && fwd.order_id) fwd.orderID = fwd.order_id;
  // [PAYPAL-CTX-1008] CellPay capture-order also needs the create-order context (amount, phone_number, carrierId, slug; optional
  // email). CellPay keeps it in a session that these server-to-server calls never share, so every capture failed with "PayPal order
  // context not found in session" (probe 10:47 CT Oct 8). Filled from OUR create row for this PayPal order (the values CellPay
  // created the order with; they replace anything the page sent), else from the page's pp_meta (missing fields only). 800 ms, fail-open.
  if (!isCreate) {
    const ppOid = text(fwd.orderID) ?? text(fwd.order_id);
    let ctx: Record<string, unknown> = {};
    if (ppOid) {
      try {
        const lid = text(meta.pending_log_id);
        ctx = asRecord(await Promise.race([
          callDatabaseRpc("paypal_capture_context", { _order_id: ppOid, _log_id: lid && PP_UUID_RE.test(lid) ? lid : null }),
          new Promise((res) => setTimeout(() => res(null), 800)),
        ]));
      } catch { ctx = {}; }
    }
    const fromLog = ctx.found === true;
    const num = (v: unknown) => { const n = Number(v); return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? n : undefined; };
    const want: Record<string, unknown> = fromLog
      ? { amount: num(ctx.amount), total: num(ctx.total), phone_number: text(ctx.phone_number), carrierId: num(ctx.carrier_id), plan_id: text(ctx.plan_id), slug: text(ctx.carrier_slug) ?? text(meta.carrier_slug), email: text(ctx.email) ?? text(meta.email) }
      : { amount: num(meta.amount), total: num(meta.total), phone_number: text(meta.phone_number), carrierId: num(meta.carrierId), plan_id: text(meta.plan_id), slug: text(meta.carrier_slug), email: text(meta.email) };
    for (const [k, v] of Object.entries(want)) {
      if (v === undefined || v === null || v === "") continue;
      if (fromLog || fwd[k] === undefined || fwd[k] === null || fwd[k] === "") fwd[k] = v;
    }
    console.log(`[paypal-ctx] capture context from ${fromLog ? "log" : "page"} (${["amount", "phone_number", "carrierId", "slug"].filter((k) => fwd[k] !== undefined && fwd[k] !== null && fwd[k] !== "").length}/4 required fields)`);
  }
  // Log / guard view of this order: the site's pp_meta fields, then the payload CellPay gets (wins), payment_method 'paypal'.
  const lr: Record<string, unknown> = {};
  for (const k of PP_META_KEYS) if (meta[k] !== undefined && meta[k] !== null && meta[k] !== "") lr[k] = meta[k];
  Object.assign(lr, fwd, { payment_method: "paypal" });
  delete lr.order_id;
  delete lr.orderID;
  delete lr.payerID;
  let refillKey: string | null = null;
  try { refillKey = await refillCooldownKey(lr); } catch { refillKey = null; }

  if (isCreate) {
    // VZ-PREPAID-GUARD-1017: no order row exists yet; only the PII-free guard event is written.
    const vzReply = await vzGuardGate(lr, body.lang, "paypal", {
      lookup: async (_phone) => await callDatabaseRpc("vz_prepaid_guard_check", { _phone }) as { refunded: boolean; success: boolean },
      logFailedRow: async () => {},
      event: (code) => recordGuardEvent({ code, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(origin), has_origin: origin !== null }),
    });
    if (vzReply) return reply(vzReply);
    const tmoReply = await tmoGuardGate(lr, body.lang, { // TMO-LOOKUP-1020
      lookup: async (_phone) => await callDatabaseRpc("tmo_retry_guard_check", { _phone }) as { blocked: boolean; retry_after: number }, // TMO-LOOKUP-1020
      event: (code) => recordGuardEvent({ code, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(origin), has_origin: origin !== null }), // TMO-LOOKUP-1020
    }); // TMO-LOOKUP-1020
    if (tmoReply) return reply(tmoReply); // TMO-LOOKUP-1020
    // [BL-2] blocklist (1.2 s, fail-open)
    try {
      const bl = await blocklistCheck(lr, null);
      if (bl) {
        recordGuardEvent({ code: `blocklist_hit:${bl.reason}:${bl.key_type}`, method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null });
        return reply({ success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, message: PP_BLOCK_MSG });
      }
    } catch { /* blocklist fails open */ }
    // [FRAUD-MULTIBLOCK-1012] multi-factor block (device / card / address keys present on this order view only). Fail-open.
    // Mode first: on = await check; shadow = background only; off = skip.
    try {
      const mfPp = buildMf(lr, {}, "paypal");
      const mfMode = await mfBlockMode();
      if (mfMode === "on") {
        const mfHit = await mfBlocklistCheck(mfPp);
        if (mfHit) {
          recordGuardEvent({ code: `mfblock_on:${mfHit.reason}:${mfHit.key_type}`, method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null });
          return reply({ success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, message: PP_BLOCK_MSG });
        }
      } else if (mfMode === "shadow") {
        mfShadowLater(mfPp, PP_CREATE, originHost(origin), origin !== null);
      }
    } catch { /* mfblock fails open */ }
    // [Fix F] refill cooldown (1 s, fail-open)
    try {
      const cd = refillKey ? await refillCooldownRpc("refill_cooldown_check", refillKey) : null;
      if (cd && cd.cooldown === true) {
        const ra = Math.round(Number(cd.retry_after));
        const retryAfter = Number.isFinite(ra) && ra >= 1 && ra <= REFILL_COOLDOWN_S ? ra : REFILL_COOLDOWN_S;
        recordGuardEvent({ code: "refill_cooldown_hit", method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null });
        return reply({ success: false, blocked: true, code: "REFILL_COOLDOWN", retry_after: retryAfter, message: REFILL_COOLDOWN_MSG });
      }
    } catch { /* refill cooldown fails open */ }
    // [DUPCHARGE-1008 reuse] Same duplicate-charge guard as checkout/transaction (dupchargeCheck, checkout_guard_controls.dupcharge
    // on | shadow | off, fail-open): session already paid -> SESSION_PAID; same phone + amount paid in the last 10 min -> DUP_CONFIRM
    // unless the customer tapped PayPal again after that warning (pp_meta.dup_confirm, site-only, never sent to CellPay).
    try {
      const dc = await dupchargeCheck(lr);
      const dcMode = dc ? String(dc.mode ?? "off") : "off";
      if (dc && dcMode !== "off" && (dc.session_paid === true || dc.recent === true)) {
        const enforce = dcMode === "on";
        const kind = dc.session_paid === true ? "session_paid" : meta.dup_confirm === true ? "confirmed" : "ask";
        recordGuardEvent({ code: `dupcharge_${enforce ? "" : "shadow_"}${kind}`, method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null });
        const paidNum = Number(dc.paid_total);
        const paid = Number.isFinite(paidNum) && paidNum > 0 ? paidNum.toFixed(2) : (numberText(lr.total) ?? numberText(lr.amount) ?? "");
        if (enforce && kind === "session_paid") {
          return reply({ success: false, blocked: true, code: "SESSION_PAID", hashid: text(dc.ref), amount: paid, message: `This order is already paid ($${paid}), so we did not charge you again. Your receipt was sent by email.` });
        }
        if (enforce && kind === "ask") {
          return reply({ success: false, blocked: true, code: "DUP_CONFIRM", amount: paid, message: `You just paid $${paid} for this number, charge again? You were not charged this time.` });
        }
      }
    } catch { /* dupcharge fails open */ }
  } else {
    // [BL-3] duplicate claim on the charge step: same phone + amount + 'paypal' captured in the last 10 s is refused (the second
    // PayPal order stays approved but uncaptured, so it is never charged). Needs the site's phone + amount; skipped without them.
    try {
      const ph = String(lr.phone_number ?? "").replace(/\D/g, "");
      if (ph.length >= 10 && numberText(lr.amount) && await dedupeClaim(lr, "paypal")) {
        recordGuardEvent({ code: "dedupe_hit", method: "POST", endpoint_shape: PP_CAPTURE, origin_host: originHost(origin), has_origin: origin !== null });
        return reply({ success: false, blocked: true, code: "DUPLICATE", message: PP_DUP_MSG });
      }
    } catch { /* dedupe fails open */ }
  }

  // CellPay call: same request as before (pp_meta removed).
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(asciiNamesCopy(fwd)) }); // ACCENT-FOLD-1015
  const rawText = await response.text();
  let data: unknown;
  try { data = JSON.parse(rawText); } catch { data = { raw: rawText, parseError: true }; }
  let wrapped: Record<string, unknown> = response.ok
    ? { success: true, data }
    : { success: false, error: (data as Record<string, unknown>)?.message || (data as Record<string, unknown>)?.error || "Request failed", data };
  // SUCCESS-FLAG-FIX-1016: capture only; never change PayPal create-order or its retired-route guard.
  const refundMarker = !isCreate ? refundSuccessMarker(wrapped) : null;
  if (refundMarker) wrapped = { success: true, data: { status: false, message: REFUND_FAILURE_MESSAGE, refund_signal: true } };
  const r = unwrapTransactionResult(wrapped);
  const arb = (): Record<string, unknown> => arbLogMeta(lr, body.bearerToken, body.lang);

  if (isCreate && PP_CAPTURE_RETIRED) {
    // [PAYPAL-REBUILD-1009] No transaction_logs row at create-order any more: the one order row is written by checkout/transaction
    // (payment_method paypal, metadata.paypal_order_id, paypal_step "transaction"). PII-free create outcome only (funnel has the rest).
    const ppOid = text(r.order_id) ?? text(r.id) ?? text(r.orderId);
    if (!ppOid) {
      try { recordGuardEvent({ code: `paypal_create_fail:http_${response.status}`, method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null }); } catch { /* ignore */ }
    }
    return reply(wrapped);
  }
  if (isCreate) {
    const orderId = text(r.order_id) ?? text(r.id) ?? text(r.orderId);
    try {
      // 3 s cap so a slow database never holds up the PayPal popup (a late row is closed by paypal_mark_abandoned).
      const logId = await Promise.race([
        createTransactionLog(lr, callerHost, userAgent, { ...arb(), paypal_order_id: orderId, paypal_step: "create" }),
        new Promise<null>((res) => setTimeout(() => res(null), 3000)),
      ]);
      if (logId) {
        // No PayPal order id = nothing for the customer to approve: close the row now (failed, or success for a direct success).
        if (!orderId) await finishTransactionLog(logId, wrapped, "paypal");
        wrapped.pending_log_id = logId;
      }
    } catch (error) {
      console.error("[paypal-log] create log failed:", error instanceof Error ? error.message : error);
    }
    return reply(wrapped);
  }

  // capture-order: success exactly as the site reads it (status true / success / completed); hashid + transaction id searched up to 5 levels deep.
  // The reply waits at most 4 s for the log writes; they keep running in the background after that (EdgeRuntime.waitUntil).
  const work = (async () => {
  try {
    const orderId = text(fwd.order_id) ?? text(fwd.orderID);
    const st = String(r.status ?? "").toLowerCase();
    const paid = r.status === true || st === "true" || st === "success" || st === "completed";
    const fin = {
      _order_id: orderId,
      _status: paid ? "success" : "failed",
      _hashid: ppDeep(wrapped, ["hashid"]),
      _transaction_id: ppDeep(wrapped, ["transactionId", "transaction_id"]),
      _error_message: paid ? null : (text(r.msg ?? r.message ?? wrapped.error) ?? (st ? `status:${st}` : "paypal_capture_failed")),
      _raw_response: refundMarker ? { ...asRecord(data), refund_signal: true, refund_marker: refundMarker } : r, // SUCCESS-FLAG-FIX-1016: original upstream audit
    };
    let res: Record<string, unknown> = {};
    const pendingId = text(meta.pending_log_id);
    if (orderId && pendingId && PP_UUID_RE.test(pendingId)) {
      try { res = asRecord(await callDatabaseRpc("paypal_finalize_log", { _id: pendingId, ...fin })); } catch { res = {}; }
    }
    if (orderId && res.ok !== true) {
      // No matching open create row (older site build, lost id, or already closed): one capture-only row so the outcome is logged.
      const id = await createTransactionLog(lr, callerHost, userAgent, { ...arb(), paypal_order_id: orderId, paypal_step: "capture", paypal_capture_only: true });
      if (id) res = asRecord(await callDatabaseRpc("paypal_finalize_log", { _id: id, ...fin }));
    }
    // [Fix F] CellPay's refill-error result starts the same 10-min cooldown as a card.
    if (isRefillErrorResult(wrapped)) {
      const key = refillKey ?? (res.ok === true ? await refillCooldownKey(res) : null);
      if (key) await refillCooldownRpc("refill_cooldown_mark", key);
    }
  } catch (error) {
    console.error("[paypal-log] capture log failed:", error instanceof Error ? error.message : error);
  }
  })();
  try {
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(work);
  } catch { /* background only */ }
  await Promise.race([work, new Promise((res) => setTimeout(res, 4000))]);
  return reply(wrapped);
}

// Private redacted upstream replies: background-only, 1.5 s budget, never changes the reply or parsed response.
function logRawCellPayReply(txLogId: string | null, endpoint: string, httpStatus: number, paymentMethod: string | null, data: unknown, rawText: string, parseFailed: boolean): void {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    // Also cover aliases that do not contain the requested sensitive-key terms; never retain card data or wallet cryptograms.
    const sensitiveKey = /card|cvv|cvc|exp|token|nonce|secret|password|account_number|routing|plaid|approval|profile|cc_?number|payment_?data|cryptogram|signature|security_?code/i;
    const scrubText = (value: string): string => value
      .replace(/\d{12,}/g, "[redacted]")
      .replace(/\b(?:[\w.-]*(?:card|cvv|cvc|exp|token|nonce|secret|password|account_number|routing|plaid|approval|profile|cc_?number|payment_?data|cryptogram|signature|security_?code)[\w.-]*)\s*[=:]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&<>]+)/gi, "[redacted]");
    const scrubCopy = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(scrubCopy);
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? "[redacted]" : scrubCopy(item)]));
      }
      return typeof value === "string" ? scrubText(value) : typeof value === "number" && Math.abs(value) >= 1e11 ? "[redacted]" : value;
    };
    const write = (async () => {
      try {
        await fetch(`${supabaseUrl}/rest/v1/cellpay_raw_replies`, {
          method: "POST",
          headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", prefer: "return=minimal" },
          body: JSON.stringify({ transaction_log_id: txLogId, endpoint, http_status: httpStatus, payment_method: paymentMethod,
            body: parseFailed ? null : scrubCopy(data), raw_text: parseFailed ? scrubText(rawText).slice(0, 4000) : null }),
          signal: AbortSignal.timeout(1500),
        });
      } catch { /* logging must never affect checkout */ }
    })();
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(write);
  } catch { /* logging must never affect checkout */ }
}

// [CARRIER-CHECK-LOG-1011] Fire-and-forget log of carriers/verify-phone/<slug> and carriers/validate/<slug> results. Never awaited by the reply path, never throws, 1.5 s cap, stores only carrier, kind, http status, CellPay message, last 4 of the phone and host.
function logCarrierCheck(endpoint: unknown, status: number, wrapped: Record<string, unknown>, payload: unknown, callerHost: unknown): void {
  try {
    const m = /^carriers\/(verify-phone|validate)\/([a-z0-9-]{1,40})$/.exec(String(endpoint ?? ""));
    if (!m) return;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    const outer = (wrapped ?? {}) as Record<string, unknown>;
    const inner = ((outer.data ?? {}) as Record<string, unknown>);
    const inner2 = ((inner.data ?? {}) as Record<string, unknown>);
    const ok = outer.success !== false && inner.success !== false && inner2.status !== false && inner2.Result !== "Error";
    const msg = String(inner2.Message ?? inner2.msg ?? inner.error ?? outer.error ?? "").slice(0, 120);
    const phoneRaw = String(((payload ?? {}) as Record<string, unknown>).phone_number ?? "").replace(/\D/g, "");
    const write = fetch(`${supabaseUrl}/rest/v1/carrier_check_log`, {
      method: "POST",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({
        carrier_slug: m[2], kind: m[1] === "validate" ? "validate" : "verify", http_status: status, ok, message: msg,
        phone_last4: phoneRaw.length >= 4 ? phoneRaw.slice(-4) : null, host: typeof callerHost === "string" ? callerHost.slice(0, 80) : null,
        // [FRAUD-MULTIBLOCK-1012 5b] full phone + checkout session join key (service role only table)
        ...(phoneRaw ? { phone: phoneRaw.slice(0, 15) } : {}),
        ...((): Record<string, string> => {
          const pr = (payload ?? {}) as Record<string, unknown>;
          const sid = text(pr.kount_ssid ?? pr.riskified_sessionid ?? pr.cbsys_sessionid);
          return sid ? { checkout_session_id: sid.slice(0, 100) } : {};
        })(),
      }),
      signal: AbortSignal.timeout(1500),
    }).then(() => {}).catch(() => {});
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(write);
  } catch {
    // never let logging affect the reply
  }
}

// [EMOJI-STRIP-1012] CellPay's billing DB (MySQL utf8, not utf8mb4) rejects 4-byte chars. Clean free-text fields only.
const FREE_TEXT_KEYS = new Set(["first_name","firstname","last_name","lastname","name","full_name","fullname","billing_name","cardholder_name","card_holder_name","holder_name","givenname","familyname","email","emailaddress","address","address1","address2","address_line1","address_line2","street","street_address","addresslines","city","locality","sublocality","state","administrativearea","subadministrativearea","country_name","note","notes","comment","comments","memo","company"]);
const SKIP_RECURSE = /token|paymentdata|signature|cryptogram|cp_dev|^mf|^mf_|fraud|risk|kount|riskified|cbsys|turnstile|gclid|gbraid|wbraid|amount|total|fee|price|_id$|^id$|hash/i;
// ACCENT-FOLD-1015B
const ASCII_NAME_KEY_RE = /^(first_?name|last_?name|given_?name|family_?name|full_?name|billing_?name|card_?holder_?name|holder_?name|name_?on_?card)$/i;
const ASCII_MAP: Record<string, string> = {
  "ı": "i", "İ": "I", "ł": "l", "Ł": "L", "ø": "o", "Ø": "O", "đ": "d", "Đ": "D", "ð": "d", "Ð": "D",
  "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "ß": "ss", "ẞ": "SS", "þ": "th", "Þ": "TH", "ħ": "h", "Ħ": "H",
  "ŀ": "l", "Ŀ": "L", "ŧ": "t", "Ŧ": "T", "ŋ": "n", "Ŋ": "N", "ĸ": "k", "ſ": "s", "ƒ": "f", "ñ": "n", "Ñ": "N",
  "‘": "'", "’": "'", "ʼ": "'", "´": "'", "`": "'", "‐": "-", "‑": "-", "–": "-", "—": "-",
};
const ASCII_MAP_RE = new RegExp("[" + Object.keys(ASCII_MAP).join("") + "]", "g");
function toAsciiName(s: string): string {
  return String(s ?? "")
    .replace(/[\t\r\n]/g, " ").replace(/\p{Cc}/gu, "") // NAME-SANITIZE-1018
    .replace(/[\p{Cf}\uFFFC\uFFFD\uFE00-\uFE0F\u20E3\u034F\u115F\u1160\u3164]/gu, "") // invisible chars removed outright
    .replace(ASCII_MAP_RE, (c) => ASCII_MAP[c] ?? "")
    .normalize("NFKD")                       // general fallback: compatibility + diacritic split (e.g. ﬁ -> fi, ｊ -> j)
    .replace(/\p{M}/gu, "")                  // all combining marks
    .replace(/[^A-Za-z0-9 .'\-]/g, " ")      // symbols, emoji, U+FFFC, zero-width, non-Latin scripts -> removed
    .replace(/\s+/g, " ")
    .replace(/^[\s.'\-]+|[\s.'\-]+$/g, "")   // no leading/trailing punctuation
    .trim().slice(0, 50).trim(); // NAME-SANITIZE-1018
}
const hasLatin = (s: string) => /[A-Za-z]/.test(s);
const FIRST_RE = /^(first_?name|given_?name)$/i, LAST_RE = /^(last_?name|family_?name)$/i;
function foldNameFields(o: Record<string, unknown>): Record<string, string> {
  const folded: Record<string, string> = {};
  for (const [k, x] of Object.entries(o)) if (typeof x === "string" && ASCII_NAME_KEY_RE.test(k)) folded[k] = toAsciiName(x);
  const keys = Object.keys(folded);
  const fk = keys.find((k) => FIRST_RE.test(k)), lk = keys.find((k) => LAST_RE.test(k));
  for (const k of keys) {
    if (hasLatin(folded[k])) continue;
    folded[k] = "Customer"; // never send an empty name // NAME-SANITIZE-1018
  }
  return folded;
}
function foldWalletNames(v: unknown, depth = 0): unknown { // NAME-SANITIZE-1018
  if (depth > 6 || v === null || typeof v !== "object") return v; // NAME-SANITIZE-1018
  if (Array.isArray(v)) return v.map((x) => foldWalletNames(x, depth + 1)); // NAME-SANITIZE-1018
  const src = v as Record<string, unknown>; // NAME-SANITIZE-1018
  const folded = foldNameFields(src); // NAME-SANITIZE-1018
  const out: Record<string, unknown> = {}; // NAME-SANITIZE-1018
  for (const [k, x] of Object.entries(src)) { // NAME-SANITIZE-1018
    if (k in folded) out[k] = folded[k]; // NAME-SANITIZE-1018
    else if (typeof x === "string" && /^name$/i.test(k)) { const a = toAsciiName(x); out[k] = /[A-Za-z]/.test(a) ? a : "Customer"; } // NAME-SANITIZE-1018
    else if (typeof x === "string" && /^phonetic.*name$/i.test(k)) out[k] = toAsciiName(x); // NAME-SANITIZE-1018
    else if (x && typeof x === "object" && !SKIP_RECURSE.test(k)) out[k] = foldWalletNames(x, depth + 1); // NAME-SANITIZE-1018
    else out[k] = x; // NAME-SANITIZE-1018
  } // NAME-SANITIZE-1018
  return out; // NAME-SANITIZE-1018
} // NAME-SANITIZE-1018
function asciiNamesCopy(v: unknown, depth = 0): unknown {
  if (depth > 6 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => asciiNamesCopy(x, depth + 1));
  const src = v as Record<string, unknown>;
  const folded = foldNameFields(src);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(src)) {
    if (k in folded) out[k] = folded[k];
    else if (WALLET_JSON_KEYS.includes(k)) { // NAME-SANITIZE-1018
      out[k] = x; // NAME-SANITIZE-1018
      try { // NAME-SANITIZE-1018
        const wallet = typeof x === "string" ? JSON.parse(x) : x; // NAME-SANITIZE-1018
        if (wallet && typeof wallet === "object" && !Array.isArray(wallet)) { // NAME-SANITIZE-1018
          const foldedWallet = foldWalletNames(wallet); // NAME-SANITIZE-1018
          out[k] = typeof x === "string" ? JSON.stringify(foldedWallet) : foldedWallet; // NAME-SANITIZE-1018
        } // NAME-SANITIZE-1018
      } catch { /* fail-open: leave unchanged */ } // NAME-SANITIZE-1018
    } // NAME-SANITIZE-1018
    else if (x && typeof x === "object" && !SKIP_RECURSE.test(k)) out[k] = asciiNamesCopy(x, depth + 1);
    else out[k] = x;
  }
  return out;
}
// ACCENT-FOLD-1015B: names as typed vs as sent to CellPay (same fold as the outbound body).
function namesSentMeta(p: unknown): Record<string, unknown> {
  try {
    const rec = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const pickNames = (r: Record<string, unknown>) => {
      const pay = (r.payment && typeof r.payment === "object" ? r.payment : {}) as Record<string, unknown>;
      const f = pay.firstName ?? pay.first_name ?? r.first_name; const l = pay.lastName ?? pay.last_name ?? r.last_name;
      return { first: typeof f === "string" ? f : null, last: typeof l === "string" ? l : null };
    };
    const orig = pickNames(rec);
    const wallet_names_folded = WALLET_JSON_KEYS.some((k) => { // NAME-SANITIZE-1018
      try { // NAME-SANITIZE-1018
        const wallet = typeof rec[k] === "string" ? JSON.parse(rec[k] as string) : rec[k]; // NAME-SANITIZE-1018
        return !!wallet && typeof wallet === "object" && !Array.isArray(wallet) && JSON.stringify(wallet) !== JSON.stringify(foldWalletNames(wallet)); // NAME-SANITIZE-1018
      } catch { return false; } // NAME-SANITIZE-1018
    }); // NAME-SANITIZE-1018
    if (orig.first === null && orig.last === null) return { wallet_names_folded }; // NAME-SANITIZE-1018
    const sent = pickNames(asciiNamesCopy(rec) as Record<string, unknown>);
    return { name_original: orig, name_sent_to_cellpay: sent, name_folded: orig.first !== sent.first || orig.last !== sent.last, wallet_names_folded }; // NAME-SANITIZE-1018
  } catch { return {}; }
}
function asciiNamesBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try { return JSON.stringify(asciiNamesCopy(JSON.parse(body))); } catch { return body; }
}
function cleanFreeText(s: string): string {
  return s
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")            // emoji & other non-BMP
    .replace(/[\uD800-\uDFFF]/g, "")                    // lone surrogates
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFE0E\uFE0F\u20E3]/g, "") // zero-width / bidi / variation selectors
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "") // control chars
    .replace(/[\t\r\n]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}
function sanitizeFreeText(v: unknown, depth = 0): void {
  if (!v || typeof v !== "object" || depth > 6) return;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const val = o[k];
    if (FREE_TEXT_KEYS.has(k.toLowerCase())) {
      if (typeof val === "string") o[k] = cleanFreeText(val);
      else if (Array.isArray(val)) o[k] = val.map((x) => (typeof x === "string" ? cleanFreeText(x) : x));
      else if (val && typeof val === "object" && !SKIP_RECURSE.test(k)) sanitizeFreeText(val, depth + 1);
    } else if (val && typeof val === "object" && !SKIP_RECURSE.test(k)) {
      sanitizeFreeText(val, depth + 1);
    }
  }
}

// WALLET-NAME-1016
const WALLET_JSON_KEYS = ["apple_pay_billing_contact", "gpay_billing_details"];
function cleanAllStrings(v: unknown, depth = 0): unknown {
  if (depth > 6) return v;
  if (typeof v === "string") return cleanFreeText(v);
  if (Array.isArray(v)) return v.map((x) => cleanAllStrings(x, depth + 1));
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = cleanAllStrings(x, depth + 1); return o; }
  return v;
}
function sanitizeWalletJson(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const p = payload as Record<string, unknown>;
  for (const k of WALLET_JSON_KEYS) {
    const val = p[k];
    try {
      if (typeof val === "string" && val.trim().startsWith("{")) p[k] = JSON.stringify(cleanAllStrings(JSON.parse(val)));
      else if (val && typeof val === "object") p[k] = cleanAllStrings(val);
    } catch { /* fail-open: leave unchanged */ }
  }
}

// NAME-DIGITS-1014: name keys checked for 6+ digits (per field, and first+last together in the same object). Nothing is logged.
const NAME_KEY_RE = /^(first_?name|last_?name|given_?name|family_?name|full_?name|billing_?name|card_?holder_?name|holder_?name|name_?on_?card)$/i;
function nameHasCardDigits(v: unknown, depth = 0): boolean {
  if (!v || typeof v !== "object" || depth > 6) return false;
  if (Array.isArray(v)) return v.some((x) => nameHasCardDigits(x, depth + 1));
  let sum = 0;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === "string" && NAME_KEY_RE.test(k)) {
      const d = x.replace(/\D/g, "").length;
      if (d >= 6) return true;
      if (/^(first|last|given|family)_?name$/i.test(k)) sum += d;
    } else if (x && typeof x === "object" && nameHasCardDigits(x, depth + 1)) return true;
  }
  return sum >= 6;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CELLPAY_API_KEY");
    const apiSecret = Deno.env.get("CELLPAY_API_SECRET");
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "API credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { endpoint, method = "GET", payload, bearerToken, callerHost } = body;
    // [EMOJI-STRIP-1012] clean free-text fields in place before any guard/log/forward (covers every route incl. PayPal + checkout/transaction).
    try { if (typeof method === "string" && method.toUpperCase() !== "GET") sanitizeFreeText(payload); } catch { /* fail-open */ }
    try { if (typeof method === "string" && method.toUpperCase() !== "GET") sanitizeWalletJson(payload); } catch { /* fail-open */ } // WALLET-NAME-1016
    // NAME-DIGITS-1014: a cardholder name with 6+ digits is likely a card number in the name field -> 400 before any log/store/forward.
    try {
      if (typeof method === "string" && method.toUpperCase() !== "GET" && nameHasCardDigits(payload)) {
        const ref = req.headers.get("referer") || "";
        const lg = String((body as Record<string, unknown>)?.lang ?? (payload as Record<string, unknown>)?.lang ?? "").toLowerCase();
        const es = lg.startsWith("es") || /\/es(\/|$)/.test((() => { try { return new URL(ref).pathname; } catch { return ""; } })());
        return new Response(JSON.stringify({ success: false, code: "NAME_INVALID", message: es ? "Ingrese el nombre que aparece en su tarjeta" : "Please enter the name on your card" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* fail-open: the check never breaks a request */ }

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // [proxy-guard 1a] Small block: malformed input -> 400; transactions/last, autopay/* and
    // endpoints that could escape their path -> 403. Everything else is forwarded exactly as before.
    const guardOrigin = req.headers.get("origin");
    if (typeof endpoint !== "string" || typeof method !== "string" || !GUARD_METHODS.has(method.toUpperCase())) {
      return guardRefusal(corsHeaders, 400, "invalid_request", method, endpoint, guardOrigin);
    }
    // PLAN-RANGES-1016: dry-run plan_guard check for our gates; never forwards, never writes a row.
    if (endpoint === "plan-guard/check" && method.toUpperCase() === "POST") {
      const pgr = await planGuard(asRecord(payload), pgHeaders(apiKey, apiSecret, callerHost), (body as Record<string, unknown>)?.lang);
      return new Response(JSON.stringify({ ok: pgr.ok, reason: pgr.reason ?? null, message: pgr.message ?? null, source: pgr.source === "none" ? "hub" : pgr.source }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (endpoint === "plans/ultra-plans" && (method.toUpperCase() === "GET" || method.toUpperCase() === "POST")) { // ULTRA-MDN-1029
      const um = String(asRecord(payload).mdn ?? (body as Record<string, unknown>)?.mdn ?? "").trim(); // ULTRA-MDN-1029
      if (!/^\d{10}$/.test(um)) return new Response(JSON.stringify({ success: false, code: "BAD_MDN" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); // ULTRA-MDN-1029
      const ur = await ultraMdnFetch(um, pgHeaders(apiKey, apiSecret, callerHost)); // ULTRA-MDN-1029
      const ub = ur.ok ? { success: true, data: ur.data } : { success: false, status: ur.status, ...(ur.message ? { message: ur.message } : {}) }; // ULTRA-MDN-1029
      return new Response(JSON.stringify(ub), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); // ULTRA-MDN-1029
    } // ULTRA-MDN-1029
    // [autopay AP-1] The single restored route (exact endpoint + method). Anything else under autopay/*,
    // and transactions/last, still falls through to the 1a "retired" 403 below.
    if (AP1_ROUTE_ENABLED && endpoint === AP1_ENDPOINT && method === "POST") {
      return await ap1HandleUnsubscribe(req, asRecord(body), corsHeaders, apiKey, apiSecret);
    }
    if (isRetiredEndpoint(endpoint)) {
      return guardRefusal(corsHeaders, 403, "retired", method, endpoint, guardOrigin);
    }
    if (!normalizeEndpoint(endpoint)) {
      return guardRefusal(corsHeaders, 403, "invalid_endpoint", method, endpoint, guardOrigin);
    }
    // [fix C / plaid v2] payments/plaid/exchange-token is server-to-server only (plaidV2Action); never forwarded for a browser.
    if (normalizeEndpoint(endpoint)?.segments.join("/") === "payments/plaid/exchange-token") {
      return guardRefusal(corsHeaders, 403, "not_allowed", method, endpoint, guardOrigin);
    }
    // [plaid v2] Pay by Bank steps 1-2 exist only as these two proxy actions (POST); nothing else under plaid-v2/ is served.
    const plaidV2Path = normalizeEndpoint(endpoint)?.segments.join("/") ?? "";
    if (plaidV2Path === "plaid-v2" || plaidV2Path.startsWith("plaid-v2/")) {
      if ((plaidV2Path === PLAID_V2_LINK || plaidV2Path === PLAID_V2_EXCHANGE) && method.toUpperCase() === "POST") {
        return await plaidV2Action(plaidV2Path, asRecord(body), corsHeaders, apiKey, apiSecret, guardOrigin);
      }
      return guardRefusal(corsHeaders, 403, "not_allowed", method, endpoint, guardOrigin);
    }

    // [SEC-1] transactions/orders family: the order list needs a verified login, the receipt passes, everything else is refused.
    const secRoute = sec1Route(endpoint, method);
    if (secRoute === "refuse") {
      return guardRefusal(corsHeaders, 403, "not_allowed", method, endpoint, guardOrigin);
    }
    if (secRoute === "list") {
      return await sec1HandleList(req, asRecord(body), corsHeaders, apiKey, apiSecret);
    }

    // Resolve dynamic X-Cellpay-Domain from caller's hostname (with fallback for lovable/dev hosts)
    const cellpayDomain = resolveCellpayDomain(callerHost);
    console.log(`[cellpay-proxy] callerHost="${callerHost}" -> X-Cellpay-Domain="${cellpayDomain}" (endpoint=${endpoint})`);

    const url = `${API_BASE}/${endpoint}`;
    const headers: Record<string, string> = {
      "X-Api-Key": apiKey,
      "X-Api-Secret": apiSecret,
      "X-Cellpay-Domain": cellpayDomain,
      "Content-Type": "application/json",
      "Accept": "*/*",
    };

    if (bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== "GET" && payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    // [PAYPAL-1008] PayPal create-order / capture-order: guards + order log (paypalAction above). Same CellPay URL and headers.
    const ppPath = normalizeEndpoint(endpoint)?.segments.join("/") ?? "";
    if (method.toUpperCase() === "POST" && (ppPath === PP_CREATE || ppPath === PP_CAPTURE) && endpoint === ppPath) {
      return await paypalAction(ppPath, asRecord(body), url, headers, corsHeaders, callerHost, req.headers.get("user-agent"), guardOrigin);
    }

    if (method.toUpperCase() === "POST" && ppPath === "payments/klarna/session") { // KLARNA-MIN25-1017
      const kp = asRecord(payload); // KLARNA-MIN25-1017
      const kmr = klarnaMinRefusal(kp.amount ?? kp.total, body.lang); // KLARNA-MIN25-1017
      if (kmr) { recordGuardEvent({ code: "klarna_min_session", method: "POST", endpoint_shape: "payments/klarna/session", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }); logKlarnaSession("refused_min_total", 200, kp.amount ?? kp.total, guardOrigin, body); return new Response(JSON.stringify(kmr), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); } // KLARNA-MIN25-1017 // KLARNA-LOG-1017
    } // KLARNA-MIN25-1017
    const isKlarnaSession = method.toUpperCase() === "POST" && ppPath === "payments/klarna/session"; // KLARNA-LOG-1017
    const shouldLogTransaction = endpoint === "checkout/transaction" && method === "POST";
    const payloadRecord = asRecord(payload);
    // [FRAUD-MULTIBLOCK-1012] cp_dev is site-only: read and removed here so CellPay never sees it (body rebuilt).
    const cpDev = asRecord(payloadRecord.cp_dev);
    if ("cp_dev" in payloadRecord) {
      delete payloadRecord.cp_dev;
      if (typeof fetchOptions.body === "string") fetchOptions.body = JSON.stringify(payloadRecord);
    }
    if ("ultraBarcode" in payloadRecord || "ultraPurchaseType" in payloadRecord) { // ULTRA-MDN-1029: site-only keys never reach CellPay
      delete payloadRecord.ultraBarcode; delete payloadRecord.ultraPurchaseType; // ULTRA-MDN-1029
      if (typeof fetchOptions.body === "string") fetchOptions.body = JSON.stringify(payloadRecord); // ULTRA-MDN-1029
    } // ULTRA-MDN-1029
    let mf: Mf | null = null;
    let mfIpP: Promise<Record<string, unknown> | null> = Promise.resolve(null);
    let riskAction: string | null = null;
    const reqIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const riskIp = riskClientIp(req); // [RISK-COVER-IP-1019] risk engine only; reqIp (mf metadata) unchanged
    const paymentMethod = text(payloadRecord.payment_method ?? payloadRecord.paymentMethod);
    // [plaid v2] A Plaid checkout carries no Plaid token or Link metadata past this point (guards, log row, CellPay).
    const isPlaidCheckout = shouldLogTransaction && (paymentMethod || "").toLowerCase() === "plaid";
    if (isPlaidCheckout) for (const k of PLAID_V2_DROP) delete payloadRecord[k];
    // [RISK-COVER-IP-1019] Shadow risk decision for EVERY checkout attempt, started here before any guard can refuse it. Background only
    // (waitUntilSafe): the mode read and the scoring never touch the customer's response or its timing. Enforce keeps its own path below.
    if (shouldLogTransaction) {
      try {
        const pay0 = asRecord(payloadRecord.payment);
        const m1 = buildMf(payloadRecord, cpDev, paymentMethod);
        const rin0 = {
          phone: text(payloadRecord.phone_number ?? payloadRecord.phoneNumber), email: text(pay0.email ?? payloadRecord.email),
          amount: Number(payloadRecord.amount), total: Number(payloadRecord.total), carrier_slug: text(payloadRecord.carrier_slug ?? payloadRecord.carrierSlug), // RISK-RULES-1020
          payment_method: paymentMethod, checkout_session_id: text(payloadRecord.kount_ssid ?? payloadRecord.riskified_sessionid ?? payloadRecord.cbsys_sessionid),
          cp_dev: { dev_fp: m1.device ?? undefined, dev_id: m1.did ?? undefined }, visitorId: m1.visitor,
          card_bin6: m1.bin6, card_last4: m1.last4, card_exp: m1.card_exp, addr_norm: m1.addr,
          ip: riskIp.ip, ip_src: riskIp.src, ip_country_hdr: riskIp.country,
        };
        waitUntilSafe((async () => {
          try {
            const md = await riskEngineMode();
            if (md !== "off" && md !== "enforce") await scoreRisk(rin0, md);
          } catch { /* shadow never throws */ }
        })());
      } catch { /* risk shadow fails open */ }
    }
    // [PAYPAL-REBUILD-1009] PayPal through checkout/transaction (CellPay takes the money). Before every other guard: switch / QA allowlist,
    // then the shape CellPay requires (paypal_authorization with orderID + payerID; payment firstName / lastName / email). A refusal is
    // a calm 200: nothing goes to CellPay, nothing is captured (the PayPal approval just expires). Then the normal card guards and the
    // normal order row (blocklist, refill cooldown, DUPCHARGE incl. IN_FLIGHT, BL-3 dedupe keyed on the PayPal order id, velocity).
    // REFUNDED-STATE-1017: BAD_PHONE guard (every method incl. Pockyt create). Never calls CellPay; failed log row + PII-free event.
    if (shouldLogTransaction && !phoneOk10(payloadRecord)) {
      return await badPhoneReply(payloadRecord, callerHost, req.headers.get("user-agent"), corsHeaders, guardOrigin, "checkout/transaction");
    }
    // BOOST-CAP-199-1016: Boost (plan 66666 / slug boost) payments max $199 (amount before fees). Refused before any CellPay call.
    if (shouldLogTransaction) {
      const bPlan = String(payloadRecord.plan_id ?? payloadRecord.planId ?? "").trim();
      const bSlug = String(payloadRecord.carrier_slug ?? "").trim().toLowerCase();
      const bAmt = Number(payloadRecord.amount ?? payloadRecord.refill_amount ?? NaN);
      if ((bPlan === "66666" || bSlug === "boost") && Number.isFinite(bAmt) && bAmt > 199) { // BOOST-CAP-199-1016
        return new Response(JSON.stringify({ success: false, message: "Boost payments max $199" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // PLAN-RANGES-1016: plan_guard before PayPal checks, guards, the log row and the CellPay fetch.
    if (shouldLogTransaction) {
      const pgr = await planGuard(payloadRecord, headers, (body as Record<string, unknown>)?.lang);
      if (!pgr.ok) {
        const pgSlug = String(payloadRecord.carrier_slug ?? "").trim().toLowerCase();
        const pgPlan = String(payloadRecord.plan_id ?? payloadRecord.planId ?? "").trim();
        const pgAmt = Number(payloadRecord.amount ?? payloadRecord.refill_amount ?? NaN);
        recordGuardEvent({ code: `plan_guard:${pgr.reason}`, method: "POST", endpoint_shape: `checkout/transaction#${pgSlug}:${pgPlan}:${pgAmt}`, origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
        return new Response(JSON.stringify({ success: false, blocked: true, code: "PLAN_GUARD", reason: pgr.reason, message: pgr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // VZ-PREPAID-GUARD-1017: after planGuard, before all payment-specific checks, normal logging and the upstream call.
    if (shouldLogTransaction) {
      const vzReply = await vzGuardGate(payloadRecord, body.lang, paymentMethod || "", {
        lookup: async (_phone) => await callDatabaseRpc("vz_prepaid_guard_check", { _phone }) as { refunded: boolean; success: boolean },
        logFailedRow: async (meta, errorMessage) => {
          const id = await createTransactionLog(payloadRecord, callerHost, req.headers.get("user-agent"), { ...arbLogMeta(payloadRecord, bearerToken, body.lang), ...meta });
          if (id) await finishTransactionLog(id, { success: false, error: errorMessage, data: { status: false, message: errorMessage } }, paymentMethod);
        },
        event: (code) => recordGuardEvent({ code, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }),
      });
      if (vzReply) return new Response(JSON.stringify(vzReply), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const tmoReply = await tmoGuardGate(payloadRecord, body.lang, { // TMO-LOOKUP-1020
        lookup: async (_phone) => await callDatabaseRpc("tmo_retry_guard_check", { _phone }) as { blocked: boolean; retry_after: number }, // TMO-LOOKUP-1020
        event: (code) => recordGuardEvent({ code, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }), // TMO-LOOKUP-1020
      }); // TMO-LOOKUP-1020
      if (tmoReply) return new Response(JSON.stringify(tmoReply), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); // TMO-LOOKUP-1020
    }
    if (shouldLogTransaction && (paymentMethod || "").toLowerCase() === "klarna") { // KLARNA-MIN25-1017
      const kmr = klarnaMinRefusal(payloadRecord.total, body.lang); // KLARNA-MIN25-1017
      if (kmr) { recordGuardEvent({ code: "klarna_min_total", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }); return new Response(JSON.stringify(kmr), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); } // KLARNA-MIN25-1017
    } // KLARNA-MIN25-1017
    const isPayPalTx = shouldLogTransaction && (paymentMethod || "").toLowerCase() === "paypal";
    let ppTxOrderId: string | null = null;
    if (isPayPalTx) {
      const ppRefuse = (code: string, message: string) => {
        try { recordGuardEvent({ code: `paypal_tx:${code.toLowerCase()}`, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }); } catch { /* ignore */ }
        return new Response(JSON.stringify({ success: false, blocked: true, code, message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      };
      if (!(await ppAllowed(PP_TX_ENABLED, payloadRecord.phone_number))) return ppRefuse("PAYPAL_UNAVAILABLE", PP_UNAVAILABLE_MSG);
      ppTxOrderId = ppAuthOrderId(payloadRecord.paypal_authorization);
      if (!ppTxOrderId) return ppRefuse("PAYPAL_AUTH_INVALID", "We couldn't read the PayPal approval. Please tap PayPal again. You were not charged.");
      const ppPay = asRecord(payloadRecord.payment);
      if (!text(ppPay.firstName) || !text(ppPay.lastName) || !PP_EMAIL_RE.test(String(ppPay.email ?? "").trim())) {
        return ppRefuse("PAYPAL_DETAILS_MISSING", "Please enter your first name, last name and email, then tap PayPal again. You were not charged.");
      }
      // Yasir (Oct 9): a PayPal authorization is never resubmitted; after any failure the buyer approves a NEW order. Same PayPal order
      // id already on an order row = refused here (800 ms, fail-open; the BL-3 dedupe below also catches a double tap within 10 s).
      try {
        const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const ur = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/transaction_logs?select=id&payment_method=eq.paypal&metadata->>paypal_order_id=eq.${encodeURIComponent(ppTxOrderId)}&limit=1`,
          { headers: { apikey: sk, authorization: `Bearer ${sk}` }, signal: AbortSignal.timeout(800) });
        if (ur.ok) {
          const rows = await ur.json();
          if (Array.isArray(rows) && rows.length > 0) return ppRefuse("PAYPAL_ORDER_USED", "This PayPal approval was already sent, so we did not send it again. Please don't pay again while we check your payment.");
        } else { await ur.body?.cancel(); }
      } catch { /* fail-open */ }
      // No Auto Pay on PayPal (not offered) and never a capture id (Yasir: "do not send a capture id").
      for (const k of ["autopay", "autopay_agreement", "save_cc"]) delete ppPay[k];
      for (const k of ["autopay", "autopay_agreement", "subscriberARB", "paypal_capture_id", "capture_id", "order_id"]) delete payloadRecord[k];
      if (fetchOptions.body !== undefined) fetchOptions.body = JSON.stringify(payloadRecord);
    }
    // [GPAY-AP-SERVER-1008] Google Pay Auto Pay server gate (helpers above blocklistCheck). Runs before every other guard, so a
    // refused request is still stripped and logged. Never refuses the payment: a failed, erroring or slow gate only removes the
    // Auto Pay keys (the body sent to CellPay is rebuilt from the stripped payload), and the order goes on as one-time.
    if (shouldLogTransaction && gpApIsGooglePay(payloadRecord, paymentMethod) && gpApWants(payloadRecord)) {
      const gp = await gpApServerGate(payloadRecord);
      if (!gp.ok) {
        gpApStrip(payloadRecord);
        if (fetchOptions.body !== undefined) fetchOptions.body = JSON.stringify(payload);
        if (!gp.logged) gpApEvent(`gpay_ap:server:refuse:${gp.gate}`, guardOrigin);
        console.warn(`[gpay-ap] Auto Pay keys removed (gate=${gp.gate})`);
      }
    }
    // [blocklist BL-2] Confirmed bad actors (checkout_blocklist). Fail-open. Same calm 200 as a velocity pause.
    if (shouldLogTransaction) {
      try {
        const bl = await blocklistCheck(payloadRecord, null);
        if (bl) {
          recordGuardEvent({ code: `blocklist_hit:${bl.reason}:${bl.key_type}`, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: true });
          return new Response(JSON.stringify({ success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, message: "We couldn't process this card right now. Please try again in about 30 minutes or use a different payment method. You were not charged." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch { /* blocklist fails open */ }
      // [FRAUD-MULTIBLOCK-1012] Multi-factor block (device / exact card / address). Mode read first (60 s cache, 300 ms, error = off).
      // on = await check (1.2 s fail-open), same calm 200 as above; shadow = check + log in the background only; off = skip.
      try {
        mf = buildMf(payloadRecord, cpDev, paymentMethod);
        mfIpP = mfIpEnrich(reqIp);
        const mfMode = await mfBlockMode();
        if (mfMode === "on") {
          const mfHit = await mfBlocklistCheck(mf);
          if (mfHit) {
            recordGuardEvent({ code: `mfblock_on:${mfHit.reason}:${mfHit.key_type}`, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: true });
            return new Response(JSON.stringify({ success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, message: "We couldn't process this card right now. Please try again in about 30 minutes or use a different payment method. You were not charged." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else if (mfMode === "shadow") {
          mfShadowLater(mf, "checkout/transaction", originHost(guardOrigin), true);
        }
      } catch { /* mfblock fails open */ }
      // [FRAUD-MULTIBLOCK-1012 5b] Pre-payment risk score. Shadow: fire-and-forget (zero added latency). Enforce: wait max 700 ms,
      // block = same calm 200; step_up / hold are logged (step_up is passed to the page as risk_action). Any error = allow.
      try {
        const mode = await riskEngineMode(AbortSignal.timeout(300)); // 60 s per-isolate cache
        if (mode !== "off") {
          const pay = asRecord(payloadRecord.payment);
          const m0 = mf ?? buildMf(payloadRecord, cpDev, paymentMethod);
          const rin = {
            phone: text(payloadRecord.phone_number ?? payloadRecord.phoneNumber), email: text(pay.email ?? payloadRecord.email),
            amount: Number(payloadRecord.amount), total: Number(payloadRecord.total), carrier_slug: text(payloadRecord.carrier_slug ?? payloadRecord.carrierSlug), // RISK-RULES-1020
            payment_method: paymentMethod, checkout_session_id: text(payloadRecord.kount_ssid ?? payloadRecord.riskified_sessionid ?? payloadRecord.cbsys_sessionid),
            cp_dev: { dev_fp: m0.device ?? undefined, dev_id: m0.did ?? undefined }, visitorId: m0.visitor,
            card_bin6: m0.bin6, card_last4: m0.last4, card_exp: m0.card_exp, addr_norm: m0.addr,
            ip: riskIp.ip, ip_src: riskIp.src, ip_country_hdr: riskIp.country,
          };
          if (mode === "enforce") {
            const rr = await Promise.race([
              scoreRisk(rin, mode),
              new Promise<{ action: "allow" }>((r) => setTimeout(() => r({ action: "allow" }), 700)),
            ]);
            if (rr.action === "block") {
              recordGuardEvent({ code: "risk_block", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: true });
              return new Response(JSON.stringify({ success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, message: "We couldn't process this card right now. Please try again in about 30 minutes or use a different payment method. You were not charged." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            if (rr.action === "step_up" || rr.action === "hold") {
              recordGuardEvent({ code: `risk_${rr.action}`, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: true });
              if (rr.action === "step_up") riskAction = "step_up";
            }
          } // shadow: the decision was already started before the guards ([RISK-COVER-IP-1019]), so nothing runs here
        }
      } catch { /* risk engine fails open */ }
    }
    // [VEL1-ENFORCE-1009] Card only. Calm 200 before the log and CellPay, nothing is charged. The page shows its "use another method"
    // panel (the message holds "velocity", which its decline classifier files under "blocked": wallets / Cash App / bank, no card retry).
    if (shouldLogTransaction && (paymentMethod || "").toLowerCase() === "cardpayment") {
      try {
        if (await vel1Refuse(payloadRecord, paymentMethod, guardOrigin)) {
          const es = body.lang === "es";
          return new Response(JSON.stringify({
            success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, vel1: true,
            message: es
              ? "Los pagos con tarjeta para este número están en pausa unos minutos como medida de seguridad (velocity). No se le cobró. Use Apple Pay, Google Pay, Cash App o pague con su banco."
              : "Card payments for this phone number are paused for a few minutes as a security (velocity) check. You were not charged. Please use Apple Pay, Google Pay, Cash App or pay by bank instead.",
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch { /* vel1 fails open */ }
    }
    // PLAN-RANGES-1016: RETRY-BLOCK (30 min, same phone + plan + amount after CellPay's refill-error result). Before Fix F. Fail-open.
    if (shouldLogTransaction) {
      const rbLeft = await retryBlockCheck(payloadRecord);
      if (rbLeft !== null) {
        const rbSlug = String(payloadRecord.carrier_slug ?? "").trim().toLowerCase();
        const rbPlan = String(payloadRecord.plan_id ?? payloadRecord.planId ?? "").trim();
        const rbAmt = Number(payloadRecord.amount ?? payloadRecord.refill_amount ?? NaN);
        const rbEs = (body as Record<string, unknown>)?.lang === "es";
        const rbPay = ["metropcs", "boost", "bmobile", "topup-crc"].includes(rbSlug);
        const rbMsg = rbPay
          ? (rbEs ? "No pudimos completar este pago ahora. Intente más tarde o elija otro monto." : "This payment couldn't be completed right now. Please try again later or choose a different amount.")
          : (rbEs ? "No pudimos completar esta recarga ahora. Intente más tarde o elija otro monto." : "This refill couldn't be completed right now. Please try again later or choose a different amount.");
        recordGuardEvent({ code: "retry_block", method: "POST", endpoint_shape: `checkout/transaction#${rbSlug}:${rbPlan}:${rbAmt}`, origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
        return new Response(JSON.stringify({ success: false, blocked: true, code: "RETRY_BLOCK", retry_after: rbLeft, message: rbMsg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // [refill-cooldown Fix F] Same phone + plan got CellPay's refill error in the last 10 min (refill_cooldown). Fail-open.
    // Calm 200 before the log and CellPay. Sits before the BL-3 dedupe claim, so a refused retry never takes a claim.
    let refillKey: string | null = null;
    if (shouldLogTransaction) {
      try {
        refillKey = await refillCooldownKey(payloadRecord);
        const cd = refillKey ? await refillCooldownRpc("refill_cooldown_check", refillKey) : null;
        if (cd && cd.cooldown === true) {
          const ra = Math.round(Number(cd.retry_after));
          const retryAfter = Number.isFinite(ra) && ra >= 1 && ra <= REFILL_COOLDOWN_S ? ra : REFILL_COOLDOWN_S;
          recordGuardEvent({ code: "refill_cooldown_hit", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
          return new Response(JSON.stringify({ success: false, blocked: true, code: "REFILL_COOLDOWN", retry_after: retryAfter, message: REFILL_COOLDOWN_MSG }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch { /* refill cooldown fails open */ }
    }
    if (shouldLogTransaction && retryMetaFrom((body as Record<string, unknown>)?.retry_meta).retry_src === "refund_retry") { // REFUND-RETRY-LATE-1018
      let gate: Record<string, unknown> | null = null; // REFUND-RETRY-LATE-1018
      try { // REFUND-RETRY-LATE-1018
        const gUrl = Deno.env.get("SUPABASE_URL"), gKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // REFUND-RETRY-LATE-1018
        if (gUrl && gKey) { // REFUND-RETRY-LATE-1018
          const gRes = await fetch(`${gUrl}/rest/v1/rpc/refund_retry_gate`, { // REFUND-RETRY-LATE-1018
            method: "POST", // REFUND-RETRY-LATE-1018
            headers: { apikey: gKey, authorization: `Bearer ${gKey}`, "content-type": "application/json" }, // REFUND-RETRY-LATE-1018
            body: JSON.stringify({ p_phone: String(payloadRecord.phone_number ?? payloadRecord.phoneNumber ?? "").replace(/\D/g, ""), p_carrier: String(payloadRecord.carrier_slug ?? ""), p_action: String(retryMetaFrom((body as Record<string, unknown>)?.retry_meta).retry_action ?? "") }), // REFUND-RETRY-LATE-1018
            signal: AbortSignal.timeout(1000), // REFUND-RETRY-LATE-1018
          }); // REFUND-RETRY-LATE-1018
          if (gRes.ok) { const gj = await gRes.json(); gate = asRecord(Array.isArray(gj) ? gj[0] : gj); } else await gRes.body?.cancel(); // REFUND-RETRY-LATE-1018
        } // REFUND-RETRY-LATE-1018
      } catch { gate = null; /* refund retry gate fails open */ } // REFUND-RETRY-LATE-1018
      const gEs = String((body as Record<string, unknown>)?.lang ?? "").startsWith("es"); // REFUND-RETRY-LATE-1018
      if (gate && gate.block === "cap") { // REFUND-RETRY-LATE-1018
        recordGuardEvent({ code: "refund_retry_cap", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }); // REFUND-RETRY-LATE-1018
        const msg = gEs ? "Para protegerle, no se puede volver a intentar con este número hoy. No se le cobró este intento. Inténtelo de nuevo mañana o comuníquese con support@getcellpay.com." : "To protect you, this number can't be tried again today. You were not charged for this attempt. Please try again tomorrow or contact support@getcellpay.com."; // REFUND-RETRY-LATE-1018
        return new Response(JSON.stringify({ success: false, blocked: true, code: "RETRY_CAP", message: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); // REFUND-RETRY-LATE-1018
      } // REFUND-RETRY-LATE-1018
      if (gate && gate.block === "wait") { // REFUND-RETRY-LATE-1018
        recordGuardEvent({ code: "refund_retry_wait", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null }); // REFUND-RETRY-LATE-1018
        const ra = Math.round(Number(gate.retry_after)); // REFUND-RETRY-LATE-1018
        const msg = gEs ? "Espere unos 10 minutos antes de volver a intentar con este número. No se le cobró este intento." : "Please wait about 10 minutes before trying this number again. You were not charged for this attempt."; // REFUND-RETRY-LATE-1018
        return new Response(JSON.stringify({ success: false, blocked: true, code: "RETRY_WAIT", retry_after: Number.isFinite(ra) && ra > 0 ? ra : 600, message: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); // REFUND-RETRY-LATE-1018
      } // REFUND-RETRY-LATE-1018
    } // REFUND-RETRY-LATE-1018
    // [DUPCHARGE-1008] Every payment method through checkout/transaction (card, Apple Pay, Google Pay, Klarna, Cash App, Pay by Bank).
    // session_paid -> SESSION_PAID: nothing is charged; the earlier paid order's hashid goes back so the site shows that order.
    // recent (same phone + amount paid in the last 10 min) -> DUP_CONFIRM unless the site resent it with dup_confirm: true after the
    // customer confirmed "You just paid $X for this number, charge again?". dup_confirm is a site-only flag: removed here, so it never
    // reaches the log row or CellPay. Calm 200 before the log and CellPay; sits before the BL-3 claim. Fails open.
    const memdupConfirmed = payloadRecord.dup_confirm === true; // DB-OUTAGE-TRACK-1017
    if (shouldLogTransaction) {
      const dupConfirmed = payloadRecord.dup_confirm === true;
      if ("dup_confirm" in payloadRecord) {
        delete payloadRecord.dup_confirm;
        if (typeof fetchOptions.body === "string") fetchOptions.body = JSON.stringify(payloadRecord);
      }
      try {
        // [DUPCHARGE-FOLLOWUPS-1008] order: session_paid > in_flight > recent. in_flight -> IN_FLIGHT (calm 200, nothing charged or
        // logged); dup_confirm never bypasses it. Fail-open events via ctx.
        const dc = await dupchargeCheck(payloadRecord, { shape: "checkout/transaction", origin: guardOrigin });
        const dcMode = dc ? String(dc.mode ?? "off") : "off";
        if (dc && dcMode !== "off" && (dc.session_paid === true || dc.in_flight === true || dc.recent === true)) {
          const enforce = dcMode === "on";
          const kind = dc.session_paid === true ? "session_paid" : dc.in_flight === true ? "in_flight" : dupConfirmed ? "confirmed" : "ask";
          recordGuardEvent({ code: `dupcharge_${enforce ? "" : "shadow_"}${kind}`, method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
          const paidNum = Number(dc.paid_total);
          const paid = Number.isFinite(paidNum) && paidNum > 0 ? paidNum.toFixed(2) : (numberText(payloadRecord.total) ?? numberText(payloadRecord.amount) ?? "");
          if (enforce && kind === "session_paid") {
            return new Response(JSON.stringify({ success: false, blocked: true, code: "SESSION_PAID", hashid: text(dc.ref), amount: paid, message: `This order is already paid ($${paid}), so we did not charge you again. Your receipt was sent by email.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (enforce && kind === "in_flight") {
            return new Response(JSON.stringify({ success: false, blocked: true, code: "IN_FLIGHT", message: "Your payment is still processing. Please wait a moment; you were not charged again." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (enforce && kind === "ask") {
            return new Response(JSON.stringify({ success: false, blocked: true, code: "DUP_CONFIRM", amount: paid, message: `You just paid $${paid} for this number, charge again? You were not charged this time.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch { /* dupcharge fails open */ }
    }
    // [dedupe BL-3] Same payment already claimed in the last 10 s (checkout_dedupe). Fail-open. Calm 200, before the log and CellPay.
    if (shouldLogTransaction) {
      try {
        if (await dedupeClaim(payloadRecord, paymentMethod)) {
          recordGuardEvent({ code: "dedupe_hit", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
          return new Response(JSON.stringify({ success: false, blocked: true, code: "DUPLICATE", message: "This payment is already being processed. Please wait a moment before trying again; you will not be charged twice." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch { /* dedupe fails open */ }
    }
    const memKey = shouldLogTransaction && (paymentMethod || "").toLowerCase() !== "pockyt" ? memdupKey(payloadRecord, paymentMethod) : null; // DB-OUTAGE-TRACK-1017
    if (memKey) { // DB-OUTAGE-TRACK-1017: after BL-3, all existing guards unchanged
      const hit = memdupCheck(MEMDUP, memKey, memdupConfirmed);
      if (hit?.code === "SESSION_PAID") {
        recordGuardEvent({ code: "memdup_session_paid", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
        const paid = numberText(payloadRecord.total) ?? numberText(payloadRecord.amount) ?? "";
        return new Response(JSON.stringify({ success: false, blocked: true, code: "SESSION_PAID", hashid: hit.hashid, amount: paid, message: `This order is already paid ($${paid}), so we did not charge you again. Your receipt was sent by email.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (hit?.code === "IN_FLIGHT") {
        recordGuardEvent({ code: "memdup_in_flight", method: "POST", endpoint_shape: "checkout/transaction", origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
        return new Response(JSON.stringify({ success: false, blocked: true, code: "IN_FLIGHT", message: "Your payment is still processing. Please wait a moment; you were not charged again." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (shouldLogTransaction && String(payloadRecord.carrier_slug ?? payloadRecord.carrierSlug ?? "").trim().toLowerCase() === "ultra-mobile") { // ULTRA-SMART-PREVENT-1024
      const health = await ultraHealth(true); // ULTRA-SMART-PREVENT-1024
      if (health?.allowed === false) return new Response(JSON.stringify({ success: false, blocked: true, code: "ULTRA_PAUSED", message: body.lang === "es" ? "Las recargas de Ultra no están disponibles temporalmente. Volverán pronto. Inténtelo de nuevo en unos 20 minutos." : "Ultra refills are temporarily unavailable — back shortly. Please try again in about 20 minutes." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); // ULTRA-SMART-PREVENT-1024
    } // ULTRA-SMART-PREVENT-1024
    const createP: Promise<string | null> = shouldLogTransaction
      ? createTransactionLog(payloadRecord, callerHost, req.headers.get("user-agent"), { ...arbLogMeta(payloadRecord, bearerToken, body.lang), ...visitSourceMeta(body.visit_source), ...retryMetaFrom(body.retry_meta), ...(isPayPalTx ? { paypal_order_id: ppTxOrderId, paypal_step: "transaction" } : {}), ...namesSentMeta(payloadRecord) /* ACCENT-FOLD-1015C */ }, clickIdsFrom(body.click_ids),
          mf ? await mfLogMeta(mf, null) : {}, 20000)
      : Promise.resolve(null); // DB-OUTAGE-TRACK-1017
    waitUntilSafe(createP); // DB-OUTAGE-TRACK-1017
    const txLogId = await raceNull(createP, 3000); // DB-OUTAGE-TRACK-1017
    if (mf && txLogId) mfIpPatchLater(txLogId, mfIpP); // [FRAUD-MULTIBLOCK-1012 FIX] mf_ip added in the background only
    if (shouldLogTransaction && txLogId) consentPatchLater(txLogId, body.retry_meta); // CONSENT-EVERY-ATTEMPT-1016 (not awaited)
    if (shouldLogTransaction) velocityShadow(txLogId, payloadRecord, paymentMethod); // [VEL1-1007] log-only, not awaited
    if (txLogId === null) waitUntilSafe(createP.then((lateId) => { if (lateId) { if (mf) mfIpPatchLater(lateId, mfIpP); consentPatchLater(lateId, body.retry_meta); velocityShadow(lateId, payloadRecord, paymentMethod); } }).catch(() => {})); // DB-OUTAGE-TRACK-1017
    const logIdP = (): Promise<string | null> => txLogId ? Promise.resolve(txLogId) : raceNull(createP, 20000); // DB-OUTAGE-TRACK-1017

    // [plaid v2] Plaid checkout: claim the bound plaid_ref (single use, same order values) and send CellPay's v2 body only.
    if (isPlaidCheckout) {
      const prepared = await plaidV2CheckoutBody(payloadRecord);
      if ("fail" in prepared) {
        memdupUpdate(MEMDUP, memKey, "decline"); // DB-OUTAGE-TRACK-1017: no CellPay request was made
        plaidV2Event(`plv2:checkout:${prepared.why}`, `checkout/transaction#log=${txLogId ?? "none"}`, guardOrigin);
        await finishTransactionLog(txLogId, prepared.fail, paymentMethod);
        if (txLogId) prepared.fail.pending_log_id = txLogId;
        return new Response(JSON.stringify(prepared.fail), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fetchOptions.body = prepared.body;
    }

    // [CASHAPP-STUCK-1007] Cash App create only: 30 s cap on the CellPay call. A throw or timeout marks the log row 'failed' and is
    // rethrown, so the browser gets the same error reply as before (no HostedURL reaches it, so that session cannot be paid).
    // Every other call is sent exactly as before.
    const isPockytCreate = shouldLogTransaction && (paymentMethod || "").toLowerCase() === "pockyt";
    let response: Response;
    let rawText: string;
    try {
      // ACCENT-FOLD-1015: fold name fields to ASCII in the outbound body only; logs keep the original.
      try { if (typeof fetchOptions.body === "string") fetchOptions.body = asciiNamesBody(fetchOptions.body) as string; } catch { /* fail-open: send unchanged */ }
      response = await fetch(url, isPockytCreate ? { ...fetchOptions, signal: AbortSignal.timeout(POCKYT_CREATE_TIMEOUT_MS) } : fetchOptions);
      rawText = await response.text();
    } catch (error) {
      if (isKlarnaSession) logKlarnaSession("exception", 0, asRecord(payload).amount ?? asRecord(payload).total, guardOrigin, body); // KLARNA-LOG-1017
      memdupUpdate(MEMDUP, memKey, "unknown"); // DB-OUTAGE-TRACK-1017
      if (isPockytCreate) await markPockytCreateError(txLogId ?? await raceNull(createP, 1000), error); // DB-OUTAGE-TRACK-1017
      if (isPockytCreate && txLogId === null) waitUntilSafe(logIdP().then((id) => markPockytCreateError(id, error))); // DB-OUTAGE-TRACK-1017
      throw error;
    }

    let data: unknown;
    let rawReplyParseFailed = false;
    const contentType = response.headers.get("content-type") || "";

    try {
      data = JSON.parse(rawText);
    } catch {
      rawReplyParseFailed = true;
      data = { raw: rawText, parseError: true };
    }

    if (isKlarnaSession) { try { logKlarnaSession(klarnaSessionOutcome(response.ok, data), response.status, asRecord(payload).amount ?? asRecord(payload).total, guardOrigin, body, klarnaCategories(data)); } catch { /* ignore */ } } // KLARNA-LOG-1017
    if (isPayPalTx) ppScrub(data); // SUCCESS-FLAG-FIX-1016
    if (isPlaidCheckout) scrubPlaidSecrets(data); // SUCCESS-FLAG-FIX-1016

    // Always return 200 so supabase.functions.invoke doesn't throw
    // LOADTEXT-REASON-1017: read from the parsed upstream body (the PayPal/Plaid scrubs above never touch LoadText keys).
    const loadText = shouldLogTransaction && !isPockytCreate ? extractLoadText(data) : null;
    let wrapped: Record<string, unknown> = response.ok
      ? { success: true, data }
      : { success: false, error: (data as Record<string, unknown>)?.message || (data as Record<string, unknown>)?.error || "Request failed", data };

    // SUCCESS-FLAG-FIX-1016: raw logger receives the original upstream body before any rewriting/scrubbing.
    if (shouldLogTransaction) { if (txLogId) logRawCellPayReply(txLogId, endpoint, response.status, paymentMethod, data, rawText, rawReplyParseFailed); else { let rawCopy: unknown = data; try { rawCopy = structuredClone(data); } catch { /* keep reference */ } const st = response.status; waitUntilSafe(logIdP().then((lateId) => logRawCellPayReply(lateId, endpoint, st, paymentMethod, rawCopy, rawText, rawReplyParseFailed)).catch(() => logRawCellPayReply(null, endpoint, st, paymentMethod, rawCopy, rawText, rawReplyParseFailed))); } } // DBT-FOLLOWUP-1017
    const refundMarker = shouldLogTransaction && !isPockytCreate ? refundSuccessMarker(wrapped) : null;
    const unconfirmedKind = shouldLogTransaction && !isPockytCreate && !refundMarker ? chargeUnconfirmedKind(response.status, data, wrapped) : null; // REFUNDED-STATE-1017
    const refundAudit = refundMarker ? { ...asRecord(data), refund_signal: true, refund_marker: refundMarker } : null;
    if (refundMarker) wrapped = { success: true, data: { status: false, message: REFUND_FAILURE_MESSAGE, refund_signal: true } };

    logCarrierCheck(endpoint, response.status, wrapped, payload, callerHost); // [CARRIER-CHECK-LOG-1011] not awaited
    // [refill-cooldown Fix F] Start the 10-min cooldown ONLY on CellPay's refill-error result. Fail-open (1 s), response unchanged.
    // [plaid v2] CellPay's error code / errors reach the browser (422 code "plaid_ref" -> the site links again), no Plaid token
    // reaches the log or the browser, and one PII-free outcome row per Plaid checkout goes to proxy_guard_events.
    if (isPlaidCheckout) {
      const upstream = asRecord(data);
      if ((!response.ok || upstream.success === false) && typeof upstream.code === "string") wrapped.code = upstream.code.slice(0, 64);
      if ((!response.ok || upstream.success === false) && upstream.errors && typeof upstream.errors === "object") wrapped.errors = upstream.errors;
      scrubPlaidSecrets(wrapped);
      const r = unwrapTransactionResult(wrapped);
      // CellPay's v2 success may be { success: true, data: { transactionId, ... } } with no status: mark it success so the log row
      // and the site read it like a card success. Never when CellPay says success false or gives a status of its own.
      if (wrapped.success === true && upstream.success === true && r.status === undefined && text(r.transactionId ?? r.transaction_id)) r.status = "success";
      const paid = wrapped.success === true && (r.status === true || r.status === "true" || ["success", "completed"].includes(String(r.status || "").toLowerCase()));
      plaidV2Event(paid ? "plv2:checkout:ok" : `plv2:checkout:fail:http${response.status}:${plaidV2Word(wrapped.code)}`,
        `checkout/transaction#log=${txLogId ?? "none"}`, guardOrigin);
    }

    if (isPayPalTx) ppScrub(wrapped); // [PAYPAL-REBUILD-1009] never log or return PayPal approval secrets
    if (shouldLogTransaction) {
      const logWrapped = structuredClone(wrapped); // DB-OUTAGE-TRACK-1017: snapshot before browser-only reply fields
      const memResult = unwrapTransactionResult(logWrapped); // DB-OUTAGE-TRACK-1017
      const memStatus = String(memResult.status || "").toLowerCase(); // DB-OUTAGE-TRACK-1017
      const memSuccess = !refundMarker && logWrapped.success === true && (memResult.status === true || memStatus === "true" || memStatus === "success" || memStatus === "completed"); // DB-OUTAGE-TRACK-1017
      memdupUpdate(MEMDUP, memKey, unconfirmedKind ? "unknown" : memSuccess ? "success" : "decline", text(memResult.hashid ?? memResult.id) ?? undefined); // DB-OUTAGE-TRACK-1017
      const postWork = async () => { // DB-OUTAGE-TRACK-1017
        if (shouldLogTransaction && refillKey && isRefillErrorResult(wrapped)) {
          try { await refillCooldownRpc("refill_cooldown_mark", refillKey); } catch { /* refill cooldown fails open */ }
        }
        const id = await logIdP();
        // SUCCESS-FLAG-FIX-1016: finalize only this new failed order, retaining the full original reply for audit.
        if (refundAudit && id) {
          try { await callDatabaseRpc("finalize_transaction_log", { _id: id, _status: "failed", _hashid: null, _transaction_id: null, _error_message: REFUND_FAILURE_MESSAGE, _raw_response: refundAudit }, 10000); }
          catch (error) { console.error("[tx-log] refund finalize failed:", error instanceof Error ? error.message : error); }
        } else await finishTransactionLog(id, logWrapped, paymentMethod, 10000);
        await logDataErr(id, payloadRecord, logWrapped, paymentMethod); // [OURSIDE-RETRY-1012] masked, failed data-error rows only
        if (!isPlaidCheckout && /^(card|applepay|googlepay|klarna)/i.test(String(paymentMethod || ""))) await logCardFacts(id, payloadRecord, logWrapped, paymentMethod); // [CARDLOG-1007 v3] never throws
        // REFUNDED-STATE-1017: keep each RPC's own existing fail-open cap.
        if (id && !isPockytCreate) {
          if (unconfirmedKind) await rpcSoon("tx_log_meta_merge", { _id: id, _patch: { charge_unconfirmed: true, crash_kind: unconfirmedKind } });
          if (refundAudit || (!unconfirmedKind && autoRefundFailure(logWrapped))) {
            await rpcSoon("mark_order_refunded", { _id: id, _source: "reply", _reason: loadText ?? refundMarker ?? "reply_auto_refund" });
          }
          if (loadText) await rpcSoon("set_tx_load_text", { _id: id, _text: loadText }); // LOADTEXT-REASON-1017
          try { if (refundAudit || autoRefundFailure(logWrapped) || (!memSuccess && !unconfirmedKind)) { const rp = buildRawReplyPatch(data); if (rp) await rpcSoon("tx_log_meta_merge", { _id: id, _patch: rp }); } } catch { /* RAW-REPLY-LOG-1022: logging never affects the order */ } // RAW-REPLY-LOG-1022
          if (loadText) { // LOADTEXT-PICK-1019: the category the site shows, for analytics; unknown parts kept so rules can be added
            const lt = categorizeLoadText(loadText);
            if (lt) {
              await rpcSoon("tx_log_meta_merge", { _id: id, _patch: { load_text_category: lt.category, load_text_unknown: lt.unknown, ...(lt.unknown ? { load_text_unknown_parts: lt.unknownParts } : {}), load_text_cc_refund: isCcRefundBody(data) } });
              recordGuardEvent({ code: `lt:${lt.category}${lt.unknown ? ":unknown" : ""}`, method: "POST", endpoint_shape: `checkout/transaction#log=${id}`, origin_host: originHost(guardOrigin), has_origin: guardOrigin !== null });
            }
          } // LOADTEXT-PICK-1019
        }
      };
      const post = postWork(); waitUntilSafe(post); // DB-OUTAGE-TRACK-1017
      await raceNull(post, 1500); // DB-OUTAGE-TRACK-1017
      if (txLogId) wrapped.pending_log_id = txLogId;
      if (riskAction === "step_up") wrapped.risk_action = "step_up"; // [FRAUD-MULTIBLOCK-1012 5c] enforce mode only
      // REFUNDED-STATE-1017: crash/timeout = outcome unknown; never SQLSTATE text or HTML to the browser.
      if (unconfirmedKind && !isPockytCreate) {
        const keep: Record<string, unknown> = {};
        if (wrapped.pending_log_id) keep.pending_log_id = wrapped.pending_log_id;
        if (wrapped.risk_action) keep.risk_action = wrapped.risk_action;
        const dbFormat = unconfirmedKind === "sqlstate" && isDbFormatError(data, wrapped); // NAME-SANITIZE-1018B
        wrapped = { success: false, code: "CHARGE_UNCONFIRMED", error: "charge_unconfirmed", data: { status: false, message: "charge_unconfirmed", charge_unconfirmed: true, ...(dbFormat ? { unconfirmed_kind: "db_format" } : unconfirmedKind === "backend_exc" ? { unconfirmed_kind: "backend_exception" } : {}) }, ...keep }; // NAME-SANITIZE-1018B // BACKEND-EXC-1019
      }
      if (loadText && !isPockytCreate) wrapped.load_text = loadText; // LOADTEXT-REASON-1017 (display hint only; never decides success)
    }

    // Pockyt Cash App session status polling — finalize the pending log when
    // the hosted flow reports a terminal state.
    const pockytStatusMatch = endpoint.match(/^payments\/pockyt\/session\/[^/]+\/status$/);
    if (pockytStatusMatch && method === "GET") {
      const logId = text(payloadRecord.pending_log_id);
      if (logId) {
        const result = unwrapTransactionResult(wrapped);
        const internal = String(result.internal_status || result.status || "").toLowerCase();
        const txnId = text(result.transaction_id ?? result.transactionId);
        const successStatuses = ["success", "completed", "paid", "captured", "approved"];
        const failureStatuses = ["failed", "declined", "cancelled", "canceled", "expired", "voided", "error"];
        let finalStatus: "success" | "failed" | null = null;
        if (txnId && successStatuses.includes(internal)) finalStatus = "success";
        else if (failureStatuses.includes(internal)) finalStatus = "failed";
        if (finalStatus) {
          const settle = (async () => { // DB-OUTAGE-TRACK-1017
          try {
            await callDatabaseRpc("finalize_transaction_log", {
              _id: logId,
              _status: finalStatus,
              _hashid: txnId,
              _transaction_id: txnId,
              _error_message: finalStatus === "failed" ? text(result.message ?? result.msg) : null,
              _raw_response: result,
            }, 10000); // DB-OUTAGE-TRACK-1017
          } catch (error) {
            console.error("[tx-log] pockyt finalize failed:", error instanceof Error ? error.message : error);
          }
          // [CASHAPP-STUCK-1007] failed/abandoned are not final: a paid answer flips THIS row to success only when its saved session id
          // and our log id both match (and the txn is not on another row). No-op when the row was pending (settled just above).
          if (finalStatus === "success") {
            try {
              await callDatabaseRpc("finalize_pockyt_log", {
                _session_id: endpoint.split("/")[3] || "", _pending_log_id: logId, _status: "success", _txn: txnId, _msg: null, _raw: result,
              }, 10000); // DB-OUTAGE-TRACK-1017
            } catch (error) {
              console.error("[tx-log] pockyt late-paid flip failed:", error instanceof Error ? error.message : error);
            }
          }
          })();
          waitUntilSafe(settle); await raceNull(settle, 1500); // DB-OUTAGE-TRACK-1017
        }
      }
    }

    return new Response(JSON.stringify(wrapped), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("cellpay-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
