// SIMPLE-SPEC-1-1009: Simple Mobile answer page text for /s1.html and /es/s1.html (EN + ES).
// Used by src/pages/DynamicCarrier.tsx (title, answer, plan display names, FAQ, links) AND by vite.config.ts (raw HTML: title/meta,
// static answer + plan list + FAQ block, FAQPage + BreadcrumbList JSON-LD), so the raw HTML and the rendered page say the same thing.
// Relative imports only (vite.config.ts loads this file). No fee amounts, no refund promise; payment list = PAYCOPY shared list.
import { methodsLong, joinMethods } from "./paymentMethods";
import { refundFaq } from "./carrierHero";

export type SimpleLang = "en" | "es";

export const SIMPLE_META: Record<SimpleLang, { title: string; description: string }> = {
  en: {
    title: "Simple Mobile Bill Pay & Refill — Pay Online, No Login | CellPay",
    description: `Pay your Simple Mobile bill or refill online as a guest. Enter the 10-digit number, pick your plan, pay by ${joinMethods(["card", "Apple Pay", "Google Pay"], "en", "or")}. Fee shown before you pay.`,
  },
  es: {
    title: "Pagar Simple Mobile en Línea — Factura y Recarga sin Cuenta | CellPay",
    description: "Pague su factura o recarga de Simple Mobile en línea, sin cuenta. Escriba el número de 10 dígitos, elija su plan y pague. Verá el cargo antes de pagar.",
  },
};

/** 2-sentence answer under the plan buttons. */
export const SIMPLE_ANSWER: Record<SimpleLang, string> = {
  en: "To pay a Simple Mobile bill on CellPay, enter the 10-digit Simple Mobile number, tap your plan and pay. You don't need a Simple Mobile login or a CellPay account, and you can pay for someone else's line.",
  es: "Para pagar Simple Mobile en CellPay, escriba el número de Simple Mobile de 10 dígitos, toque su plan y pague. No necesita usuario de Simple Mobile ni cuenta de CellPay, y puede pagar la línea de otra persona.",
};

export const SIMPLE_FAQ_TITLE: Record<SimpleLang, string> = {
  en: "Simple Mobile bill pay: questions",
  es: "Pago de Simple Mobile: preguntas frecuentes",
};

/** The 8 FAQs (Q7 = the T2-A refund FAQ, same text as the other top-4 pages). Visible text = FAQPage JSON-LD. */
export const simpleFaqs = (lang: SimpleLang): Array<{ q: string; a: string }> => {
  const refund = refundFaq("s1", lang)!;
  return lang === "es"
    ? [
        { q: "¿Cómo pago mi factura de Simple Mobile en línea sin iniciar sesión?", a: "Escriba el número de Simple Mobile de 10 dígitos en esta página, toque su plan y pague. No necesita usuario de Simple Mobile ni cuenta de CellPay." },
        { q: "¿Puedo pagar como invitado?", a: "Sí. Todos los pagos en CellPay son como invitado. Solo necesita el número de teléfono y un método de pago." },
        { q: "¿Puedo pagar el teléfono Simple Mobile de otra persona?", a: "Sí. Escriba su número de Simple Mobile. No necesita su cuenta ni su PIN." },
        { q: "¿Puedo pagar Simple Mobile solo con el número de teléfono?", a: "Sí. Solo necesitamos el número de 10 dígitos para enviar la recarga a esa línea." },
        { q: "¿Cuánto tarda la recarga?", a: "La mayoría de los pagos se acreditan en pocos minutos y pueden tardar hasta 30 minutos. Si el teléfono no tiene servicio después, reinícielo." },
        { q: "¿Cómo puedo pagar?", a: methodsLong("es") },
        refund,
        { q: "¿Puedo activar Auto Pago?", a: "Sí. Es opcional al pagar y nunca está marcado de antemano. Puede cancelarlo cuando quiera." },
      ]
    : [
        { q: "How do I pay my Simple Mobile bill online without logging in?", a: "Enter the 10-digit Simple Mobile number on this page, tap your plan and pay. No Simple Mobile login or CellPay account is needed." },
        { q: "Can I pay as a guest?", a: "Yes. Every payment on CellPay is a guest payment. You only need the phone number and a payment method." },
        { q: "Can I pay someone else's Simple Mobile phone?", a: "Yes. Enter their Simple Mobile number. You don't need their account or PIN." },
        { q: "Can I pay my Simple Mobile bill with just the phone number?", a: "Yes. The 10-digit number is all we need to send the refill to that line." },
        { q: "How fast does the refill post?", a: "Most payments post within a few minutes, and it can take up to 30 minutes. If the phone has no service after that, restart it." },
        { q: "What payment methods can I use?", a: methodsLong("en") },
        refund,
        { q: "Can I turn on Auto Pay?", a: "Yes, it's optional at checkout and never pre-checked. You can cancel any time." },
      ];
};

/** Guide link under the FAQ + language switch. */
export const SIMPLE_LINKS: Record<SimpleLang, { guide: [string, string]; other: [string, string] }> = {
  en: { guide: ["/how-to-pay/simple-mobile", "Step-by-step: How to pay your Simple Mobile bill"], other: ["/es/s1.html", "En español"] },
  es: { guide: ["/es/como-pagar/simple-mobile", "Paso a paso: Cómo pagar su factura de Simple Mobile"], other: ["/s1.html", "In English"] },
};

