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
  // Strip leading "www." for the registrable-domain calculation but keep it on output if original had it
  const parts = cleaned.split(".").filter(Boolean);
  if (parts.length < 2) return FALLBACK_DOMAIN;
  // Handle simple two-label TLDs (com, us, net, org, io, etc.) — registrable = last 2 labels.
  // Handle a few common ccTLD second-levels (co.uk, com.au, etc.) — registrable = last 3 labels.
  const twoLevelSuffixes = new Set([
    "co.uk", "co.in", "co.nz", "co.jp", "co.kr", "co.za",
    "com.au", "com.br", "com.mx", "com.tr", "com.sg",
    "org.uk", "net.au",
  ]);
  const lastTwo = parts.slice(-2).join(".");
  const lastThree = parts.slice(-3).join(".");
  const registrable = twoLevelSuffixes.has(lastTwo) && parts.length >= 3 ? lastThree : lastTwo;
  return registrable;
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
