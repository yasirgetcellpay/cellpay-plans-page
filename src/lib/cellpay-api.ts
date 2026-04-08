const CELLPAY_BASE = "https://yasircell.cellpay.us/api";
const CELLPAY_API_KEY = "local-test-api-key";
const CELLPAY_API_SECRET = "local-test-api-secret";

const baseHeaders: Record<string, string> = {
  Accept: "*/*",
  "X-Api-Key": CELLPAY_API_KEY,
  "X-Api-Secret": CELLPAY_API_SECRET,
};

const request = async <T = unknown>(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<T> => {
  const { method = "GET", body } = options ?? {};

  const headers: Record<string, string> = body
    ? { ...baseHeaders, "Content-Type": "application/json" }
    : { ...baseHeaders };

  const res = await fetch(`${CELLPAY_BASE}${endpoint}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CellPay API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
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
