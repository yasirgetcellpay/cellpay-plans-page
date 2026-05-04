import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 15000;

interface ProxyRequest {
  endpoint: string;
  method?: string;
  payload?: Record<string, unknown>;
  bearerToken?: string;
}

export async function callProxy(req: ProxyRequest): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Auto-inject bearer token from localStorage if not explicitly provided
  if (!req.bearerToken) {
    const storedToken = localStorage.getItem("cellpay_token");
    if (storedToken) req.bearerToken = storedToken;
  }

  // Forward caller's hostname so the edge function can derive the X-Cellpay-Domain header
  const callerHost = typeof window !== "undefined" ? window.location.hostname : "";
  const FALLBACK_HOST_SUFFIXES = ["lovable.dev", "lovable.app", "lovableproject.com", "localhost"];
  const cleaned = callerHost.toLowerCase().split(":")[0];
  let resolvedDomain = "www.cellpay.us";
  if (cleaned && !FALLBACK_HOST_SUFFIXES.some((s) => cleaned === s || cleaned.endsWith(`.${s}`))) {
    resolvedDomain = cleaned;
  }
  console.log(`[cellpay-proxy] -> X-Cellpay-Domain="${resolvedDomain}" (callerHost="${callerHost}", endpoint=${req.endpoint})`);

  try {
    const { data, error } = await supabase.functions.invoke("cellpay-proxy", {
      body: { ...req, callerHost },
    });

    if (error) throw new Error(error.message || "Proxy call failed");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Recursive extraction helper for inconsistent API nesting
function extractArray(data: unknown, key: string): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
    if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested[key])) return nested[key] as unknown[];
    }
    // Try direct data array
    if (Array.isArray(obj.data)) return obj.data as unknown[];
  }
  return [];
}

export interface Carrier {
  id: number | string;
  name: string;
  slug: string;
  logo?: string;
  [key: string]: unknown;
}

export interface Plan {
  id: number | string;
  name: string;
  amount: number | string;
  description?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  success: boolean;
  fee?: number;
  tax?: number;
  total?: number;
  message?: string;
  [key: string]: unknown;
}

