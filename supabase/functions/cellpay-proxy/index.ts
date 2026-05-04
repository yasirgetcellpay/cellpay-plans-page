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

async function finishTransactionLog(id: string | null, wrapped: Record<string, unknown>) {
  if (!id) return;
  const result = unwrapTransactionResult(wrapped);
  const status = result.status;
  const isSuccess = wrapped.success === true && (
    status === true || status === "true" ||
    String(status || "").toLowerCase() === "success" ||
    String(status || "").toLowerCase() === "completed"
  );

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
    const txLogId = shouldLogTransaction
      ? await createTransactionLog(asRecord(payload), callerHost, req.headers.get("user-agent"))
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
    const wrapped = response.ok
      ? { success: true, data }
      : { success: false, error: (data as Record<string, unknown>)?.message || (data as Record<string, unknown>)?.error || "Request failed", data };

    if (shouldLogTransaction) {
      await finishTransactionLog(txLogId, wrapped);
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
