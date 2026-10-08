// PAYCOPY-1008 (Oct 8 2026): ONE customer-facing list of payment methods (EN + ES), built from src/config/paymentFlags.ts.
// Used by the runtime pages AND by vite.config.ts (prerendered raw HTML + JSON-LD), so page copy always matches checkout.
// PayPal is named only while PAYPAL_ENABLED is true; Pay by Bank only while PLAID_ENABLED is true. Flip a flag and the
// copy follows everywhere, with no other edit. Copy only: this file never changes checkout behavior.
// Relative import only (vite.config.ts loads this file through src/content/howToPay.ts; the "@/" alias is not available there).
import { PAYPAL_ENABLED, PLAID_ENABLED } from "../config/paymentFlags";

export type PayLang = "en" | "es";
export type PayListOpts = { first?: string; conj?: "and" | "or"; bankNote?: boolean; appleNote?: boolean };

export const CARD_BRANDS = "Visa, Mastercard, American Express, Discover";
/** True while PayPal is offered at checkout (for logos / wallet marks). */
export const PAYPAL_SHOWN: boolean = PAYPAL_ENABLED;
/** True while Pay by Bank is offered at checkout. */
export const PAY_BY_BANK_SHOWN: boolean = PLAID_ENABLED;

/** Methods after cards, in checkout order. */
const others = (lang: PayLang, o: PayListOpts = {}): string[] => [
  o.appleNote ? (lang === "es" ? "Apple Pay en dispositivos Apple compatibles" : "Apple Pay on supported Apple devices") : "Apple Pay",
  "Google Pay",
  ...(PAYPAL_ENABLED ? ["PayPal"] : []),
  "Klarna",
  "Cash App",
  ...(PLAID_ENABLED ? [lang === "es" && o.bankNote ? "Pay by Bank (pago desde su cuenta bancaria)" : "Pay by Bank"] : []),
];

/** "a, b, c and d" / "a, b, c y d" (no serial comma, same as the live copy). */
export const joinMethods = (items: string[], lang: PayLang, conj: "and" | "or"): string => {
  const word = lang === "es" ? (conj === "and" ? "y" : "o") : conj;
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
};

/** Generic list: optional first item (a card phrase), then the live methods. */
export const payList = (lang: PayLang, o: PayListOpts = {}): string =>
  joinMethods([...(o.first ? [o.first] : []), ...others(lang, o)], lang, o.conj ?? "or");

/** "Visa, Mastercard, American Express, Discover, Apple Pay, Google Pay, Klarna, Cash App and Pay by Bank" */
export const payBrands = (lang: PayLang, conj: "and" | "or" = "and", bankNote = false): string =>
  payList(lang, { first: CARD_BRANDS, conj, bankNote });

/** Carrier pages: "We accept Visa, ..., Cash App and Pay by Bank." / "Aceptamos ..., Cash App y Pay by Bank (pago desde su cuenta bancaria)." */
export const weAcceptLine = (lang: PayLang): string =>
  lang === "es" ? `Aceptamos ${payBrands("es", "and", true)}.` : `We accept ${payBrands("en")}.`;

/** "a card, Apple Pay, Google Pay, Klarna, Cash App or Pay by Bank" / "tarjeta, Apple Pay, Google Pay, Klarna, Cash App o Pay by Bank" */
export const payWith = (lang: PayLang, cardWord?: string): string =>
  payList(lang, { first: cardWord ?? (lang === "es" ? "tarjeta" : "a card") });

/** Without cards: "Apple Pay, Google Pay, Klarna, Cash App or Pay by Bank" */
export const payWallets = (lang: PayLang): string => payList(lang);

/** Long form: "Credit and debit cards (Visa, ...), Apple Pay on supported Apple devices, Google Pay, Klarna, Cash App and Pay by Bank." */
export const methodsLong = (lang: PayLang): string =>
  payList(lang, {
    first: lang === "es" ? `Tarjetas de crédito y débito (${CARD_BRANDS})` : `Credit and debit cards (${CARD_BRANDS})`,
    conj: "and",
    bankNote: true,
    appleNote: true,
  }) + ".";

/** Comma list, no conjunction (/go landers line under the wallet marks): "Visa, ..., Cash App, Pay by Bank" */
export const payBrandsComma = (): string => [CARD_BRANDS, ...others("en")].join(", ");
