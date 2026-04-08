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

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    const baseHeaders: Record<string, string> = {
      "Accept": "*/*",
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
    };

    let endpoint: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "list-carriers":
        endpoint = `${CELLPAY_BASE}/carriers`;
        break;
      case "view-carrier": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) return jsonResponse({ error: "Invalid slug" }, 400);
        const refill = url.searchParams.get("refill");
        endpoint = `${CELLPAY_BASE}/carriers/view/${slug}${refill ? `?refill=${refill}` : ""}`;
        break;
      }
      case "verify-phone": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) return jsonResponse({ error: "Invalid slug" }, 400);
        method = "POST";
        body = await req.text();
        endpoint = `${CELLPAY_BASE}/carriers/verify-phone/${slug}`;
        break;
      }
      case "checkout":
        method = "POST";
        body = await req.text();
        endpoint = `${CELLPAY_BASE}/checkout/transaction`;
        break;
      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }

    console.log("Fetching:", method, endpoint);

    const response = await fetch(endpoint, {
      method,
      headers: body ? { ...baseHeaders, "Content-Type": "application/json" } : baseHeaders,
      ...(body ? { body } : {}),
    });

    const responseText = await response.text();
    console.log(`Response: status=${response.status}, content-type=${response.headers.get("content-type")}`);

    if (!response.ok) {
      return jsonResponse({ success: false, error: `Upstream error ${response.status}`, details: responseText.substring(0, 500) }, response.status);
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON from upstream" }, 502);
    }

    return jsonResponse(data);
  } catch (error: unknown) {
    console.error("Proxy error:", error instanceof Error ? error.message : error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Proxy error" }, 500);
  }
});
