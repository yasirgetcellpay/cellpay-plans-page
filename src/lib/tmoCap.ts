// TMO-CAP-200-1022: T-Mobile refills capped at $200 (amount before fees). Other carriers untouched.
export const TMO_CAP = 200; // TMO-CAP-200-1022
export const isTmoCap = (slug: string, plan?: string): boolean => { // TMO-CAP-200-1022
  const s = String(slug ?? "").trim().toLowerCase();
  return s === "tmobile" || s === "tmobile-flexi" || String(plan ?? "").trim() === "238888";
};
export const tmoCapMax = (slug: string, apiMax: number): number => (isTmoCap(slug) ? Math.min(apiMax, TMO_CAP) : apiMax); // TMO-CAP-200-1022
export const tmoCapBlocked = (slug: string, amount: number, plan?: string): boolean => isTmoCap(slug, plan) && Number.isFinite(amount) && amount > TMO_CAP; // TMO-CAP-200-1022
export const tmoCapMsg = (lang: string): string => // TMO-CAP-200-1022
  lang === "es" ? "Las recargas de T-Mobile tienen un límite de $200 por ahora. Ingrese $200 o menos." : "T-Mobile refills are limited to $200 right now. Please enter $200 or less.";
