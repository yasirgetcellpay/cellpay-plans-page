import { withTimeout } from "@/lib/refillPrevent"; // ULTRA-BPATH-FIX-1029
import type { UltraMdnPlan, UltraMdnResult } from "@/services/apiWrapper"; // ULTRA-BPATH-FIX-1029
import type { UltraMdnCtx } from "@/lib/checkoutResume"; // ULTRA-BPATH-FIX-1029
export const ULTRA_MDN_LOOKUP_MS = 8000; // ULTRA-BPATH-FIX-1029
export const ultraVerifyText = (lang: string) => lang === "es" ? "No pudimos verificar los planes de este número Ultra. Revisa el número e inténtalo de nuevo." : "We couldn't verify the plans for this Ultra number. Please check the number and try again."; // ULTRA-BPATH-FIX-1029
export const ultraCheckingText = (lang: string) => lang === "es" ? "Verificando tu plan Ultra…" : "Checking your Ultra plan…"; // ULTRA-BPATH-FIX-1029
export const ultraLookup = (lookup: Promise<UltraMdnResult>) => withTimeout<UltraMdnResult>(lookup, ULTRA_MDN_LOOKUP_MS, { ok: false, status: 408 }); // ULTRA-BPATH-FIX-1029
export function ultraSelection(plan: UltraMdnPlan, mdn: string, amount: number): { amount: number; ultraMdn: UltraMdnCtx } | null { // ULTRA-BPATH-FIX-1029
  if (!/^\d{10}$/.test(mdn) || !plan.barcode.trim() || !plan.planId || !Number.isFinite(amount) || amount <= 0) return null; // ULTRA-BPATH-FIX-1029
  if (plan.kind === "fixed" ? amount !== plan.amount : plan.rangeMin === undefined || plan.rangeMax === undefined || amount < plan.rangeMin || amount > plan.rangeMax) return null; // ULTRA-BPATH-FIX-1029
  return { amount, ultraMdn: { mdn, barcode: plan.barcode, planId: plan.planId, carrierId: plan.carrierId, kind: plan.kind, rangeMin: plan.rangeMin, rangeMax: plan.rangeMax, ...(plan.kind === "fixed" ? { amount } : {}) } }; // ULTRA-BPATH-FIX-1029
} // ULTRA-BPATH-FIX-1029
export function ultraChargeVerified(ctx: UltraMdnCtx | null, payload: Record<string, unknown>): boolean { // ULTRA-BPATH-FIX-1029
  if (payload.carrier_slug !== "ultra-mobile" && Number(payload.carrierId) !== 25) return true; // ULTRA-BPATH-FIX-1029
  let mdn = String(payload.phone_number ?? "").replace(/\D/g, ""); while (mdn.length > 10 && mdn.startsWith("1")) mdn = mdn.slice(1); // ULTRA-BPATH-FIX-1029
  return !!ctx && mdn === ctx.mdn && String(payload.plan_id ?? payload.planId ?? "") === ctx.planId && !!ultraSelection({ ...ctx, name: undefined }, mdn, Number(payload.amount)); // ULTRA-BPATH-FIX-1029
} // ULTRA-BPATH-FIX-1029