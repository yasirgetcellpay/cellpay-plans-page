const PROXY_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cellpay-proxy`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error: string | null;
}

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
    const res = await fetch(url.toString(), {
      method: body ? "POST" : method,
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      return { success: false, error: "Unauthorized: Invalid API keys.", data: undefined };
    }
    if (res.status === 403) {
      return { success: false, error: "Forbidden: Access denied.", data: undefined };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `HTTP error ${res.status}: ${text.slice(0, 200)}`, data: undefined };
    }

    const data = await res.json();
    return { success: true, data: data as T, error: null };
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

export const fetchCarriers = () =>
  apiRequest<{ carriers?: Carrier[]; data?: Carrier[] } | Carrier[]>("list-carriers");

export const fetchCarrierBySlug = (slug: string, refill?: boolean) =>
  apiRequest("view-carrier", { slug, ...(refill ? { refill: "1" } : {}) });

export const verifyPhone = (slug: string, phoneNumber: string, planId?: string, amount?: number) =>
  apiRequest("verify-phone", { slug }, {
    method: "POST",
    body: {
      phone_number: phoneNumber,
      confirm_phone_number: phoneNumber,
      ...(planId ? { plan_id: planId } : {}),
      ...(amount ? { amount } : {}),
    },
  });

export const processCheckout = (payload: unknown) =>
  apiRequest("checkout", {}, { method: "POST", body: payload });
