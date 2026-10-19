// METRO-FEECOPY-1019: approved fee wording for Metro pages (EN + ES) and Spanish Boost pages. Wording only; no fee change.
// Keep in sync with FEE1019 in vite.config.ts.
export const FEE1019_EN = "Service fee shown before you pay";
export const FEE1019_ES = "La tarifa de servicio se muestra antes de pagar";
const METRO_SLUGS = new Set(["metropcs", "metro-pcs", "metro"]);
const BOOST_SLUGS = new Set(["boost", "bmobile", "boost-mobile"]);
export const feeCopy1019Applies = (slug: string | null | undefined, lang: string | null | undefined): boolean => {
  const s = String(slug ?? "").toLowerCase();
  return METRO_SLUGS.has(s) || (lang === "es" && BOOST_SLUGS.has(s));
};
/** Returns text unchanged unless the page is Metro (EN/ES) or Spanish Boost. */
export const feeCopy1019 = (slug: string | null | undefined, lang: string | null | undefined, text: string): string => {
  if (!text || !feeCopy1019Applies(slug, lang)) return text;
  return text
    .split("Low service fee shown before you pay").join(FEE1019_EN)
    .split("Cargo por servicio bajo, mostrado antes de pagar").join(FEE1019_ES)
    .split("Cargo por servicio mostrado antes de pagar").join(FEE1019_ES);
};
