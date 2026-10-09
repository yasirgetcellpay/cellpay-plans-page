import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function callDatabaseRpc(name: string, payload: Record<string, unknown>): Promise<unknown> {
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

async function createTransactionLog(
  payload: Record<string, unknown>,
  callerHost: string | undefined,
  userAgent: string | null,
  arb: Record<string, unknown> = {},
  clicks: Record<string, string> = {},
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
        },
      },
    });
    return typeof id === "string" ? id : null;
  } catch (error) {
    console.error("[tx-log] create failed:", error instanceof Error ? error.message : error);
    return null;
  }
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
      });
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
    });
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
      ap1Rpc("ap1_rate_limit_hit", { _bucket: await ap1Hash("ip", ip ?? "none"), _limit: AP1_LIMITS.ip.max, _window_seconds: AP1_LIMITS.ip.windowS }, 1000),
      ap1Rpc("ap1_rate_limit_hit", { _bucket: await ap1Hash("ph", phone), _limit: AP1_LIMITS.phone.max, _window_seconds: AP1_LIMITS.phone.windowS }, 1000),
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
    : tok(p.google_pay_token) || tok(p.apple_pay_token) || tok(p.plaid_token) || tok(p.klarna_auth_token) || tok(p.payment_token);
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
const PP_CREATE_ENABLED = false; // [PAYPAL-HIDE-1154] false = refuse new PayPal create-order (capture still allowed)
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
  if (isCreate && !PP_CREATE_ENABLED) {
    try { recordGuardEvent({ code: "paypal_disabled", method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null }); } catch { /* ignore */ }
    return reply({ success: false, blocked: true, code: "PAYPAL_UNAVAILABLE", message: "PayPal is not available right now. Please use another payment method. You were not charged." });
  }
  const payload = asRecord(body.payload);
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
    // [BL-2] blocklist (1.2 s, fail-open)
    try {
      const bl = await blocklistCheck(lr, null);
      if (bl) {
        recordGuardEvent({ code: `blocklist_hit:${bl.reason}:${bl.key_type}`, method: "POST", endpoint_shape: PP_CREATE, origin_host: originHost(origin), has_origin: origin !== null });
        return reply({ success: false, blocked: true, code: "RETRY_LATER", retry_after: 1800, message: PP_BLOCK_MSG });
      }
    } catch { /* blocklist fails open */ }
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
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(fwd) });
  const rawText = await response.text();
  let data: unknown;
  try { data = JSON.parse(rawText); } catch { data = { raw: rawText, parseError: true }; }
  const wrapped: Record<string, unknown> = response.ok
    ? { success: true, data }
    : { success: false, error: (data as Record<string, unknown>)?.message || (data as Record<string, unknown>)?.error || "Request failed", data };
  const r = unwrapTransactionResult(wrapped);
  const arb = (): Record<string, unknown> => arbLogMeta(lr, body.bearerToken, body.lang);

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
      _raw_response: r,
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

    const shouldLogTransaction = endpoint === "checkout/transaction" && method === "POST";
    const payloadRecord = asRecord(payload);
    const paymentMethod = text(payloadRecord.payment_method ?? payloadRecord.paymentMethod);
    // [plaid v2] A Plaid checkout carries no Plaid token or Link metadata past this point (guards, log row, CellPay).
    const isPlaidCheckout = shouldLogTransaction && (paymentMethod || "").toLowerCase() === "plaid";
    if (isPlaidCheckout) for (const k of PLAID_V2_DROP) delete payloadRecord[k];
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
    // [DUPCHARGE-1008] Every payment method through checkout/transaction (card, Apple Pay, Google Pay, Klarna, Cash App, Pay by Bank).
    // session_paid -> SESSION_PAID: nothing is charged; the earlier paid order's hashid goes back so the site shows that order.
    // recent (same phone + amount paid in the last 10 min) -> DUP_CONFIRM unless the site resent it with dup_confirm: true after the
    // customer confirmed "You just paid $X for this number, charge again?". dup_confirm is a site-only flag: removed here, so it never
    // reaches the log row or CellPay. Calm 200 before the log and CellPay; sits before the BL-3 claim. Fails open.
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
    const txLogId = shouldLogTransaction
      ? await createTransactionLog(payloadRecord, callerHost, req.headers.get("user-agent"), arbLogMeta(payloadRecord, bearerToken, body.lang), clickIdsFrom(body.click_ids))
      : null;
    if (shouldLogTransaction) velocityShadow(txLogId, payloadRecord, paymentMethod); // [VEL1-1007] log-only, not awaited

    // [plaid v2] Plaid checkout: claim the bound plaid_ref (single use, same order values) and send CellPay's v2 body only.
    if (isPlaidCheckout) {
      const prepared = await plaidV2CheckoutBody(payloadRecord);
      if ("fail" in prepared) {
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
      response = await fetch(url, isPockytCreate ? { ...fetchOptions, signal: AbortSignal.timeout(POCKYT_CREATE_TIMEOUT_MS) } : fetchOptions);
      rawText = await response.text();
    } catch (error) {
      if (isPockytCreate) await markPockytCreateError(txLogId, error);
      throw error;
    }

    let data: unknown;
    const contentType = response.headers.get("content-type") || "";

    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText, parseError: true };
    }

    // Always return 200 so supabase.functions.invoke doesn't throw
    const wrapped: Record<string, unknown> = response.ok
      ? { success: true, data }
      : { success: false, error: (data as Record<string, unknown>)?.message || (data as Record<string, unknown>)?.error || "Request failed", data };

    // [refill-cooldown Fix F] Start the 10-min cooldown ONLY on CellPay's refill-error result. Fail-open (1 s), response unchanged.
    if (shouldLogTransaction && refillKey && isRefillErrorResult(wrapped)) {
      try { await refillCooldownRpc("refill_cooldown_mark", refillKey); } catch { /* refill cooldown fails open */ }
    }
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

    if (shouldLogTransaction) {
      await finishTransactionLog(txLogId, wrapped, paymentMethod);
      if (!isPlaidCheckout && /^(card|applepay|googlepay|klarna)/i.test(String(paymentMethod || ""))) await logCardFacts(txLogId, payloadRecord, wrapped, paymentMethod); // [CARDLOG-1007 v3] never throws
      if (txLogId) wrapped.pending_log_id = txLogId;
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
          try {
            await callDatabaseRpc("finalize_transaction_log", {
              _id: logId,
              _status: finalStatus,
              _hashid: txnId,
              _transaction_id: txnId,
              _error_message: finalStatus === "failed" ? text(result.message ?? result.msg) : null,
              _raw_response: result,
            });
          } catch (error) {
            console.error("[tx-log] pockyt finalize failed:", error instanceof Error ? error.message : error);
          }
          // [CASHAPP-STUCK-1007] failed/abandoned are not final: a paid answer flips THIS row to success only when its saved session id
          // and our log id both match (and the txn is not on another row). No-op when the row was pending (settled just above).
          if (finalStatus === "success") {
            try {
              await callDatabaseRpc("finalize_pockyt_log", {
                _session_id: endpoint.split("/")[3] || "", _pending_log_id: logId, _status: "success", _txn: txnId, _msg: null, _raw: result,
              });
            } catch (error) {
              console.error("[tx-log] pockyt late-paid flip failed:", error instanceof Error ? error.message : error);
            }
          }
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
