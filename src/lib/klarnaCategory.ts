// KLARNA-CAT-1017: session-offered categories and US locale, without SDK dependencies.
export function klarnaCategoryIds(sessionData: unknown): string[] { // KLARNA-CAT-1017
  if (!sessionData || typeof sessionData !== "object" || !("payment_method_categories" in sessionData)) return []; // KLARNA-CAT-1017
  const categories = sessionData.payment_method_categories; // KLARNA-CAT-1017
  if (!Array.isArray(categories)) return []; // KLARNA-CAT-1017
  return categories.flatMap((item: unknown) => { // KLARNA-CAT-1017
    if (!item || typeof item !== "object" || !("identifier" in item)) return []; // KLARNA-CAT-1017
    return typeof item.identifier === "string" && /^[a-z_]{1,30}$/.test(item.identifier) ? [item.identifier] : []; // KLARNA-CAT-1017
  }).slice(0, 5); // KLARNA-CAT-1017
} // KLARNA-CAT-1017
export function pickKlarnaCategory(ids: string[]): string { // KLARNA-CAT-1017
  return ids.includes("pay_over_time") ? "pay_over_time" : ids.includes("pay_later") ? "pay_later" : ids[0] || "pay_over_time"; // KLARNA-CAT-1017
} // KLARNA-CAT-1017
export function klarnaLocale(lang: string): "en-US" | "es-US" { // KLARNA-CAT-1017
  return lang === "es" ? "es-US" : "en-US"; // KLARNA-CAT-1017
} // KLARNA-CAT-1017