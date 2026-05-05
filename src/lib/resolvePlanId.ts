import { fetchCarrierView } from "@/services/apiWrapper";

export interface ResolvedPlans {
  rangePlanId?: string;
  rangeCarrierId?: number;
  rangeMin?: number;
  rangeMax?: number;
  fixedPlans: Array<{ amount: number; planId: string; carrierId?: number; name?: string }>;
}

/**
 * Loads carrier_plans / fixed_plans from carriers/view/{slug} and returns a
 * normalized lookup that lets callers always send a `planId` to /checkout.
 *  - rangePlanId: used when the user enters a custom amount (carrier_plans.rangePlan)
 *  - fixedPlans:  used when the user selects/enters a fixed plan amount
 */
export async function loadResolvedPlans(slug: string): Promise<ResolvedPlans> {
  const data = await fetchCarrierView(slug);
  const out: ResolvedPlans = { fixedPlans: [] };

  const cp = data.carrier_plans as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const rootFp = (data as Record<string, unknown>).fixed_plans;
  const nestedFp = cp && !Array.isArray(cp) ? (cp as Record<string, unknown>).fixed_plans : undefined;
  const fp = (rootFp ?? nestedFp) as
    | Array<Record<string, unknown>>
    | { rangePlan?: boolean | string; plans?: Array<Record<string, unknown>>; [k: string]: unknown }
    | undefined;

  // Range plan (custom amount input)
  if (cp && !Array.isArray(cp)) {
    const rp = cp.rangePlan;
    if (rp === true || (typeof rp === "string" && rp !== "")) {
      const carrier = cp.carrier as Record<string, unknown> | undefined;
      out.rangeMin = Number(carrier?.rangeMin ?? 5);
      out.rangeMax = Number(carrier?.rangeMax ?? 300);
      if (typeof rp === "string" && rp !== "") {
        out.rangePlanId = rp;
      } else if (carrier?.rangePlan) {
        out.rangePlanId = String(carrier.rangePlan);
      }
      const rcRaw = carrier?.id ?? carrier?.ID;
      const rcNum = typeof rcRaw === "number" ? rcRaw : rcRaw != null ? Number(rcRaw) : NaN;
      if (Number.isFinite(rcNum)) out.rangeCarrierId = rcNum;
    }
  }

  // Fixed plans (root array, nested object with .plans, or carrier_plans fallback)
  const collectPlans = (arr: Array<Record<string, unknown>>) => {
    for (const p of arr) {
      const planId = String(p.plan_id || p.planId || p.id || p.ID || "");
      const amount = Number(p.amount ?? p.price ?? 0);
      if (!planId || amount <= 0) continue;
      const carrierField = p.carrier;
      const carrierId =
        typeof carrierField === "number"
          ? carrierField
          : typeof carrierField === "string" && carrierField !== ""
          ? Number(carrierField)
          : undefined;
      out.fixedPlans.push({
        amount,
        planId,
        carrierId: Number.isFinite(carrierId as number) ? (carrierId as number) : undefined,
        name: typeof p.name === "string" ? (p.name as string) : typeof p.description === "string" ? (p.description as string) : undefined,
      });
    }
  };

  if (Array.isArray(fp)) collectPlans(fp);
  else if (fp && Array.isArray(fp.plans)) collectPlans(fp.plans);
  else if (Array.isArray(cp)) collectPlans(cp as Array<Record<string, unknown>>);
  else if (cp && Array.isArray((cp as Record<string, unknown>).plans)) {
    collectPlans((cp as Record<string, unknown>).plans as Array<Record<string, unknown>>);
  }

  return out;
}

/** Find the best planId/carrierId for a given amount. Falls back to range plan. */
export function pickPlanForAmount(resolved: ResolvedPlans, amount: number): { planId?: string; carrierId?: number; name?: string } {
  const exact = resolved.fixedPlans.find((p) => p.amount === amount);
  if (exact) return { planId: exact.planId, carrierId: exact.carrierId, name: exact.name };
  if (resolved.rangePlanId) return { planId: resolved.rangePlanId, carrierId: resolved.rangeCarrierId };
  return {};
}
