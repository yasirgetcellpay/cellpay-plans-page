const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods":
    "GET, POST, PUT, DELETE, OPTIONS",
};

const API_BASE = "https://yasircell.cellpay.us/api";

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
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid slug" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const refill = url.searchParams.get("refill");
        upstreamUrl = `${API_BASE}/carriers/view/${slug}${refill ? `?refill=${refill}` : ""}`;
        break;
      }
      case "verify-phone": {
        const verifySlug = url.searchParams.get("slug");
        if (!verifySlug || !/^[a-z0-9-]+$/.test(verifySlug)) {
          return new Response(JSON.stringify({ success: false, error: "Invalid slug" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        upstreamUrl = `${API_BASE}/carriers/verify-phone/${verifySlug}`;
        break;
      }
      case "checkout":
        upstreamUrl = `${API_BASE}/checkout/transaction`;
        break;
      default:
        return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const body = req.method !== "GET" ? await req.text() : undefined;

    console.log("Fetching:", req.method, upstreamUrl);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://yasircell.cellpay.us/",
        "Origin": "https://yasircell.cellpay.us",
        "X-Api-Key": CELLPAY_API_KEY,
        "X-Api-Secret": CELLPAY_API_SECRET,
      },
      ...(body ? { body } : {}),
    });

    const responseText = await upstreamResponse.text();
    console.log(`Response: status=${upstreamResponse.status}, length=${responseText.length}`);

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Proxy error:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Proxy error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