// Plan buttons, display only: the 3-month SKU ("Simple UN ILD RTR $150 3-Month Plan") gets a customer name and is shown last;
// "MOST POPULAR" stays on $40. Prices, plan ids and what checkout receives are unchanged (checkout matches the plan by amount).
// The catalog text only says "UN ILD", not "international", so the name doesn't promise international calling (spec fallback).
const SIMPLE_3M = /\b3[- ]?Month\b/i;
const SIMPLE_3M_NAME: Record<SimpleLang, string> = { en: "3-month Unlimited plan", es: "Plan Ilimitado de 3 meses" };
export const simpleGridPlans = <P extends { price: string; highlight: string }>(plans: P[], lang: SimpleLang): { plans: P[]; popular: number } => {
  const ordered = [...plans.filter((p) => !SIMPLE_3M.test(p.highlight)), ...plans.filter((p) => SIMPLE_3M.test(p.highlight))];
  const shown = ordered.map((p) => (SIMPLE_3M.test(p.highlight) ? { ...p, highlight: SIMPLE_3M_NAME[lang] } : p));
  const i40 = shown.findIndex((p) => p.price === "$40");
  return { plans: shown, popular: i40 >= 0 ? i40 : Math.min(shown.length - 1, Math.floor(shown.length / 2)) };
};

// Raw HTML only (crawlers / before the app loads): the plan list as shown on Oct 9 2026, same order and names as the buttons.
// The live page replaces it with the live catalog on load. If the catalog changes, update this list (display text only).
const SIMPLE_PLAN_SNAPSHOT: Array<[string, string]> = [
  ["$60", "Unlimited Talk, Text, Unlimited 5G Ultra Wideband"],
  ["$50", "Unlimited Talk, Text, Unlimited high-speed data"],
  ["$40", "Unlimited Talk, Text, 30 GB high-speed"],
  ["$30", "Unlimited Talk, Text, 20 GB of high-speed"],
  ["$25", "Unlimited Talk, Text, 15 GB of high-speed"],
  ["$150", "Simple UN ILD RTR $150 3-Month Plan"],
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Static block for the raw HTML of /s1.html and /es/s1.html (below the first screen; React replaces #root on load). */
export const simpleStaticBlock = (lang: SimpleLang): string => {
  const { plans } = simpleGridPlans(SIMPLE_PLAN_SNAPSHOT.map(([price, highlight]) => ({ price, highlight })), lang);
  const L = SIMPLE_LINKS[lang];
  return (
    `<section class="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-simple-static="1">` +
    `<p class="text-sm text-foreground leading-relaxed">${esc(SIMPLE_ANSWER[lang])}</p>` +
    `<h2 class="text-xl font-extrabold mt-6 mb-3">${lang === "es" ? "Planes de Simple Mobile" : "Simple Mobile plans"}</h2>` +
    `<ul class="list-disc pl-6 text-sm space-y-1">` + plans.map((p) => `<li>${esc(p.price)} — ${esc(p.highlight)}</li>`).join("") + `</ul>` +
    `<h2 class="text-2xl font-extrabold text-foreground mt-8 mb-4">${esc(SIMPLE_FAQ_TITLE[lang])}</h2>` +
    simpleFaqs(lang).map((f) => `<div class="mb-4"><h3 class="font-bold">${esc(f.q)}</h3><p class="text-sm text-muted-foreground mt-1">${esc(f.a)}</p></div>`).join("") +
    `<p class="text-sm mt-6"><a href="${L.guide[0]}" class="underline">${esc(L.guide[1])}</a></p>` +
    `<p class="text-sm mt-2"><a href="${L.other[0]}" class="underline" hreflang="${lang === "es" ? "en" : "es"}">${esc(L.other[1])}</a></p>` +
    `</section>`
  );
};

/** FAQPage + BreadcrumbList JSON-LD (one @graph script). No Product/Offer price markup. */
export const simpleJsonLd = (lang: SimpleLang): string => {
  const page = lang === "es" ? "https://www.cellpay.us/es/s1.html" : "https://www.cellpay.us/s1.html";
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": page + "#faq",
        inLanguage: lang,
        mainEntity: simpleFaqs(lang).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        // BRAND-ORG-1009: WebPage node (about = Simple Mobile, publisher = the one Organization node of the site).
        "@type": "WebPage",
        "@id": page + "#webpage",
        url: page,
        name: SIMPLE_META[lang].title.replace(/ \| CellPay$/, ""),
        about: { "@type": "Thing", name: "Simple Mobile" },
        publisher: { "@id": "https://www.cellpay.us/#organization" },
        inLanguage: lang === "es" ? "es-US" : "en-US",
        dateModified: "2026-10-09",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: lang === "es" ? "Inicio" : "Home", item: lang === "es" ? "https://www.cellpay.us/es" : "https://www.cellpay.us/" },
          { "@type": "ListItem", position: 2, name: "Simple Mobile", item: page },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");
};
