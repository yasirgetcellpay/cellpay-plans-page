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

  try {
    const { data, error } = await supabase.functions.invoke("cellpay-proxy", {
      body: req,
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
  [key: string]: unknown;
}

export async function fetchCarriers(): Promise<Carrier[]> {
  const data = await callProxy({ endpoint: "carriers", method: "GET" });
  return extractArray(data, "carriers") as Carrier[];
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
  return callProxy({
    endpoint: "checkout/transaction",
    method: "POST",
    payload,
    bearerToken,
  });
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
