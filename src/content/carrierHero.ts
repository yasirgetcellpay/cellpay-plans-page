// TOP4-T1-1009 (Oct 9 2026): first screen in the words people search for T-Mobile, AT&T, Simple Mobile and Verizon (EN + ES),
// plus the customer-facing carrier names (display only). Used by the runtime pages AND by vite.config.ts (prerendered raw
// HTML), so the raw H1 / subline always equal the rendered ones. Copy only: never changes carrier_name, slugs, carrier or
// plan IDs, the DB, receipts or the checkout payload.
// Relative imports only (vite.config.ts loads this file; the "@/" alias is not available there).
import { weAcceptLine } from "./paymentMethods";

export type HeroLang = "en" | "es";

/** H1 per carrier. Keys = DynamicCarrier carrierSlug; SLUG_ALIAS maps the prerender route slugs. */
const HERO_H1: Record<string, { en: string; es: string }> = {
  tmobile: { en: "T-Mobile Prepaid Bill Pay & Refill", es: "Pago de factura y recarga de T-Mobile Prepago" },
  "topup-at": { en: "AT&T Prepaid Bill Pay & Refill", es: "Pago de factura y recarga de AT&T Prepago" },
  s1: { en: "Simple Mobile Bill Pay & Refill", es: "Pago de factura y recarga de Simple Mobile" },
  verizon: { en: "Verizon Prepaid Bill Pay & Refill", es: "Pago de factura y recarga de Verizon Prepago" },
};
const SLUG_ALIAS: Record<string, string> = { "tmobile-flexi": "tmobile", "verizon-wireless-flexi": "verizon" };

/** Subline under the H1 (same on all 4 carriers). */
export const HERO_SUBLINE: Record<HeroLang, string> = {
  en: "No login. Just the phone number. Pay for yourself or someone else.",
  es: "Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono. Pague por usted o por otra persona.",
};

/** H1 + subline for the 4 carriers' pages, or null for every other carrier (their first screen stays as it is). */
export const top4Hero = (slug: string, lang: HeroLang): { h1: string; sub: string } | null => {
  const h = HERO_H1[SLUG_ALIAS[slug] || slug];
  return h ? { h1: h[lang], sub: HERO_SUBLINE[lang] } : null;
};

/** Internal / API names -> customer-facing name (EN, ES) and the brand used in the trademark line. */
const DISPLAY_NAMES: Record<string, { en: string; es: string; brand: string }> = {
  "T-Mobile Flexi": { en: "T-Mobile Prepaid", es: "T-Mobile Prepago", brand: "T-Mobile" },
  "T-Mobile": { en: "T-Mobile Prepaid", es: "T-Mobile Prepago", brand: "T-Mobile" },
  "Verizon Wireless Flexi": { en: "Verizon Prepaid", es: "Verizon Prepago", brand: "Verizon" },
  "Verizon Wireless Prepaid": { en: "Verizon Prepaid", es: "Verizon Prepago", brand: "Verizon" },
};

/** Name shown in labels and headings ("Enter Your T-Mobile Prepaid Phone Number"). Other carriers unchanged. */
export const displayCarrierName = (name: string, lang: HeroLang = "en"): string => DISPLAY_NAMES[name]?.[lang] ?? name;

/** Brand for the footer trademark line ("T-Mobile®", "Verizon®"). Other carriers unchanged. */
export const trademarkCarrierName = (name: string): string => DISPLAY_NAMES[name]?.brand ?? name;

/** Trust row on the Verizon pay page (Verizon.tsx and its prerendered first screen). Methods from the shared list. */
export const verizonTrustLine = (lang: HeroLang): string =>
  lang === "es"
    ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar — nunca está marcado de antemano. Cargo por servicio mostrado antes de pagar. " + weAcceptLine("es")
    : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout — it is never pre-checked. Service fee shown before you pay. " + weAcceptLine("en");
