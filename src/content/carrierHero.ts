// TOP4-T1-1009 (Oct 9 2026): first screen in the words people search for T-Mobile, AT&T, Simple Mobile and Verizon (EN + ES),
// plus the customer-facing carrier names (display only). Used by the runtime pages AND by vite.config.ts (prerendered raw
// HTML), so the raw H1 / subline always equal the rendered ones. Copy only: never changes carrier_name, slugs, carrier or
// plan IDs, the DB, receipts or the checkout payload.
// Relative imports only (vite.config.ts loads this file; the "@/" alias is not available there).
import { weAcceptLine, payWith, CARD_BRANDS } from "./paymentMethods";
import { isVerizonSlug, VZ_NOTE } from "../lib/vzPrepaid"; // VZ-PREPAID-GUARD-1017

export type HeroLang = "en" | "es";

/** H1 per carrier. Keys = DynamicCarrier carrierSlug; SLUG_ALIAS maps the prerender route slugs. */
const HERO_H1: Record<string, { en: string; es: string }> = {
  tmobile: { en: "T-Mobile Prepaid Bill Pay & Refill", es: "Pago de factura y recarga de T-Mobile Prepago" },
  "topup-at": { en: "Pay Your AT&T Prepaid Bill Online", es: "Pago de factura y recarga de AT&T Prepago" }, // ATT-BILLPAY-H1-1024
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

// TOP4-T2A-1009: customer-facing carrier name per slug, for the "active line" note under the number field and the
// "What if my payment doesn't go through?" FAQ (carrier pages, /go landers, pay-bill guides). No refund-timing promise, no fee amount. // SIMPLE-PUSH-1023
const TOP4_NAMES: Record<string, { en: string; es: string }> = {
  tmobile: { en: "T-Mobile Prepaid", es: "T-Mobile Prepago" },
  "topup-at": { en: "AT&T Prepaid", es: "AT&T Prepago" },
  s1: { en: "Simple Mobile", es: "Simple Mobile" },
  verizon: { en: "Verizon Prepaid", es: "Verizon Prepago" },
};

/** "T-Mobile Prepaid" / "T-Mobile Prepago" for the 4 carriers, else null. */
export const top4Name = (slug: string, lang: HeroLang): string | null => {
  const n = TOP4_NAMES[SLUG_ALIAS[slug] || slug];
  return n ? n[lang] : null;
};

/** Small grey line under the phone-number field (4 carriers only). */
export const activeLineNote = (slug: string, lang: HeroLang): string | null => {
  if (isVerizonSlug(slug)) return VZ_NOTE[lang]; // VZ-PREPAID-GUARD-1017
  const c = top4Name(slug, lang);
  if (!c) return null;
  return lang === "es" ? `Use el número de 10 dígitos de una línea activa de ${c}.` : `Use the 10-digit number of an active ${c} line.`;
};

/** FAQ item (visible text = FAQPage JSON-LD wherever the page emits one). 4 carriers only. */
export const refundFaq = (slug: string, lang: HeroLang): { q: string; a: string } | null => {
  const c = top4Name(slug, lang);
  if (!c) return null;
  return lang === "es"
    ? {
        q: "¿Qué pasa si mi pago no se completa?", // SIMPLE-PUSH-1023
        a: `Si ${c} no puede aplicar el pago, por ejemplo cuando el número no es una línea activa de ${c} o se eligió otra compañía, el pago no se completa. Si su banco retuvo dinero, lo libera en 1 a 2 días. Revise el número y la compañía, y vuelva a intentarlo. Si todavía necesita ayuda, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido.`, // SIMPLE-PUSH-1023 // QA-1023-CUAL
      }
    : {
        q: "What if my payment doesn't go through?", // SIMPLE-PUSH-1023
        a: `If ${c} can't apply the payment, for example when the number is not an active ${c} line or the wrong carrier was picked, the payment does not go through. Any hold on your card is released by your bank. Check the number and the carrier, then try again. If you still need help, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID.`, // SIMPLE-PUSH-1023
      };
};

// TOP4-T3-1009: Spanish FAQ set for the 4 carriers' Spanish pages (same 6 questions and answers as /es/go/{carrier}),
// with the Spanish display names (T-Mobile Prepago, AT&T Prepago, Simple Mobile, Verizon Prepago). Never "cualquier".
/** 6 Spanish FAQ items for the 4 carriers, else []. */
export const esCarrierFaqs = (slug: string): Array<{ q: string; a: string }> => {
  const c = top4Name(slug, "es");
  if (!c) return [];
  return [
    {
      q: `¿Puedo pagar mi factura de ${c} sin cuenta?`,
      a: `Sí. No necesita cuenta ni iniciar sesión. Escriba el número de teléfono de ${c}, elija el monto o plan y pague como invitado.`,
    },
    {
      q: `¿Puedo pagar la línea de ${c} de otra persona?`,
      a: `Sí. Escriba el número de ${c} de esa persona, elija el monto o plan y pague. La recarga llega a esa línea.`,
    },
    {
      q: `¿Solo necesito el número de teléfono de ${c}?`,
      a: `Sí. Escriba el número de 10 dígitos de la línea de ${c} que quiere recargar. Luego elija el monto o plan y pague.`,
    },
    {
      q: `¿Tengo que llamar a ${c} para pagar?`,
      a: "No. Pague en línea en esta página con el número de teléfono. No necesita llamar.",
    },
    {
      q: "¿Cómo puedo pagar?",
      a: payWith("es", `Con tarjeta (${CARD_BRANDS})`) + ". Apple Pay aparece en equipos Apple compatibles. El cargo por servicio se muestra antes de pagar.",
    },
    {
      q: `¿Cuánto tarda la recarga de ${c}?`,
      a: "La mayoría termina en unos minutos. Algunas pueden tardar hasta 30 minutos.",
    },
  ];
};

// TOP4-T4-1009: 4 FAQs in the words people search / ask in help chat (EN + ES), 4 carriers only. Visible text = JSON-LD
// wherever the page emits FAQPage. Help label = the live Help button ("Help" / "Ayuda"). No fee amount, no refund promise.
/** [guest, don't know amount, paid but not working, wrong number] for the 4 carriers, else []. */
export const searchFaqs = (slug: string, lang: HeroLang): Array<{ q: string; a: string }> => {
  const c = top4Name(slug, lang);
  if (!c) return [];
  return lang === "es"
    ? [
        {
          q: `¿Puedo pagar la factura de ${c} como invitado, solo con el número de teléfono?`,
          a: `Sí. Ingrese el número de teléfono de 10 dígitos de ${c}, elija el monto o el plan y pague. No necesita cuenta ni iniciar sesión, y puede pagar la línea de otra persona.`,
        },
        {
          q: "¿Qué hago si no sé cuánto debo?",
          a: `CellPay no muestra el saldo de ${c}. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de ${c}, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar.`,
        },
        {
          q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?",
          a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido.",
        },
        {
          q: "Pagué a un número equivocado. ¿Me pueden devolver el dinero?",
          a: "Todos los pagos en CellPay son finales, incluso una recarga enviada a un número equivocado. Revise bien el número antes de pagar.",
        },
      ]
    : [
        {
          q: `Can I pay my ${c} bill as a guest, with just the phone number?`,
          a: `Yes. Enter the 10-digit ${c} phone number, pick your amount or plan, and pay. No login or account is needed, and you can pay for someone else's line.`,
        },
        {
          q: "What if I don't know how much I owe?",
          a: `CellPay doesn't show your ${c} balance. Check the amount due in your ${c} app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay.`,
        },
        {
          q: "I paid but my phone still isn't working. What should I do?",
          a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID.",
        },
        {
          q: "I paid the wrong number. Can I get a refund?",
          a: "All payments through CellPay are final, including a refill sent to a wrong number. Please check the number carefully before you pay.",
        },
      ];
};

/** Trust row on the Verizon pay page (Verizon.tsx and its prerendered first screen). Methods from the shared list. */
export const verizonTrustLine = (lang: HeroLang): string =>
  lang === "es"
    ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar. El Pago Automático está desactivado a menos que usted lo marque o llegue desde un enlace de Pago Automático. Cargo por servicio mostrado antes de pagar. " + weAcceptLine("es") // PLAN-BLOCK-CLEANUP-1017
    : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout. Auto Pay stays off unless you tick it, or you came from an Auto Pay link. Service fee shown before you pay. " + weAcceptLine("en");

// USC-FLEXI-1025: keep the note export without displaying a migration banner.
export const usCellularNote = (_slug: string, _lang: HeroLang): string | null => null; // USC-FLEXI-1025
