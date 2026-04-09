const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAID_ENV = "sandbox"; // Change to "production" when ready

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(
        JSON.stringify({ error: "Plaid credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "link_token";

    // --- Institution search ---
    if (action === "institutions_search") {
      const query = body.query || "";
      const response = await fetch(`https://${PLAID_ENV}.plaid.com/institutions/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          query,
          products: ["auth"],
          country_codes: ["US"],
          options: { include_optional_metadata: true },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Plaid institutions search error:", data);
        return new Response(
          JSON.stringify({ error: data.error_message || "Failed to search institutions" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ institutions: data.institutions || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Get top institutions ---
    if (action === "institutions_get") {
      const count = body.count || 20;
      const offset = body.offset || 0;
      const response = await fetch(`https://${PLAID_ENV}.plaid.com/institutions/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          count,
          offset,
          country_codes: ["US"],
          options: { include_optional_metadata: true, products: ["auth"] },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Plaid institutions get error:", data);
        return new Response(
          JSON.stringify({ error: data.error_message || "Failed to get institutions" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ institutions: data.institutions || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Default: create link token ---
    const clientUserId = body.user_id || "default-user";
    const response = await fetch(`https://${PLAID_ENV}.plaid.com/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        user: { client_user_id: clientUserId },
        client_name: "CellPay",
        products: ["auth"],
        country_codes: ["US"],
        language: "en",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Plaid API error:", data);
      return new Response(
        JSON.stringify({ error: data.error_message || "Failed to create link token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ link_token: data.link_token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
