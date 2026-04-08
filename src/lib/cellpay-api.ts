const PROXY_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cellpay-proxy`;

const request = async <T = unknown>(
  action: string,
  params?: Record<string, string>,
  options?: { method?: string; body?: unknown }
): Promise<T> => {
  const { method = "GET", body } = options ?? {};

  const url = new URL(PROXY_BASE);
  url.searchParams.set("action", action);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  const res = await fetch(url.toString(), {
    method: body ? "POST" : method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  // Handle fallback responses from proxy
  if (data && data.fallback === true) {
    throw new Error(data.error || "API temporarily unavailable");
  }

  return data as T;
};

/** List all carriers */
export const listCarriers = () => request("list-carriers");

/** Get carrier details + plans by slug */
export const viewCarrier = (slug: string, refill?: boolean) =>
  request("view-carrier", { slug, ...(refill ? { refill: "1" } : {}) });

/** Verify a phone number for a carrier */
export const verifyPhone = (
  slug: string,
  phoneNumber: string,
  planId?: string,
  amount?: number
) =>
  request("verify-phone", { slug }, {
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
  request("checkout", {}, { method: "POST", body: payload });