export interface CarrierViewData {
  seo_carrier?: {
    carrier?: string;
    carrierId?: number;
    recommended?: { h1?: string; h2?: string };
    support_text?: { option1?: string };
    faqs?: Array<{ question: string; answer: string }>;
    title_for_layout?: string;
    seo_description?: string;
    seo_keywords?: string;
    seo_schema?: string;
  };
  title_for_layout?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_schema?: string;
  carrier?: {
    id: number;
    name: string;
    carrierId: number;
    slug: string;
    [key: string]: unknown;
  };
  carrier_plans?: Array<Record<string, unknown>> | {
    rangePlan?: boolean | string;
    plans?: Array<Record<string, unknown>>;
    carrier?: {
      ID?: number;
      rangeMin?: number;
      rangeMax?: number;
      rangePlan?: string;
      userMessage?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  fixed_plans?: Array<Record<string, unknown>> | {
    rangePlan?: boolean | string;
    plans?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SeoPayload {
  title_for_layout?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_schema?: string;
}

function extractSeo(source: unknown): SeoPayload {
  if (!source || typeof source !== "object") return {};
  const obj = source as Record<string, unknown>;
  return {
    title_for_layout: obj.title_for_layout as string | undefined,
    seo_description: obj.seo_description as string | undefined,
    seo_keywords: obj.seo_keywords as string | undefined,
    seo_schema: obj.seo_schema as string | undefined,
  };
}

export async function fetchCarriers(): Promise<{ carriers: Carrier[]; seo: SeoPayload }> {
  const raw = await callProxy({ endpoint: "carriers", method: "GET" });
  const carriers = extractArray(raw, "carriers") as Carrier[];

  // Locate the layer that holds SEO fields (top-level or nested under data/data.data)
  const wrapper = (raw || {}) as Record<string, unknown>;
  const layers: unknown[] = [wrapper];
  if (wrapper.data && typeof wrapper.data === "object") {
    layers.push(wrapper.data);
    const inner = wrapper.data as Record<string, unknown>;
    if (inner.data && typeof inner.data === "object") layers.push(inner.data);
  }
  let seo: SeoPayload = {};
  for (const layer of layers) {
    const candidate = extractSeo(layer);
    if (candidate.title_for_layout || candidate.seo_description || candidate.seo_keywords || candidate.seo_schema) {
      seo = candidate;
      break;
    }
  }

  return { carriers, seo };
}

export async function fetchCarrierView(slug: string): Promise<CarrierViewData> {
  const raw = await callProxy({ endpoint: `carriers/view/${slug}`, method: "GET" });
  const wrapper = raw as Record<string, unknown>;
  if (wrapper.success === false) {
    throw new Error((wrapper.error as string) || "Failed to load carrier");
  }
  // Handle double-nested { data: { data: { ... } } } structure
  let result = (wrapper.data || wrapper) as Record<string, unknown>;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    const inner = result.data as Record<string, unknown>;
    if (inner.carrier || inner.carrier_plans || inner.seo_carrier) {
      result = inner;
    }
  }
  return result as CarrierViewData;
}

export async function fetchPlans(carrierSlug: string): Promise<Plan[]> {
  const data = await callProxy({ endpoint: `carriers/${carrierSlug}/plans`, method: "GET" });
  return extractArray(data, "plans") as Plan[];
}

export async function verifyPhone(
  carrierSlug: string,
  phoneNumber: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const raw = await callProxy({
      endpoint: `carriers/verify-phone/${carrierSlug}`,
      method: "POST",
      payload: { phone_number: phoneNumber, confirm_phone_number: phoneNumber },
    });
    const wrapper = raw as Record<string, unknown>;
    if (wrapper.success === false) {
      const inner = wrapper.data as Record<string, unknown> | undefined;
      const innerSuccess = inner && typeof inner === "object" ? inner.success : undefined;
      if (innerSuccess === true) return { success: true };
      const msg =
        (wrapper.error as string) ||
        (inner?.message as string) ||
        "Couldn't verify the phone number";
      return { success: false, message: msg };
    }
    let result = (wrapper.data || wrapper) as Record<string, unknown>;
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      result = result.data as Record<string, unknown>;
    }
    if (result.success === false) {
      return { success: false, message: (result.message as string) || "Invalid phone number" };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Couldn't verify the phone number";
    return { success: false, message: msg };
  }
}

export async function validateRecharge(
  carrierSlug: string,
  phoneNumber: string,
  planId?: string | number,
  amount?: number
): Promise<ValidationResult> {
  const payload: Record<string, unknown> = { phone_number: phoneNumber };
  if (planId) payload.plan_id = planId;
  if (amount !== undefined && amount !== null) payload.amount = amount;

  const raw = await callProxy({
    endpoint: `carriers/validate/${carrierSlug}`,
    method: "POST",
    payload,
  });

  // Proxy wraps responses: { success, data, error }
  const wrapper = raw as Record<string, unknown>;
  if (wrapper.success === false) {
    return { success: false, message: (wrapper.error as string) || "Validation failed" } as ValidationResult;
  }
  // Handle double-nested { data: { data: { amount, fee, tax, total } } }
  let result = (wrapper.data || wrapper) as Record<string, unknown>;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    const inner = result.data as Record<string, unknown>;
    if (inner.amount !== undefined || inner.fee !== undefined || inner.total !== undefined) {
      result = inner;
    }
  }
  return result as ValidationResult;
}

export async function submitTransaction(
  payload: Record<string, unknown>,
  bearerToken?: string
): Promise<unknown> {
  // Log pending attempt to admin dashboard
  let logId: string | null = null;
  try {
    const p = payload as Record<string, unknown>;
    const paymentObj = (p.payment as Record<string, unknown>) || {};
    const meta = (window as unknown as { __cellpayCheckoutMeta?: Record<string, unknown> }).__cellpayCheckoutMeta || {};
    const { data: inserted } = await supabase
      .from("transaction_logs")
      .insert([{
        carrier_name: (meta.carrierName as string) || null,
        carrier_slug: (meta.carrierSlug as string) || null,
        carrier_id: p.carrierId != null ? String(p.carrierId) : null,
        plan_id: p.plan_id != null ? String(p.plan_id) : null,
        phone_number: (p.phone_number as string) || null,
        email: (paymentObj.email as string) || null,
        first_name: (paymentObj.firstName as string) || null,
        last_name: (paymentObj.lastName as string) || null,
        amount: (p.amount as number) ?? null,
        total: (p.total as number) ?? null,
        payment_method: (p.payment_method as string) || null,
        card_type: (p.ctype as string) || null,
        status: "pending",
        source_ip: (p.source as string) || null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        metadata: meta as Record<string, unknown>,
      }])
      .select("id")
      .single();
    logId = inserted?.id || null;
  } catch (e) {
    console.warn("[tx-log] insert failed", e);
  }

  let raw: unknown;
  let txError: string | null = null;
  try {
    raw = await callProxy({ endpoint: "checkout/transaction", method: "POST", payload, bearerToken });
  } catch (e) {
    txError = e instanceof Error ? e.message : String(e);
    if (logId) {
      await supabase.from("transaction_logs").update({ status: "failed", error_message: txError }).eq("id", logId);
    }
    throw e;
  }

  // Determine success/failure from response
  try {
    let result = (raw as Record<string, unknown>) || {};
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      const inner = result.data as Record<string, unknown>;
      result = (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data))
        ? (inner.data as Record<string, unknown>) : inner;
    }
    const status = result.status;
    const isSuccess = status === true || status === "true" ||
      String(status || "").toLowerCase() === "success" ||
      String(status || "").toLowerCase() === "completed";
    if (logId) {
      await supabase.from("transaction_logs").update({
        status: isSuccess ? "success" : "failed",
        hashid: (result.hashid as string) || null,
        transaction_id: (result.transactionId as string) || (result.transaction_id as string) || null,
        error_message: isSuccess ? null : ((result.msg as string) || (result.message as string) || null),
        raw_response: result as Record<string, unknown>,
      }).eq("id", logId);
    }
  } catch (e) {
    console.warn("[tx-log] update failed", e);
  }

  return raw;
}

