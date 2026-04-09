const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const API_BASE = "https://yasircell.cellpay.us/api";
const API_DOMAIN = new URL(API_BASE).hostname;

interface ProxyDiagnostics {
  domain: string;
  requested_url?: string;
  final_url?: string;
  error_stage: string;
  html_length?: number;
  processing_time_ms: number;
  upstream_status?: number;
}

const jsonRes = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const proxyError = (
  error: string,
  diagnostics: ProxyDiagnostics,
  status?: number,
) =>
  jsonRes(
    {
      success: false,
      data: null,
      error,
      ...(typeof status === "number" ? { status } : {}),
      diagnostics,
    },
    200,
  );

const isCloudflareChallenge = (status: number, responseText: string) =>
  status === 403 || /attention required|cloudflare|bot fight mode|browser integrity check/i.test(responseText);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const CELLPAY_API_KEY = Deno.env.get("CELLPAY_API_KEY") ?? "local-test-api-key";
  const CELLPAY_API_SECRET = Deno.env.get("CELLPAY_API_SECRET") ?? "local-test-api-secret";

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    let upstreamUrl = "";

    switch (action) {
      case "list-carriers":
        upstreamUrl = `${API_BASE}/carriers`;
        break;
      case "view-carrier": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug))
          return jsonRes({ success: false, error: "Invalid slug" }, 400);
        const refill = url.searchParams.get("refill");
        upstreamUrl = `${API_BASE}/carriers/view/${slug}${refill ? `?refill=${refill}` : ""}`;
        break;
      }
      case "verify-phone": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug))
          return jsonRes({ success: false, error: "Invalid slug" }, 400);
        upstreamUrl = `${API_BASE}/carriers/verify-phone/${slug}`;
        break;
      }
      case "checkout":
        upstreamUrl = `${API_BASE}/checkout/transaction`;
        break;
      default:
        return jsonRes({ success: false, error: "Invalid action" }, 400);
    }

    const body = req.method !== "GET" ? await req.text() : undefined;
    console.log("Fetching:", req.method, upstreamUrl);

    const upstreamHeaders: HeadersInit = {
      "Accept": "*/*",
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
      ...(body ? { "Content-Type": "application/json" } : {}),
    };

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders,
      ...(body ? { body } : {}),
    });

    const responseText = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "";
    console.log(`Upstream: status=${upstreamResponse.status}, len=${responseText.length}`);

    if (!upstreamResponse.ok || !contentType.includes("application/json")) {
      const blockedByCloudflare = isCloudflareChallenge(upstreamResponse.status, responseText);
      const error = blockedByCloudflare
        ? "Upstream blocked by Cloudflare"
        : `Upstream request failed with status ${upstreamResponse.status}`;

      if (blockedByCloudflare) {
        console.warn("Cloudflare blocked the request");
      }

      return proxyError(
        error,
        {
          domain: API_DOMAIN,
          requested_url: upstreamUrl,
          final_url: upstreamResponse.url,
          error_stage: blockedByCloudflare ? "upstream_blocked" : "upstream_error",
          html_length: responseText.length,
          processing_time_ms: Date.now() - startedAt,
          upstream_status: upstreamResponse.status,
        },
        upstreamResponse.status,
      );
    }

    return new Response(responseText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Proxy error:", err instanceof Error ? err.message : err);
    return proxyError(
      err instanceof Error ? err.message : "Proxy error",
      {
        domain: API_DOMAIN,
        error_stage: "proxy_exception",
        processing_time_ms: Date.now() - startedAt,
      },
    );
  }
});
