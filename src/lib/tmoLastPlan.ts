// REFILL-PREVENT-TMO-1026: T-Mobile last-plan helpers. Every function fails open (null / allow).
import { TMO_LAST_PLAN, TMO_SOFT_CONFIRM } from "./refillPreventFlags";
import { ultraRead } from "./ultraSmart";
import { withTimeout } from "./refillPrevent";

export type TmoLastPlan = { plan_id: string; amount: number };
export type TmoPlan = { plan_id: string; amount: number };
export const TMO_SLUG = "tmobile";

/** null = unknown/failed (behave as today); {} = no history; else hit. Bounded to 2 s. */
export async function readTmoLastPlan(phone: string, fetcher: typeof fetch = fetch, ms = 2000): Promise<TmoLastPlan | Record<string, never> | null> {
  try {
    if (!TMO_LAST_PLAN || !/^\d{10}$/.test(phone)) return null;
    const v = await withTimeout(ultraRead("tmo-last-plan", `?phone=${encodeURIComponent(phone)}`, fetcher), ms, null);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    if (Object.keys(v).length === 0) return {};
    const o = v as Record<string, unknown>;
    return typeof o.plan_id === "string" && o.plan_id && typeof o.amount === "number" && o.amount > 0 ? { plan_id: o.plan_id, amount: o.amount } : null;
  } catch { return null; }
}

/** Plan to pre-select: only when the last plan_id is in the current T-Mobile list. */
export function matchTmoPlan(last: TmoLastPlan | null, plans: TmoPlan[]): TmoPlan | null {
  try {
    if (!last) return null;
    const same = plans.filter((p) => String(p.plan_id) === last.plan_id);
    return same.find((p) => Number(p.amount) === last.amount) ?? (same.length ? { plan_id: last.plan_id, amount: last.amount } : null);
  } catch { return null; }
}

/** true = show the soft confirm (once per phone; after Continue the same phone passes). */
export function tmoNeedsConfirm(slug: string, last: TmoLastPlan | null, amount: number, phone: string, continuedFor: string | null): boolean {
  try {
    if (!TMO_SOFT_CONFIRM || slug !== TMO_SLUG || !last) return false;
    if (continuedFor === phone) return false;
    return Number(amount) !== last.amount;
  } catch { return false; }
}

export function tmoEvent(event: "last_plan_shown" | "last_plan_mismatch_confirm" | "tmo_retry_blocked", carrier: string, variant: string): void {
  try { const w = window as unknown as { dataLayer?: unknown[] }; (w.dataLayer = w.dataLayer || []).push({ event, carrier, variant }); } catch { /* ignore */ }
}

export const tmoText = (lang: string) => lang === "es"
  ? { badge: "Su último plan", confirm: "Es posible que este monto no coincida con su plan de T-Mobile. Elija el monto de su plan mensual actual, o continúe.", use: "Usar mi último plan", cont: "Continuar" }
  : { badge: "Your last plan", confirm: "This amount may not match your T-Mobile plan. Pick your current monthly plan amount, or continue.", use: "Use my last plan", cont: "Continue" };
