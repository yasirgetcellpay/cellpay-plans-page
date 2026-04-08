const CELLPAY_BASE = "https://yasircell.cellpay.us/api";

const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cellpay-proxy`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const proxyCall = async <T = unknown>(
  params: Record<string, string>,
  options?: { method?: string; body?: unknown }
): Promise<T> => {
  const url = new URL(proxyUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    headers,
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Proxy error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
};

/** List all carriers */
export const listCarriers = () => proxyCall({ action: "list-carriers" });

/** Get carrier details + plans by slug */
export const viewCarrier = (slug: string, refill?: boolean) =>
  proxyCall({
    action: "view-carrier",
    slug,
    ...(refill ? { refill: "1" } : {}),
  });

/** Verify a phone number for a carrier */
export const verifyPhone = (
  slug: string,
  phoneNumber: string,
  planId?: string,
  amount?: number
) =>
  proxyCall(
    { action: "verify-phone", slug },
    {
      method: "POST",
      body: {
        phone_number: phoneNumber,
        confirm_phone_number: phoneNumber,
        ...(planId ? { plan_id: planId } : {}),
        ...(amount ? { amount } : {}),
      },
    }
  );

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
  proxyCall({ action: "checkout" }, { method: "POST", body: payload });
