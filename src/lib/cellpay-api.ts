import { supabase } from "@/integrations/supabase/client";

const proxyCall = async <T = unknown>(params: Record<string, string>, options?: { method?: string; body?: unknown }): Promise<T> => {
  const searchParams = new URLSearchParams(params);
  const url = `cellpay-proxy?${searchParams.toString()}`;

  const fetchOptions: Record<string, unknown> = {
    method: options?.method ?? "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  };

  const { data, error } = await supabase.functions.invoke(url.split("?")[0], {
    body: options?.body ?? undefined,
    method: (options?.method as "GET" | "POST") ?? "GET",
    headers: { "x-proxy-params": JSON.stringify(params) },
  });

  if (error) throw new Error(`Proxy error: ${error.message}`);
  return data as T;
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
