// CHECKOUT-FUNNEL: invisible, fire-and-forget checkout funnel analytics. Never throws, never awaited.
// Sends only event name, carrier, amount, fee, total, a random tab session id, lang and client time. No personal data.
export type FunnelEvent = "checkout_view" | "total_shown" | "payment_started" | "submitted" | "left_at_total" | "prefill_used" | "autopay_postpurchase_offer_shown" | "autopay_postpurchase_offer_accepted"; // EMAIL-PREFILL-1013: prefill_used; AUTOPAY-POSTPURCHASE-1013: autopay_postpurchase_*
export type FunnelData = { carrier?: string | null; amount?: number | null; fee?: number | null; total?: number | null };

const URL_ = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/funnel-event`;
const sent = new Set<string>();
let totalKey = "";

function sid(): string {
  try {
    let s = sessionStorage.getItem("cp_fsid");
    if (!s) {
      s = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      sessionStorage.setItem("cp_fsid", s);
    }
    return s;
  } catch {
    return "";
  }
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Call once per checkout page load so each event can fire again on the next load. */
export function resetFunnel(): void {
  try { sent.clear(); totalKey = ""; } catch { /* ignore */ }
}

export function funnelFired(event: FunnelEvent): boolean {
  try { return sent.has(event); } catch { return false; }
}

export function trackFunnel(event: FunnelEvent, data: FunnelData = {}): void {
  try {
    if (event === "total_shown") {
      const k = `${data.carrier ?? ""}|${data.amount ?? ""}|${data.fee ?? ""}`;
      if (k === totalKey) return;
      totalKey = k;
    } else if (sent.has(event)) {
      return;
    }
    sent.add(event);
    const body = JSON.stringify({
      event,
      carrier: typeof data.carrier === "string" ? data.carrier.slice(0, 40) : null,
      amount: n(data.amount), fee: n(data.fee), total: n(data.total),
      session_id: sid(),
      lang: (document.documentElement.lang || "").slice(0, 8) || null,
      client_ts: new Date().toISOString(),
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(URL_, new Blob([body], { type: "text/plain" }))) return;
    fetch(URL_, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  } catch {
    /* never affects checkout */
  }
}
