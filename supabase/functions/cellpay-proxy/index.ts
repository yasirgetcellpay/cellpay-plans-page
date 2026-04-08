import { FALLBACK_CARRIERS, getFallbackCarrierDetail } from "./fallback-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CELLPAY_BASE = "https://yasircell.cellpay.us/api";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
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

    const baseHeaders: Record<string, string> = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://yasircell.cellpay.us/",
      "Origin": "https://yasircell.cellpay.us",
    };

    let endpoint: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "list-carriers": {
        endpoint = `${CELLPAY_BASE}/carriers`;
        break;
      }
      case "view-carrier": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
          return jsonResponse({ error: "Invalid slug" }, 400);
        }
        const refill = url.searchParams.get("refill");
        endpoint = `${CELLPAY_BASE}/carriers/view/${slug}${refill ? `?refill=${refill}` : ""}`;
        break;
      }
      case "verify-phone": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
          return jsonResponse({ error: "Invalid slug" }, 400);
        }
        method = "POST";
        body = await req.text();
        endpoint = `${CELLPAY_BASE}/carriers/verify-phone/${slug}`;
        break;
      }
      case "checkout": {
        method = "POST";
        body = await req.text();
        endpoint = `${CELLPAY_BASE}/checkout/transaction`;
        break;
      }
      default: {
        return jsonResponse({ error: "Unknown action" }, 400);
      }
    }

    console.log("Fetching:", method, endpoint);

    const response = await fetch(endpoint, {
      method,
      headers: body
        ? { ...baseHeaders, "Content-Type": "application/json" }
        : baseHeaders,
      ...(body ? { body } : {}),
    });

    const contentType = response.headers.get("content-type") || "";

    // If Cloudflare blocks us (403) or non-JSON, use fallback data
    if (!contentType.includes("application/json") || response.status === 403) {
      console.warn(`CellPay blocked (${response.status}), using fallback for action: ${action}`);
      return serveFallback(action, url);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.warn("JSON parse failed, using fallback");
      return serveFallback(action, url);
    }

    if (!response.ok) {
      console.warn(`Upstream error ${response.status}, using fallback`);
      return serveFallback(action, url);
    }

    return jsonResponse(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Proxy error:", message, "- using fallback");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    return serveFallback(action, url);
  }
});

function serveFallback(action: string | null, url: URL) {
  switch (action) {
    case "list-carriers":
      return jsonResponse({ success: true, data: FALLBACK_CARRIERS });
    case "view-carrier": {
      const slug = url.searchParams.get("slug") ?? "";
      return jsonResponse(getFallbackCarrierDetail(slug));
    }
    default:
      return jsonResponse({ success: false, error: "Action not available in fallback mode" }, 400);
  }
}
