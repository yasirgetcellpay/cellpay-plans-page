// MONTHLY-BILL-COPY-1011: shared translation table with the Metro / Boost / Cricket wording merged in. Everything else is t(lang).
import { t, type Language, type Translations } from "@/lib/i18n";
import { isBillSlug, isBillName, BILL_TR } from "@/content/billWording";

/** True for Metro, Boost, Cricket by catalog slug or by carrier name. */
export const isBillCarrier = (slug?: string | null, name?: string | null): boolean => isBillSlug(slug) || isBillName(name);

/** t(lang), with the plain-bill wording merged in when the carrier is Metro, Boost or Cricket. */
export const billTr = (lang: Language, slug?: string | null, name?: string | null): Translations => {
  const base = t(lang);
  return isBillCarrier(slug, name) ? { ...base, ...BILL_TR[lang === "es" ? "es" : "en"] } : base;
};
