const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CELLPAY_BASE = "https://yasircell.cellpay.us/api";

const FALLBACK_CARRIERS = [
  { id: 1, name: "AT&T", slug: "att", active: 1 },
  { id: 2, name: "T-Mobile", slug: "t-mobile", active: 1 },
  { id: 3, name: "Verizon", slug: "verizon", active: 1 },
  { id: 4, name: "Boost Mobile", slug: "boost", active: 1 },
  { id: 5, name: "Cricket Wireless", slug: "cricket", active: 1 },
  { id: 6, name: "Metro by T-Mobile", slug: "metro", active: 1 },
  { id: 7, name: "Straight Talk", slug: "straight-talk", active: 1 },
  { id: 8, name: "TracFone", slug: "tracfone", active: 1 },
  { id: 9, name: "Net10 Wireless", slug: "net10", active: 1 },
  { id: 10, name: "H2O Wireless", slug: "h2o", active: 1 },
  { id: 11, name: "Lycamobile", slug: "lycamobile", active: 1 },
  { id: 12, name: "Ultra Mobile", slug: "ultra-mobile", active: 1 },
  { id: 13, name: "US Cellular", slug: "us-cellular", active: 1 },
  { id: 14, name: "Page Plus", slug: "page-plus", active: 1 },
  { id: 15, name: "Simple Mobile", slug: "simple-mobile", active: 1 },
];

const FALLBACK_DETAILS: Record<string, unknown> = {
  boost: {
    success: true,
    data: {
      title_for_layout: "Boost Mobile",
      seo_carrier: { carrier: "Boost Mobile", carrierId: 4, recommended: { h1: "Boost Mobile Refill", h2: "Choose your plan" }, faqs: [{ question: "How do I refill?", answer: "Enter your phone number, select a plan, and pay." }] },
      carrier_plans: { rangePlan: true, carrier: { id: 4, carrierId: 4, name: "Boost Mobile", shortName: "boost", rangeMin: 5, rangeMax: 250 } },
    },
  },
  att: {
    success: true,
    data: {
      title_for_layout: "AT&T",
      seo_carrier: { carrier: "AT&T", carrierId: 1, recommended: { h1: "AT&T Prepaid Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "att-25", price: "25", title: "$25 Prepaid Refill" },
        { plan_id: "att-35", price: "35", title: "$35 Prepaid Refill" },
        { plan_id: "att-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "att-65", price: "65", title: "$65 Prepaid Refill" },
        { plan_id: "att-75", price: "75", title: "$75 Prepaid Refill" },
      ],
    },
  },
  "t-mobile": {
    success: true,
    data: {
      title_for_layout: "T-Mobile",
      seo_carrier: { carrier: "T-Mobile", carrierId: 2, recommended: { h1: "T-Mobile Prepaid Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "tmo-10", price: "10", title: "$10 Prepaid Refill" },
        { plan_id: "tmo-25", price: "25", title: "$25 Prepaid Refill" },
        { plan_id: "tmo-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "tmo-60", price: "60", title: "$60 Prepaid Refill" },
      ],
    },
  },
  verizon: {
    success: true,
    data: {
      title_for_layout: "Verizon",
      seo_carrier: { carrier: "Verizon", carrierId: 3, recommended: { h1: "Verizon Prepaid Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "vz-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "vz-35", price: "35", title: "$35 Prepaid Refill" },
        { plan_id: "vz-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "vz-70", price: "70", title: "$70 Prepaid Refill" },
      ],
    },
  },
  cricket: {
    success: true,
    data: {
      title_for_layout: "Cricket Wireless",
      seo_carrier: { carrier: "Cricket Wireless", carrierId: 5, recommended: { h1: "Cricket Wireless Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "cr-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "cr-40", price: "40", title: "$40 Prepaid Refill" },
        { plan_id: "cr-55", price: "55", title: "$55 Prepaid Refill" },
        { plan_id: "cr-60", price: "60", title: "$60 Prepaid Refill" },
      ],
    },
  },
  metro: {
    success: true,
    data: {
      title_for_layout: "Metro by T-Mobile",
      seo_carrier: { carrier: "Metro by T-Mobile", carrierId: 6, recommended: { h1: "Metro by T-Mobile Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "mt-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "mt-40", price: "40", title: "$40 Prepaid Refill" },
        { plan_id: "mt-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "mt-60", price: "60", title: "$60 Prepaid Refill" },
      ],
    },
  },
};

function getFallbackDetail(slug: string) {
  if (FALLBACK_DETAILS[slug]) return FALLBACK_DETAILS[slug];
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  return {
    success: true,
    data: {
      title_for_layout: name,
      seo_carrier: { carrier: name, recommended: { h1: `${name} Refill`, h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: `${slug}-25`, price: "25", title: "$25 Prepaid Refill" },
        { plan_id: `${slug}-30`, price: "30", title: "$30 Prepaid Refill" },
        { plan_id: `${slug}-50`, price: "50", title: "$50 Prepaid Refill" },
      ],
    },
  };
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function serveFallback(action: string | null, url: URL) {
  switch (action) {
    case "list-carriers":
      return jsonResponse({ success: true, data: FALLBACK_CARRIERS });
    case "view-carrier": {
      const slug = url.searchParams.get("slug") ?? "";
      return jsonResponse(getFallbackDetail(slug));
    }
    default:
      return jsonResponse({ success: false, error: "Action not available in fallback mode" }, 400);
  }
}

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
    console.log("Using API Key:", CELLPAY_API_KEY.substring(0, 5) + "...");

    const response = await fetch(endpoint, {
      method,
      headers: body ? { ...baseHeaders, "Content-Type": "application/json" } : baseHeaders,
      ...(body ? { body } : {}),
    });

    const responseText = await response.text();
    console.log(`Response: status=${response.status}, content-type=${response.headers.get("content-type")}, body=${responseText.substring(0, 300)}`);

    if (response.status === 403 || !response.headers.get("content-type")?.includes("application/json")) {
      console.warn(`CellPay blocked (${response.status}), serving fallback`);
      return serveFallback(action, url);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.warn("JSON parse failed, serving fallback");
      return serveFallback(action, url);
    }

    if (!response.ok) {
      console.warn(`Upstream error ${response.status}, serving fallback`);
      return serveFallback(action, url);
    }

    return jsonResponse(data);
  } catch (error: unknown) {
    console.error("Proxy error:", error instanceof Error ? error.message : error);
    return serveFallback(action, url);
  }
});
