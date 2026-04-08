import { supabase } from "@/integrations/supabase/client";

const CELLPAY_BASE = "https://yasircell.cellpay.us/api";
const CELLPAY_API_KEY = "local-test-api-key";
const CELLPAY_API_SECRET = "local-test-api-secret";

const request = async <T = unknown>(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<T> => {
  const { method = "GET", body } = options ?? {};

  // Try direct fetch first (works from real browsers, blocked in sandboxed environments)
  try {
    const headers: Record<string, string> = {
      Accept: "*/*",
      "X-Api-Key": CELLPAY_API_KEY,
      "X-Api-Secret": CELLPAY_API_SECRET,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${CELLPAY_BASE}${endpoint}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.ok) {
      return res.json();
    }
  } catch {
    // CORS or network error — fall through to proxy
  }

  // Fallback: use edge function proxy
  const action = endpoint.startsWith("/carriers/view/")
    ? "view-carrier"
    : endpoint.startsWith("/carriers/verify-phone/")
      ? "verify-phone"
      : endpoint === "/carriers"
        ? "list-carriers"
        : endpoint === "/checkout/transaction"
          ? "checkout"
          : "unknown";

  const params: Record<string, string> = { action };

  if (action === "view-carrier" || action === "verify-phone") {
    const slug = endpoint.split("/").pop()?.split("?")[0] ?? "";
    params.slug = slug;
    if (endpoint.includes("refill=1")) {
      params.refill = "1";
    }
  }

  const searchParams = new URLSearchParams(params);
  const fnOptions: Parameters<typeof supabase.functions.invoke>[1] = {};
  if (body) {
    fnOptions.body = body;
  } else {
    fnOptions.method = "GET";
  }

  const { data, error } = await supabase.functions.invoke(
    `cellpay-proxy?${searchParams.toString()}`,
    fnOptions
  );

  if (error) throw error;

  // Check if proxy returned a fallback response
  if (data?.fallback) {
    throw new Error(data.error || "API temporarily unavailable");
  }

  return data;
};

/** List all carriers */
export const listCarriers = () => request("/carriers");

/** Get carrier details + plans by slug */
export const viewCarrier = (slug: string, refill?: boolean) =>
  request(`/carriers/view/${slug}${refill ? "?refill=1" : ""}`);

/** Verify a phone number for a carrier */
export const verifyPhone = (
  slug: string,
  phoneNumber: string,
  planId?: string,
  amount?: number
) =>
  request(`/carriers/verify-phone/${slug}`, {
    method: "POST",
    body: {
      phone_number: phoneNumber,
      confirm_phone_number: phoneNumber,
      ...(planId ? { plan_id: planId } : {}),
      ...(amount ? { amount } : {}),
    },
  });

/** Checkout / process payment */
export interface CheckoutPayload {
  payment_method: "cardpayment" | "paypal" | "applepay" | "googlepay" | "plaid" | "pockyt";
  amount: number;
  total: number;
  phone_number: string;
  carrierId: number;
  plan_id: string;
  slug?: string;
  payment: {
    firstName: string;
    lastName: string;
    email: string;
    address?: string;
    city?: string;
    zip?: string;
    cc_type?: string;
    cc_number?: string;
    cc_exp_month?: string;
    cc_exp_year?: string;
    cvv_number?: string;
  };
  billing?: {
    bill_email: string;
    country_id: string;
    region_id?: string;
    region_name?: string;
  };
  apple_pay_token?: string;
  google_pay_token?: string;
  plaid_token?: string;
  plaid_id?: string;
}

export const checkout = (payload: CheckoutPayload) =>
  request("/checkout/transaction", { method: "POST", body: payload });
