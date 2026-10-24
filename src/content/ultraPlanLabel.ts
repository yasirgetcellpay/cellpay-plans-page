// ULTRA-MSG-1024: display only; never replace plan prices, amounts or API values.
export function ultraPlanLabel(carrierSlug: string, planId: unknown, backendLabel: string): string {
  return carrierSlug === "ultra-mobile" && String(planId) === "8279" ? "$24 · 8GB" : backendLabel;
}