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
      default:
        return jsonRes({ success: false, error: "Invalid action" }, 400);
    }

    const body = req.method !== "GET" ? await req.text() : undefined;
    console.log("Fetching:", req.method, upstreamUrl);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "Accept": "application/json",
        "X-Api-Key": CELLPAY_API_KEY,
        "X-Api-Secret": CELLPAY_API_SECRET,
      },
      ...(body ? { body, headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Api-Key": CELLPAY_API_KEY, "X-Api-Secret": CELLPAY_API_SECRET } } : {}),
    });

    const responseText = await upstreamResponse.text();
    console.log(`Upstream: status=${upstreamResponse.status}, len=${responseText.length}`);

    // If Cloudflare blocks, return upstream status so frontend can handle it
    if (
      upstreamResponse.status === 403 ||
      !upstreamResponse.headers.get("content-type")?.includes("application/json")
    ) {
      console.warn("Cloudflare blocked the request");
      return jsonRes(
        { success: false, error: "Upstream blocked by Cloudflare", status: upstreamResponse.status },
        502
      );
    }

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Proxy error:", err instanceof Error ? err.message : err);
    return jsonRes(
      { success: false, error: err instanceof Error ? err.message : "Proxy error" },
      500
    );
  }
});
