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

export function trackAxon(event: string, params?: AxonParams): void {
  try {
    if (typeof window === "undefined" || typeof window.axon !== "function") return;
    if (params === undefined) window.axon("track", event);
    else window.axon("track", event, params);
  } catch {
    /* swallow — analytics must never break the app */
  }
}
