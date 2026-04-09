const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "PayPal client ID not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ clientId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
