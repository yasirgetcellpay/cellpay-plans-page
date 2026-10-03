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
