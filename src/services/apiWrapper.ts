import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 15000;

interface ProxyRequest {
  endpoint: string;
  method?: string;
  payload?: Record<string, unknown>;
  bearerToken?: string;
}

async function callProxy(req: ProxyRequest): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

export async function fetchCarriers(): Promise<Carrier[]> {
  const data = await callProxy({ endpoint: "carriers", method: "GET" });
  return extractArray(data, "carriers") as Carrier[];
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
  if (amount) payload.amount = amount;

  const data = await callProxy({
    endpoint: `carriers/validate/${carrierSlug}`,
    method: "POST",
    payload,
  });

  return data as ValidationResult;
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
  const data = await callProxy({ endpoint: "checkout-client-config", method: "GET" });
  return data as Record<string, unknown>;
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
  return callProxy({ endpoint: "checkout/paypal/create-order", method: "POST", payload });
}

export async function capturePayPalOrder(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "checkout/paypal/capture-order", method: "POST", payload });
}

// Plaid
export async function createPlaidLinkToken(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "checkout/plaid/create-link-token", method: "POST", payload });
}

export async function exchangePlaidToken(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "checkout/plaid/exchange-token", method: "POST", payload });
}

// Apple Pay session
export async function createApplePaySession(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "checkout/applepay/session", method: "POST", payload });
}

// Klarna session
export async function createKlarnaSession(payload: Record<string, unknown>): Promise<unknown> {
  return callProxy({ endpoint: "checkout/klarna/session", method: "POST", payload });
}
