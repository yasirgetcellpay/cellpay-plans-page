const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CELLPAY_BASE = "https://yasircell.cellpay.us/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const CELLPAY_API_KEY = Deno.env.get("CELLPAY_API_KEY");
  const CELLPAY_API_SECRET = Deno.env.get("CELLPAY_API_SECRET");

  if (!CELLPAY_API_KEY || !CELLPAY_API_SECRET) {
    return new Response(JSON.stringify({ error: "CellPay API credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const cellpayHeaders: Record<string, string> = {
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
      "Content-Type": "application/json",
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
          return new Response(JSON.stringify({ error: "Invalid slug" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const refill = url.searchParams.get("refill");
        endpoint = `${CELLPAY_BASE}/carriers/view/${slug}${refill ? `?refill=${refill}` : ""}`;
        break;
      }
      case "verify-phone": {
        const slug = url.searchParams.get("slug");
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
          return new Response(JSON.stringify({ error: "Invalid slug" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const response = await fetch(endpoint, {
      method,
      headers: cellpayHeaders,
      ...(body ? { body } : {}),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      console.error("CellPay returned non-JSON:", response.status, text.slice(0, 200));
      return new Response(JSON.stringify({ 
        error: "CellPay API returned non-JSON response (possible Cloudflare challenge)", 
        status: response.status 
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("CellPay proxy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});