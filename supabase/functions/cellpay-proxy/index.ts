const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const API_BASE = "https://yasircell.cellpay.us/api";

const jsonRes = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
      case "checkout-client-config":
        upstreamUrl = `${API_BASE}/payments/checkout-client-config`;
        break;
      case "plaid-link-token":
        upstreamUrl = `${API_BASE}/payments/plaid/link-token`;
        break;
      case "plaid-exchange-token":
        upstreamUrl = `${API_BASE}/payments/plaid/exchange-token`;
        break;
      case "paypal-create-order":
        upstreamUrl = `${API_BASE}/payments/paypal/create-order`;
        break;
      case "paypal-capture-order":
        upstreamUrl = `${API_BASE}/payments/paypal/capture-order`;
        break;
      case "apple-pay-session":
        upstreamUrl = `${API_BASE}/payments/apple-pay/session`;
        break;
      case "klarna-session":
        upstreamUrl = `${API_BASE}/payments/klarna/session`;
        break;
      case "user-login":
        upstreamUrl = `${API_BASE}/users/login`;
        break;
      case "user-register":
        upstreamUrl = `${API_BASE}/users/register`;
        break;
      default:
        return jsonRes({ success: false, error: "Invalid action" }, 400);
    }

    const body = req.method !== "GET" ? await req.text() : undefined;
    console.log(`[cellpay-proxy] ${req.method} ${upstreamUrl}`);

    // Use browser-like headers to avoid Cloudflare bot detection
    const upstreamHeaders: HeadersInit = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
      "Referer": "https://yasircell.cellpay.us/",
      "Origin": "https://yasircell.cellpay.us",
      ...(body ? { "Content-Type": "application/json" } : {}),
    };

    // Forward bearer token if present
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      (upstreamHeaders as Record<string, string>)["Authorization"] = authHeader;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders,
      ...(body ? { body } : {}),
      redirect: "follow",
    });

    const responseText = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "";
    console.log(`[cellpay-proxy] upstream status=${upstreamResponse.status} len=${responseText.length} ct=${contentType}`);

    // Try to parse as JSON even if content-type is text/html (some endpoints return JSON with wrong content-type)
    let isJson = contentType.includes("application/json");
    let parsedJson: unknown = null;
    if (!isJson && responseText.trimStart().startsWith("{")) {
      try {
        parsedJson = JSON.parse(responseText);
        isJson = true;
      } catch { /* not JSON */ }
    }

    if (!upstreamResponse.ok || !isJson) {
      console.error(`[cellpay-proxy] Upstream error: status=${upstreamResponse.status}, body=${responseText.slice(0, 500)}`);
      return jsonRes({
        success: false,
        data: null,
        error: `Upstream request failed (status ${upstreamResponse.status})`,
        diagnostics: {
          upstream_status: upstreamResponse.status,
          content_type: contentType,
          body_preview: responseText.slice(0, 300),
          is_cloudflare: /cloudflare|attention required/i.test(responseText),
        },
      });
    }

    // If we already parsed it (text/html with JSON body), wrap it; otherwise return raw
    const jsonBody = parsedJson ? JSON.stringify(parsedJson) : responseText;
    return new Response(jsonBody, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("[cellpay-proxy] Exception:", err);
    return jsonRes({
      success: false,
      error: err instanceof Error ? err.message : "Proxy error",
    });
  }
});