export async function fetchCheckoutConfig(): Promise<Record<string, unknown>> {
  const raw = await callProxy({ endpoint: "payments/checkout-client-config", method: "GET" });
  const wrapper = raw as Record<string, unknown>;
  let result = (wrapper.data || wrapper) as Record<string, unknown>;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    result = result.data as Record<string, unknown>;
  }
  return result;
}

// Auth
export async function loginUser(email: string, password: string): Promise<unknown> {
  return callProxy({
    endpoint: "auth/login",
    method: "POST",
    payload: { email, password },
  });
}

export async function registerUser(email: string, password: string, name: string): Promise<unknown> {
  return callProxy({
    endpoint: "auth/register",
    method: "POST",
    payload: { email, password, name },
  });
}

// PayPal
export async function createPayPalOrder(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "payments/paypal/create-order", method: "POST", payload });
}

export async function capturePayPalOrder(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "payments/paypal/capture-order", method: "POST", payload });
}

// Plaid
export async function createPlaidLinkToken(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "payments/plaid/link-token", method: "POST", payload });
}

export async function exchangePlaidToken(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "payments/plaid/exchange-token", method: "POST", payload });
}

// Apple Pay session
export async function createApplePaySession(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "payments/apple-pay/session", method: "POST", payload });
}

// Klarna session
export async function createKlarnaSession(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "payments/klarna/session", method: "POST", payload });
}

// Pockyt (Cash App) session status
export async function fetchPockytSessionStatus(sessionId: string): Promise<Record<string, unknown>> {
  const raw = await callProxy({
    endpoint: `payments/pockyt/session/${sessionId}/status`,
    method: "GET",
  });
  const wrapper = raw as Record<string, unknown>;
  let result = (wrapper.data || wrapper) as Record<string, unknown>;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    result = result.data as Record<string, unknown>;
  }
  return result;
}

// User profile
export async function fetchUserProfile(): Promise<Record<string, unknown>> {
  const raw = await callProxy({ endpoint: "users/profile", method: "GET" });
  const wrapper = raw as Record<string, unknown>;
  let result = (wrapper.data || wrapper) as Record<string, unknown>;
  // Unwrap nested data layers: { data: { data: { user: {...} } } }
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    result = result.data as Record<string, unknown>;
  }
  if (result.user && typeof result.user === "object") {
    result = result.user as Record<string, unknown>;
  }
  return result;
}

export async function updateUserProfile(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const raw = await callProxy({ endpoint: "users/profile", method: "PATCH", payload });
  const wrapper = raw as Record<string, unknown>;
  if (wrapper.success === false) {
    throw new Error((wrapper.error as string) || "Failed to update profile");
  }
  let result = (wrapper.data || wrapper) as Record<string, unknown>;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    result = result.data as Record<string, unknown>;
  }
  return result;
}
