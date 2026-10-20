import type { KlarnaField } from "./klarnaMissing"; // KLARNA-OPEN-1019
// CHECKOUT-FUNNEL: invisible, fire-and-forget checkout funnel analytics. Never throws, never awaited.
// Sends only event name, carrier, amount, fee, total, a random tab session id, lang and client time. No personal data.
export type FunnelEvent = "checkout_view" | "total_shown" | "payment_started" | "submitted" | "left_at_total" | "prefill_used" | "autopay_postpurchase_offer_shown" | "autopay_postpurchase_offer_accepted" | "recovery_prompt_shown" | "recovery_retry" | "recovery_success" | "maybe_paid_shown" | "maybe_paid_lock_shown" | "retry_offer_shown" | "retry_tapped" | "retry_success" | "retry_late_alive" /* REFUND-RETRY-LATE-1018 */ | "decline_screen_shown" | "decline_action" | KlarnaFunnelEvent; // DECLINE-RECOVERY-1014: recovery_*; // EMAIL-PREFILL-1013: prefill_used; AUTOPAY-POSTPURCHASE-1013: autopay_postpurchase_* // KLARNA-FUNNEL-1017 // DBT-FOLLOWUP-1017 // REFUND-RETRY-1018 // DECLINE-REJECTED-1018
export type KlarnaFunnelEvent = "klarna_form_blocked" | "klarna_auth_abandoned" | "klarna_offer_shown" | "klarna_clicked" | "klarna_session_created" | "klarna_auth_result" | "klarna_ab_known" | "klarna_session_failed" | "klarna_form_started"; // KLARNA-FUNNEL-1017 // KLARNA-FUNNEL-FIX-1017 // KLARNA-LOG-1017 // KLARNA-FORM-1018
export type FunnelData = { klarna_field?: KlarnaField; retry_cause?: string; retry_action?: string; retry_to_carrier?: string | null; carrier?: string | null; amount?: number | null; fee?: number | null; total?: number | null; screen?: "decline_nsf" | "decline_other" | "method_list" | "nsf" | "risk" | "details" | "blocked" | "cap" | "other"; decline_method?: string; ap_available?: boolean; gp_available?: boolean; decline_buttons?: string; decline_action?: string; decline_ab?: "control" | "variant" | null; checkout_session_id?: string; klarna_result?: "approved" | "declined" | "cancelled"; shown?: boolean; cap?: boolean; klarna_categories?: string; klarna_category?: string; klarna_show_form?: boolean; klarna_approved?: boolean; klarna_load?: "ok" | "no_form" | "error" | "timeout"; klarna_reason?: "no_token" | "sdk_load_failed" | "sdk_missing" | "network" | "server_error"; klarna_finalize_required?: boolean; klarna_error?: string }; // KLARNA-FUNNEL-1017 // KLARNA-CAT-1017 // KLARNA-LOG-1017 // REFUND-RETRY-1018 // DECLINE-REJECTED-1018

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

export function trackFunnel(event: FunnelEvent | KlarnaFunnelEvent, data: FunnelData = {}, onceKey?: string): void { // KLARNA-FUNNEL-1017
  try {
    const dedupeKey = onceKey === undefined ? event : `${event}|${onceKey}`; // KLARNA-FUNNEL-1017
    if (onceKey !== undefined && sent.has(dedupeKey)) return; // KLARNA-FUNNEL-1017
    if (onceKey === undefined && event === "total_shown") { // KLARNA-FUNNEL-1017
      const k = `${data.carrier ?? ""}|${data.amount ?? ""}|${data.fee ?? ""}`;
      if (k === totalKey) return;
      totalKey = k;
    } else if (sent.has(dedupeKey)) { // KLARNA-FUNNEL-1017
      return;
    }
    sent.add(dedupeKey); // KLARNA-FUNNEL-1017
    const body = JSON.stringify({
      event,
      carrier: typeof data.carrier === "string" ? data.carrier.slice(0, 40) : null,
      amount: n(data.amount), fee: n(data.fee), total: n(data.total),
      session_id: sid(),
      lang: (document.documentElement.lang || "").slice(0, 8) || null,
      client_ts: new Date().toISOString(),
      ...(event.startsWith("decline_") ? { screen: data.screen, decline_ab: data.decline_ab, checkout_session_id: data.checkout_session_id, decline_method: data.decline_method, ap_available: data.ap_available, gp_available: data.gp_available, decline_buttons: data.decline_buttons, decline_action: data.decline_action } : {}), // DECLINE-REJECTED-1018
      ...(event.startsWith("retry_") ? { retry_cause: typeof data.retry_cause === "string" ? data.retry_cause.slice(0, 80) : null, retry_action: typeof data.retry_action === "string" ? data.retry_action.slice(0, 80) : null, retry_to_carrier: typeof data.retry_to_carrier === "string" ? data.retry_to_carrier.slice(0, 80) : null } : {}), // REFUND-RETRY-1018
      ...(event.startsWith("klarna_") ? { klarna_field: data.klarna_field, screen: data.screen, decline_ab: data.decline_ab, checkout_session_id: data.checkout_session_id, klarna_result: data.klarna_result, shown: data.shown, cap: data.cap, klarna_categories: data.klarna_categories, klarna_category: data.klarna_category, klarna_show_form: data.klarna_show_form, klarna_approved: data.klarna_approved, klarna_load: data.klarna_load, klarna_reason: data.klarna_reason, klarna_finalize_required: data.klarna_finalize_required, klarna_error: data.klarna_error } : {}), // KLARNA-FUNNEL-1017 // KLARNA-CAT-1017 // KLARNA-LOG-1017
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(URL_, new Blob([body], { type: "text/plain" }))) return;
    fetch(URL_, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  } catch {
    /* never affects checkout */
  }
}
