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

async function createTransactionLog(
  payload: Record<string, unknown>,
  callerHost: string | undefined,
  userAgent: string | null,
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
        metadata: {
          caller_host: text(callerHost),
          checkout_session_id: text(payload.kount_ssid ?? payload.riskified_sessionid ?? payload.cbsys_sessionid),
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
  const hostedUrl = (result.HostedURL || result.hostedUrl || result.hosted_url) as string | undefined;
  if ((paymentMethod || "").toLowerCase() === "pockyt" && hostedUrl && !isSuccess) {
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
    msg: "If that number has Auto Pay with us, it's now cancelled. We'll confirm by email within 1 business day.",
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
  let fail: { kind: string; status: number | null } | null = null;
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
      if (!ok) fail = { kind: "error_body", status: res.status };
    }
  } catch (e) {
    fail = { kind: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", status: null };
  }
  if (!fail) {
    ap1Event("ap1:sent_ok", origin);
  } else {
    ap1Event(`ap1:sent_fail:${fail.kind}`, origin);
    // Queue it (reference + kind + status only). 400 ms budget keeps the reply inside AP1_MIN_MS.
    try {
      const rid = await ap1Rpc("ap1_retry_record", { _log_id: owner, _kind: fail.kind, _status: fail.status, _domain: cellpayDomain }, 400);
      if (rid === null || rid === undefined) throw new Error("no row");
      ap1Event("ap1:retry_queued", origin);
    } catch {
      ap1Event("ap1:retry_write_error", origin);
      // Last resort so it still isn't lost: the edge log gets the transaction_logs id (a uuid, no PII).
      console.error(`[autopay AP-1] retry row NOT written: transaction_log_id=${owner} kind=${fail.kind} status=${fail.status ?? "none"}`);
    }
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
const REFILL_COOLDOWN_MSG = "This plan couldn't be refilled just now. Your earlier attempt was refunded automatically. Please try again in about 10 minutes or choose a different plan.";

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

    const shouldLogTransaction = endpoint === "checkout/transaction" && method === "POST";
    const payloadRecord = asRecord(payload);
    const paymentMethod = text(payloadRecord.payment_method ?? payloadRecord.paymentMethod);
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
      ? await createTransactionLog(payloadRecord, callerHost, req.headers.get("user-agent"))
      : null;

    const response = await fetch(url, fetchOptions);

    let data: unknown;
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

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
    if (shouldLogTransaction) {
      await finishTransactionLog(txLogId, wrapped, paymentMethod);
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
