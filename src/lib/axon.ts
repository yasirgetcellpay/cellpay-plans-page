// AppLovin Axon Pixel helper. The base pixel is loaded in index.html and
// exposes a global `axon(...)` queue function (the new Axon Pixel API).
// Event names are snake_case (page_view, view_item, add_to_cart,
// begin_checkout, purchase) and payloads follow the Axon item / user_data
// schema documented at:
// https://support.applovin.com/en/growth/promoting-your-websites/track-and-optimize/events-and-objects

type AxonParams = Record<string, unknown>;

type AxonFn = (op: "init" | "track", eventName?: string, data?: AxonParams) => void;

declare global {
  interface Window {
    axon?: AxonFn;
  }
}

export interface AxonItem {
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
  item_category_id?: number;
  item_variant_id?: string;
  item_brand?: string;
}

export interface AxonPurchaseInput {
  transactionId: string;
  itemId: string;
  itemName: string;
  value: number;
  email?: string;
  phone?: string;
}

export const normalizeAxonAmount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const normalizeAxonPhone = (value: unknown): string | undefined => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits.length > 0 ? digits : undefined;
};

export function trackAxon(event: string, params?: AxonParams): void {
  try {
    if (typeof window === "undefined" || typeof window.axon !== "function") return;
    if (params === undefined) window.axon("track", event);
    else window.axon("track", event, params);
  } catch {
    /* swallow — analytics must never break the app */
  }
}

export function trackAxonPurchase(input: AxonPurchaseInput): void {
  const value = normalizeAxonAmount(input.value);
  const transactionId = String(input.transactionId || "").trim();
  if (!transactionId || value <= 0) return;

  const email = input.email?.trim().toLowerCase();
  const phone = normalizeAxonPhone(input.phone);
  const userData: Record<string, string> = {};
  if (email) userData.email = email;
  if (phone) userData.phone = phone;
  if (transactionId.length >= 6) userData.user_id = transactionId;

  trackAxon("purchase", {
    currency: "USD",
    value,
    shipping: 0,
    tax: 0,
    transaction_id: transactionId,
    items: [
      {
        item_id: String(input.itemId || "recharge"),
        item_name: input.itemName || "Recharge",
        price: value,
        quantity: 1,
      },
    ],
    ...(Object.keys(userData).length > 0 ? { user_data: userData } : {}),
  });
}
