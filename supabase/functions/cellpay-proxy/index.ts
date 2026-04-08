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

const isFallbackableStatus = (status: number) => status === 403 || status >= 500;

const readUpstreamError = (data: unknown, status: number) => {
  if (typeof data === "object" && data !== null) {
    const candidate = (data as { error?: unknown; message?: unknown }).error ??
      (data as { error?: unknown; message?: unknown }).message;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return `CellPay API error: ${status}`;
};

const buildFallbackPayload = ({
  action,
  endpoint,
  error,
  upstreamStatus,
  diagnostics,
}: {
  action: string | null;
  endpoint: string;
  error: string;
  upstreamStatus: number;
  diagnostics?: Record<string, unknown>;
}) => ({
  success: false,
  fallback: true,
  action,
  error,
  upstreamStatus,
  diagnostics: {
    endpoint,
    ...diagnostics,
  },
  data: null,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const CELLPAY_API_KEY = Deno.env.get("CELLPAY_API_KEY");
  const CELLPAY_API_SECRET = Deno.env.get("CELLPAY_API_SECRET");

  if (!CELLPAY_API_KEY || !CELLPAY_API_SECRET) {
    return jsonResponse({ error: "CellPay API credentials not configured" }, 500);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const baseHeaders: Record<string, string> = {
      Accept: "*/*",
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

    console.log("Fetching:", method, endpoint, "Headers:", JSON.stringify(Object.keys(baseHeaders)));

    const response = await fetch(endpoint, {
      method,
      headers: body
        ? { ...baseHeaders, "Content-Type": "application/json" }
        : baseHeaders,
      ...(body ? { body } : {}),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      const error = "CellPay API returned non-JSON response (possible Cloudflare challenge)";

      console.error("CellPay returned non-JSON:", response.status, text.slice(0, 200));

      if (isFallbackableStatus(response.status)) {
        return jsonResponse(
          buildFallbackPayload({
            action,
            endpoint,
            error,
            upstreamStatus: response.status,
            diagnostics: {
              errorStage: "invalid_content_type",
              contentType,
              preview: text.slice(0, 200),
            },
          }),
          200,
        );
      }

      return jsonResponse(
        {
          success: false,
          fallback: false,
          error,
          upstreamStatus: response.status,
        },
        502,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid JSON payload";
      console.error("CellPay JSON parse error:", response.status, message);

      if (isFallbackableStatus(response.status)) {
        return jsonResponse(
          buildFallbackPayload({
            action,
            endpoint,
            error: "CellPay API returned invalid JSON",
            upstreamStatus: response.status,
            diagnostics: {
              errorStage: "json_parse_failed",
              message,
            },
          }),
          200,
        );
      }

      return jsonResponse(
        {
          success: false,
          fallback: false,
          error: "CellPay API returned invalid JSON",
          upstreamStatus: response.status,
        },
        502,
      );
    }

    if (!response.ok) {
      const error = readUpstreamError(data, response.status);

      if (isFallbackableStatus(response.status)) {
        return jsonResponse(
          buildFallbackPayload({
            action,
            endpoint,
            error,
            upstreamStatus: response.status,
            diagnostics: {
              errorStage: "upstream_error_response",
            },
          }),
          200,
        );
      }

      return jsonResponse(
        {
          success: false,
          fallback: false,
          error,
          upstreamStatus: response.status,
          data,
        },
        response.status,
      );
    }

    return jsonResponse(data, response.status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("CellPay proxy error:", message);

    return jsonResponse(
      {
        success: false,
        fallback: true,
        error: "CellPay proxy request failed",
        diagnostics: {
          errorStage: "proxy_exception",
          message,
        },
        data: null,
      },
      200,
    );
  }
});
