import { supabase } from "@/integrations/supabase/client";

const invoke = async (params: Record<string, string>, body?: unknown) => {
  const searchParams = new URLSearchParams(params);
  const url = `cellpay-proxy?${searchParams.toString()}`;

  const options: Parameters<typeof supabase.functions.invoke>[1] = {};
  if (body) {
    options.body = body;
  } else {
    options.method = "GET";
  }

  const { data, error } = await supabase.functions.invoke(url, options);

  if (error) throw error;
  return data;
};

/** List all carriers */
export const listCarriers = () => invoke({ action: "list-carriers" });

/** Get carrier details + plans by slug */
export const viewCarrier = (slug: string, refill?: boolean) =>
  invoke({ action: "view-carrier", slug, ...(refill ? { refill: "1" } : {}) });

/** Verify a phone number for a carrier */
export const verifyPhone = (
  slug: string,
  phoneNumber: string,
  planId?: string,
  amount?: number
) =>
  invoke({ action: "verify-phone", slug }, {
    phone_number: phoneNumber,
    confirm_phone_number: phoneNumber,
    ...(planId ? { plan_id: planId } : {}),
    ...(amount ? { amount } : {}),
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
  invoke({ action: "checkout" }, payload);
