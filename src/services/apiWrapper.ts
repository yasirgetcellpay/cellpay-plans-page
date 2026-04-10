const PROXY_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cellpay-proxy`;

export interface ApiDiagnostics {
  domain?: string;
  requested_url?: string;
  final_url?: string;
  error_stage?: string;
  html_length?: number;
  processing_time_ms?: number;
  upstream_status?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error: string | null;
  diagnostics?: ApiDiagnostics;
  status?: number;
}

interface ProxyFailurePayload {
  success: false;
  data?: unknown;
  error?: string;
  message?: string;
  diagnostics?: ApiDiagnostics;
  status?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseJsonSafely = (value: string): unknown => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const getFailurePayload = (value: unknown): ProxyFailurePayload | null => {
  if (!isRecord(value) || value.success !== false) {
    return null;
  }

  return value as unknown as ProxyFailurePayload;
};

const getErrorMessage = (payload: ProxyFailurePayload, fallback: string) => {
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
};

const apiRequest = async <T = unknown>(
  action: string,
  params?: Record<string, string>,
  options?: { method?: string; body?: unknown; timeoutMs?: number }
): Promise<ApiResponse<T>> => {
  const { method = "GET", body, timeoutMs = 15000 } = options ?? {};

  const url = new URL(PROXY_BASE);
  url.searchParams.set("action", action);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };

    const authToken = typeof window !== "undefined" ? localStorage.getItem("cellpay_token") : null;
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(url.toString(), {
      method: body ? "POST" : method,
      headers,
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    clearTimeout(timeoutId);

    const responseText = await res.text().catch(() => "");
    const parsedBody = parseJsonSafely(responseText);
    const failurePayload = getFailurePayload(parsedBody);

    if (res.status === 401) {
      return { success: false, error: "Unauthorized: Invalid API keys.", data: undefined };
    }
    if (res.status === 403) {
      return { success: false, error: "Forbidden: Access denied.", data: undefined };
    }
    if (!res.ok) {
      if (failurePayload) {
        return {
          success: false,
          error: getErrorMessage(failurePayload, `HTTP error ${res.status}.`),
          data: undefined,
          diagnostics: failurePayload.diagnostics,
          status: failurePayload.status ?? res.status,
        };
      }

      if (isRecord(parsedBody) && typeof parsedBody.error === "string") {
        return {
          success: false,
          error: parsedBody.error,
          data: undefined,
          status: res.status,
        };
      }

      return {
        success: false,
        error: responseText ? `HTTP error ${res.status}: ${responseText.slice(0, 200)}` : `HTTP error ${res.status}.`,
        data: undefined,
        status: res.status,
      };
    }

    if (failurePayload) {
      return {
        success: false,
        error: getErrorMessage(failurePayload, "Request failed."),
        data: undefined,
        diagnostics: failurePayload.diagnostics,
        status: failurePayload.status ?? res.status,
      };
    }

    if (typeof parsedBody === "undefined") {
      return {
        success: false,
        error: "Invalid response from server.",
        data: undefined,
        status: res.status,
      };
    }

    return { success: true, data: parsedBody as T, error: null, status: res.status };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Request timed out.", data: undefined };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
      data: undefined,
    };
  }
};

export interface Carrier {
  id?: number;
  name?: string;
  slug?: string;
  title?: string;
  logo?: string;
  image?: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface CheckoutPayload {
  payment_method: "cardpayment" | "paypal" | "applepay" | "googlepay" | "plaid" | "pockyt" | "klarna";
  amount: number;
  total: number;
  phone_number: string;
  carrierId: number;
  plan_id: string;
  slug?: string;
  is_gift?: boolean;
  is_postpaid?: boolean;
  carrier_pin?: string;
  ref_id?: string;
  vp_username?: string;
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
  apple_pay_billing_contact?: Record<string, unknown>;
  google_pay_token?: string;
  gpay_billing_details?: Record<string, unknown>;
  plaid_token?: string;
  plaid_id?: string;
  profileId?: string;
}

export const fetchCarriers = () =>
  apiRequest<{ carriers?: Carrier[]; data?: Carrier[] } | Carrier[]>("list-carriers");

export const fetchCarrierBySlug = <T = unknown>(slug: string, refill?: boolean) =>
  apiRequest<T>("view-carrier", { slug, ...(refill ? { refill: "1" } : {}) });

export const verifyPhone = <T = unknown>(slug: string, phoneNumber: string, planId?: string, amount?: number) =>
  apiRequest<T>("verify-phone", { slug }, {
    method: "POST",
    body: {
      phone_number: phoneNumber,
      confirm_phone_number: phoneNumber,
      ...(planId ? { plan_id: planId } : {}),
      ...(amount ? { amount } : {}),
    },
  });

export interface ValidateResult {
  success: boolean;
  data?: {
    amount: number;
    fee: number;
    tax: number;
    total: number;
    carrierId: number;
    payment_method_surcharge: number;
    carrier_id: number;
  };
}

export const validatePlan = (slug: string, phoneNumber: string, planId?: string, amount?: number) =>
  apiRequest<ValidateResult>("validate", { slug }, {
    method: "POST",
    body: {
      phone_number: phoneNumber,
      ...(planId ? { plan_id: planId } : {}),
      ...(amount ? { amount: String(amount) } : {}),
    },
  });

export const processCheckout = <T = unknown>(payload: CheckoutPayload) =>
  apiRequest<T>("checkout", {}, { method: "POST", body: payload });

export const fetchCheckoutClientConfig = <T = unknown>() =>
  apiRequest<T>("checkout-client-config");

export const createPlaidLinkToken = <T = unknown>(body: Record<string, unknown>) =>
  apiRequest<T>("plaid-link-token", {}, { method: "POST", body });

export const exchangePlaidToken = <T = unknown>(body: { public_token: string; metadata?: Record<string, unknown>; connected_account?: string; [key: string]: unknown }) =>
  apiRequest<T>("plaid-exchange-token", {}, { method: "POST", body });

export const createPaypalOrder = <T = unknown>(body: Record<string, unknown>) =>
  apiRequest<T>("paypal-create-order", {}, { method: "POST", body });

export const capturePaypalOrder = <T = unknown>(body: Record<string, unknown>) =>
  apiRequest<T>("paypal-capture-order", {}, { method: "POST", body });

export const createApplePaySession = <T = unknown>(body: Record<string, unknown>) =>
  apiRequest<T>("apple-pay-session", {}, { method: "POST", body });

export const createKlarnaSession = <T = unknown>(body: Record<string, unknown>) =>
  apiRequest<T>("klarna-session", {}, { method: "POST", body });

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  role_id: number;
  verified: boolean;
  user_type: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
}

export const loginUser = (email: string, password: string) =>
  apiRequest<AuthResponse>("user-login", {}, { method: "POST", body: { email, password } });

export const registerUser = (data: { email: string; password: string; first_name: string; last_name: string }) =>
  apiRequest<AuthResponse>("user-register", {}, { method: "POST", body: data });
