// AEO-PAGES-1007: "how to pay" pages (SPEC-01 Straight Talk, SPEC-02 AT&T Prepaid, + ES pairs).
// Single source for the React page (src/pages/HowToPay.tsx) AND the static raw HTML + JSON-LD emitted by vite.config.ts,
// so visible FAQ text and FAQPage JSON-LD stay word for word identical. Relative imports only: vite.config.ts loads this file.
// PAYCOPY-1008: payment methods come from ./paymentMethods (follows src/config/paymentFlags.ts; PayPal only while enabled).
import { methodsLong, payWith, payWallets } from "./paymentMethods";
// TOP4-T2A-1009: "Why was my payment refunded?" FAQ for AT&T Prepaid / Simple Mobile / T-Mobile Prepaid (null for others).
import { refundFaq, searchFaqs } from "./carrierHero";
// No prices or fee amounts here: plan prices render live from the carrier catalog; the fee is shown at checkout.

export type HtpLang = "en" | "es";
export type HtpFaq = { q: string; a: string };
export type HtpPage = {
  key: "straight-talk" | "att-prepaid" | "simple-mobile" | "t-mobile-prepaid" | "verizon-prepaid" | "lyca-mobile" | "metro-pcs" | "boost-mobile" | "cricket" | "net10" | "h2o" | "ultra-mobile"; // AEO-10-H2O-1016: + H2O Wireless; // AEO-09-NET10-1015: + Net10 Wireless; // CRICKET-GUIDE-1014: + Cricket Wireless; SEO-CONTENT-1014: + Boost Mobile; AEO-07-METRO-1012: + Metro by T-Mobile; AEO-06-LYCA-1011: + Lyca Mobile; AEO-03-04-1008: + Simple Mobile, T-Mobile Prepaid; TOP4-T4-1009: + Verizon Prepaid // AEO-11-ULTRA-1017
  lang: HtpLang;
  path: string; // www path of this page
  enPath: string;
  esPath: string;
  carrierSlug: string; // fetchCarrierView slug
  carrierName: string;
  checkoutPath: string; // transactional carrier page
  title: string;
  description: string;
  h1: string;
  intro: string;
  steps: Array<{ name: string; text: string }>;
  need: string[];
  feeRows: Array<[string, string]>;
  feeNote: string;
  plansLabel: string;
  plansLoading: string;
  otherWays: string;
  someoneElseTitle: string;
  someoneElse: string;
  autoPayTitle: string;
  autoPay: string;
  faqs: HtpFaq[];
  disclaimer: string;
  updated: string;
  updatedIso: string; // AEO-03-04-1008: JSON-LD dateModified per page
  related: Array<[string, string]>;
  labels: { payNow: string; steps: string; need: string; fees: string; item: string; amount: string; other: string; faq: string; related: string; breadcrumbHowTo: string; tool: string; supply: string };
  // AI-ANSWERS-1014: amount answer pages (/how-to-pay/<carrier>/<amount>) only
  amount?: number;
  parentPath?: string;
  parentLabel?: string;
  methodsTitle?: string;
  methodsLine?: string;
  feeLine?: string;
};

const WWW = "https://www.cellpay.us";
const UPDATED_ISO = "2026-10-07";
const METHODS_EN = methodsLong("en");
const METHODS_ES = methodsLong("es");
const PAY_EN = payWith("en");
const PAY_ES = payWith("es");
// TOP4-T4-1009: FAQs in searchers' words for the 4 carriers (carrierHero.searchFaqs). The guest FAQ replaces the
// "without logging in" FAQ (same question); the other 3 go before the refund FAQ. Straight Talk keeps its FAQs.
const sfFirst = (slug: string, lang: HtpLang, fallback: HtpFaq): HtpFaq => searchFaqs(slug, lang)[0] ?? fallback;
const sfRest = (slug: string, lang: HtpLang): HtpFaq[] => searchFaqs(slug, lang).slice(1);

const LABELS_EN = { payNow: "", steps: "Steps", need: "What you need", fees: "Fees and totals", item: "Item", amount: "Amount", other: "", faq: "Frequently asked questions", related: "Related", breadcrumbHowTo: "How to pay", tool: payWith("en", "Card"), supply: "10-digit phone number" };
const LABELS_ES = { payNow: "", steps: "Pasos", need: "Lo que necesita", fees: "Cargos y totales", item: "Concepto", amount: "Monto", other: "", faq: "Preguntas frecuentes", related: "Relacionado", breadcrumbHowTo: "Cómo pagar", tool: payWith("es", "Tarjeta"), supply: "Número de teléfono de 10 dígitos" };

const en = (o: {
  key: HtpPage["key"]; name: string; slug: string; checkout: string; title: string; description: string; h1: string;
  step3: string; faq2?: HtpFaq; autoPayA: string; autoPayBody: string; related: Array<[string, string]>; an: string;
  updatedIso?: string; updatedText?: string; // AEO-03-04-1008: faq2 optional (SPEC-03/04 have 7 FAQs); per-page last-updated
  moreFaqs?: HtpFaq[]; // AEO-06-LYCA-1011: extra FAQs after the standard ones (before any refund FAQ)
  postA?: string; // SEO-CONTENT-1014: optional "how fast" answer (pay-wording carriers)
  intro?: string; // CRICKET-GUIDE-1014: optional answer-first intro override
  steps?: Array<{ name: string; text: string }>; // AEO-09-NET10-1015: optional steps override
}): HtpPage => ({
  key: o.key, lang: "en", path: `/how-to-pay/${o.key}`, enPath: `/how-to-pay/${o.key}`, esPath: `/es/como-pagar/${o.key}`,
  carrierSlug: o.slug, carrierName: o.name, checkoutPath: o.checkout, title: o.title, description: o.description, h1: o.h1,
  intro: o.intro ?? /* CRICKET-GUIDE-1014 */ `To pay your ${o.name} bill online without logging in, go to CellPay's ${o.name} page, enter the 10-digit ${o.name} phone number, pick your amount or plan, and pay with ${PAY_EN}. The service fee is shown before you pay, and most payments post within a few minutes (up to 30 minutes). CellPay is an independent payment service, not ${o.name}; you can also pay ${o.name} directly on its official site.`,
  steps: o.steps ?? /* // AEO-09-NET10-1015 */ [
    { name: "Open the page", text: `Go to the CellPay ${o.name} page (${o.checkout}).` },
    { name: "Enter the number", text: `Type the 10-digit ${o.name} phone number and check it.` },
    { name: "Pick the amount", text: o.step3 },
    { name: "Review the total", text: "The order summary shows the number, amount, any fee and the total." },
    { name: "Pay", text: `Pay with ${PAY_EN} and keep your confirmation.` },
  ],
  need: [`The 10-digit ${o.name} phone number`, "The amount or plan you want", `A payment method: ${PAY_EN}`],
  feeRows: [
    ["CellPay service fee", "Shown in the order summary before you pay"],
    [`${o.name} plans`, "Current plans and prices are listed below, loaded live from the CellPay catalog"],
    ["Taxes", "Taxes and fees are additional and vary by location."],
  ],
  feeNote: "Shown before you pay.",
  plansLabel: `Current ${o.name} plans on CellPay`,
  plansLoading: "Loading current plans…",
  otherWays: `You can also pay ${o.name} directly through its official website or app.`,
  someoneElseTitle: "Paying for someone else",
  someoneElse: `You only need their ${o.name} phone number. The charge goes on your payment method, not their account. Double-check the number: all CellPay payments are final.`,
  autoPayTitle: "Auto Pay",
  autoPay: o.autoPayBody,
  faqs: [
    sfFirst(o.slug, "en", { q: `Can I pay ${o.name} online without logging in?`, a: `Yes. On CellPay you enter the ${o.name} phone number, choose the amount or plan, and pay. You don't need ${o.an} ${o.name} login or a CellPay account. CellPay is an independent payment service, not ${o.name}.` }), // TOP4-T4-1009
    ...(o.faq2 ? [o.faq2] : []),
    { q: `How fast does ${o.key === "att-prepaid" ? "an" : "a"} ${o.name} payment through CellPay post?`, a: o.postA ?? /* SEO-CONTENT-1014 */ /* BATCH3-1014 */ "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through." },
    { q: `Is there a fee to pay ${o.name} on CellPay?`, a: "Yes, a service fee applies. The service fee is shown in the order summary before you pay, so you see the full total first. Taxes and fees can vary by location." },
    { q: "What payment methods can I use?", a: METHODS_EN },
    { q: `Can I pay someone else's ${o.name} phone?`, a: `Yes. You only need their ${o.name} phone number. The charge goes on your payment method, not their account. Double-check the number, because all CellPay payments are final: a payment sent to a wrong number can't be refunded or cancelled.` },
    { q: `Can I set up automatic ${o.name} payments?`, a: o.autoPayA },
    { q: `What do I need to pay my ${o.name} bill?`, a: `Only the 10-digit ${o.name} phone number, the amount or plan you want, and a payment method. You don't need a carrier login, a CellPay account or the account holder's password.` },
    ...sfRest(o.slug, "en"), // TOP4-T4-1009
    ...(o.moreFaqs ?? []), // AEO-06-LYCA-1011
    ...[refundFaq(o.slug, "en")].filter((f): f is HtpFaq => !!f), // TOP4-T2A-1009
  ],
  disclaimer: `CellPay is an independent payment service and is not affiliated with ${o.name}.`,
  updated: o.updatedText ?? "Last updated: October 7, 2026",
  updatedIso: o.updatedIso ?? UPDATED_ISO,
  related: o.related,
  labels: { ...LABELS_EN, payNow: `Pay ${o.name} now`, other: `Other ways to pay ${o.name}` },
});

const es = (o: {
  key: HtpPage["key"]; name: string; slug: string; checkout: string; title: string; description: string; h1: string;
  step3: string; faq2?: HtpFaq; autoPayA: string; autoPayBody: string; related: Array<[string, string]>;
  updatedIso?: string; updatedText?: string;
  introLead?: string; // TOP4-T4-1009: optional first clause of the intro
  moreFaqs?: HtpFaq[]; // AEO-06-LYCA-1011
  postA?: string; // SEO-CONTENT-1014
  intro?: string; // CRICKET-GUIDE-1014: optional answer-first intro override
  steps?: Array<{ name: string; text: string }>; // AEO-09-NET10-1015: optional steps override
}): HtpPage => ({
  key: o.key, lang: "es", path: `/es/como-pagar/${o.key}`, enPath: `/how-to-pay/${o.key}`, esPath: `/es/como-pagar/${o.key}`,
  carrierSlug: o.slug, carrierName: o.name, checkoutPath: o.checkout, title: o.title, description: o.description, h1: o.h1,
  intro: o.intro ?? /* CRICKET-GUIDE-1014 */ `${o.introLead ?? `Para pagar su factura de ${o.name} en línea sin iniciar sesión`}, vaya a la página de ${o.name} de CellPay, ingrese el número de teléfono de ${o.name} de 10 dígitos, elija el monto o el plan y pague con ${PAY_ES}. El cargo por servicio se muestra antes de pagar y la mayoría de los pagos se acreditan en pocos minutos (hasta 30 minutos). CellPay es un servicio de pago independiente, no ${o.name}; también puede pagar directamente en el sitio oficial de ${o.name}.`,
  steps: o.steps ?? /* // AEO-09-NET10-1015 */ [
    { name: "Abra la página", text: `Vaya a la página de ${o.name} de CellPay (${o.checkout}).` },
    { name: "Ingrese el número", text: `Escriba el número de teléfono de ${o.name} de 10 dígitos y verifíquelo.` },
    { name: "Elija el monto", text: o.step3 },
    { name: "Revise el total", text: "El resumen del pedido muestra el número, el monto, el cargo correspondiente y el total." },
    { name: "Pague", text: `Pague con ${PAY_ES} y guarde su confirmación.` },
  ],
  need: [`El número de teléfono de ${o.name} de 10 dígitos`, "El monto o el plan que desea", `Un método de pago: ${PAY_ES}`],
  feeRows: [
    ["Cargo por servicio de CellPay", "Se muestra en el resumen del pedido antes de pagar"],
    [`Planes de ${o.name}`, "Los planes y precios actuales aparecen abajo, cargados en vivo desde el catálogo de CellPay"],
    ["Impuestos", "Los impuestos y cargos son adicionales y varían según la ubicación."],
  ],
  feeNote: "Se muestra antes de pagar.",
  plansLabel: `Planes actuales de ${o.name} en CellPay`,
  plansLoading: "Cargando planes actuales…",
  otherWays: `También puede pagar ${o.name} directamente en su sitio web oficial o en su aplicación.`,
  someoneElseTitle: "Pagar por otra persona",
  someoneElse: `Solo necesita su número de teléfono de ${o.name}. El cargo se hace a su método de pago, no a la cuenta de esa persona. Verifique el número: todos los pagos en CellPay son definitivos.`,
  autoPayTitle: "Auto Pago",
  autoPay: o.autoPayBody,
  faqs: [
    sfFirst(o.slug, "es", { q: `¿Puedo pagar ${o.name} en línea sin iniciar sesión?`, a: `Sí. En CellPay ingresa el número de teléfono de ${o.name}, elige el monto o el plan y paga. No necesita una cuenta de ${o.name} ni una cuenta de CellPay. CellPay es un servicio de pago independiente, no ${o.name}.` }), // TOP4-T4-1009
    ...(o.faq2 ? [o.faq2] : []),
    { q: `¿Cuánto tarda en acreditarse un pago de ${o.name} hecho en CellPay?`, a: o.postA ?? /* SEO-CONTENT-1014 */ /* BATCH3-1014 */ "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción." },
    { q: `¿Hay un cargo por pagar ${o.name} en CellPay?`, a: "Sí, se aplica un cargo por servicio. El cargo por servicio se muestra en el resumen del pedido antes de pagar, así que ve el total completo primero. Los impuestos y cargos pueden variar según la ubicación." },
    { q: "¿Qué métodos de pago puedo usar?", a: METHODS_ES },
    { q: `¿Puedo pagar el teléfono ${o.name} de otra persona?`, a: `Sí. Solo necesita su número de teléfono de ${o.name}. El cargo se hace a su método de pago, no a la cuenta de esa persona. Verifique bien el número, porque todos los pagos en CellPay son definitivos: un pago enviado a un número equivocado no se puede reembolsar ni cancelar.` },
    { q: `¿Puedo programar pagos automáticos de ${o.name}?`, a: o.autoPayA },
    { q: `¿Qué necesito para pagar mi factura de ${o.name}?`, a: `Solo el número de teléfono de ${o.name} de 10 dígitos, el monto o el plan que desea y un método de pago. No necesita una cuenta del operador, una cuenta de CellPay ni la contraseña del titular de la cuenta.` },
    ...sfRest(o.slug, "es"), // TOP4-T4-1009
    ...(o.moreFaqs ?? []), // AEO-06-LYCA-1011
    ...[refundFaq(o.slug, "es")].filter((f): f is HtpFaq => !!f), // TOP4-T2A-1009
  ],
  disclaimer: `CellPay es un servicio de pago independiente y no está afiliado a ${o.name}.`,
  updated: o.updatedText ?? "Última actualización: 7 de octubre de 2026",
  updatedIso: o.updatedIso ?? UPDATED_ISO,
  related: o.related,
  labels: { ...LABELS_ES, payNow: `Pagar ${o.name} ahora`, other: `Otras formas de pagar ${o.name}` },
});

export const HOW_TO_PAY_PAGES: HtpPage[] = [
  en({
    key: "straight-talk", name: "Straight Talk", slug: "straight-talk", checkout: "/straight-talk.html", an: "a",
    title: "How to Pay Your Straight Talk Bill Online (No Login Needed) | CellPay",
    description: `Straight Talk pay bill online with no login: enter the number, pick a plan and pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your Straight Talk Bill Online (No Login Needed)",
    step3: "Choose a plan from the list on the CellPay page.",
    faq2: { q: "Can I refill Straight Talk without the Straight Talk app?", a: "Straight Talk offers its own refill options on its official website and app. On CellPay you can refill from any device with only the phone number." },
    autoPayA: "If CellPay Auto Pay is offered at checkout, you can turn it on there; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "If CellPay Auto Pay is offered at checkout, you can turn it on there; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    related: [["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], ["/straight-talk.html", "Straight Talk refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
  }),
  es({
    key: "straight-talk", name: "Straight Talk", slug: "straight-talk", checkout: "/es/straight-talk.html",
    title: "Cómo Pagar su Factura de Straight Talk en Línea (Sin Iniciar Sesión) | CellPay",
    description: `Pague Straight Talk en línea sin iniciar sesión: ingrese el número, elija un plan y pague con ${payWith("es")}.`,
    h1: "Cómo Pagar su Factura de Straight Talk en Línea (Sin Iniciar Sesión)",
    step3: "Elija un plan de la lista en la página de CellPay.",
    faq2: { q: "¿Puedo recargar Straight Talk sin la aplicación de Straight Talk?", a: "Straight Talk ofrece sus propias opciones de recarga en su sitio web oficial y en su aplicación. En CellPay puede recargar desde su teléfono, tableta o computadora solo con el número de teléfono." },
    autoPayA: "Si CellPay ofrece Auto Pago al pagar, puede activarlo ahí; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "Si CellPay ofrece Auto Pago al pagar, puede activarlo ahí; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], ["/es/straight-talk.html", "Recarga Straight Talk"], ["/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
  }),
  en({
    key: "att-prepaid", name: "AT&T Prepaid", slug: "topup-at", checkout: "/topup-at.html", an: "an",
    title: "How to Pay Your AT&T Prepaid Bill Online Without Signing In | CellPay",
    description: `AT&T Prepaid pay bill online without signing in: enter the number, pick an amount and pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your AT&T Prepaid Bill Online Without Signing In",
    step3: "Choose an amount or plan on the page. The available amounts and any minimum are shown at checkout.", // AI-ANSWER-1010 item 2
    faq2: { q: "Does AT&T have its own way to pay prepaid without signing in?", a: "AT&T offers its own payment options on its official website and app. CellPay is another option if you want to pay without an AT&T login, with " + payWallets("en") + "." },
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    related: [["/how-to-pay/straight-talk", "How to pay Straight Talk"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], ["/topup-at.html", "AT&T Prepaid refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
  }),
  es({
    key: "att-prepaid", name: "AT&T Prepaid", slug: "topup-at", checkout: "/es/topup-at.html",
    title: "Cómo Pagar su Factura de AT&T Prepaid en Línea Sin Iniciar Sesión | CellPay",
    description: `Pague AT&T Prepaid en línea sin iniciar sesión: ingrese el número, elija el monto y pague con ${payWith("es")}.`,
    h1: "Cómo Pagar su Factura de AT&T Prepaid en Línea Sin Iniciar Sesión",
    step3: "Elija un monto o plan en la página. Los montos disponibles y cualquier mínimo se muestran al pagar.", // AI-ANSWER-1010 item 2
    faq2: { q: "¿AT&T tiene su propia forma de pagar el servicio prepagado sin iniciar sesión?", a: "AT&T ofrece sus propias opciones de pago en su sitio web oficial y en su aplicación. CellPay es otra opción si quiere pagar sin una cuenta de AT&T, con " + payWallets("es") + "." },
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], ["/es/topup-at.html", "Recarga AT&T Prepaid"], ["/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
  }),
  // AEO-03-04-1008: SPEC-03 Simple Mobile + SPEC-04 T-Mobile Prepaid, EN + native ES (same template, no carrier-specific FAQ).
  en({
    key: "simple-mobile", name: "Simple Mobile", slug: "s1", checkout: "/s1.html", an: "a",
    title: "How to Pay Your Simple Mobile Bill Online | CellPay",
    description: `Simple Mobile pay bill online with no login: enter the number, pick a plan and pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your Simple Mobile Bill Online",
    step3: "Choose a plan from the list on the CellPay page.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    related: [["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/how-to-pay/straight-talk", "How to pay Straight Talk"], ["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], ["/s1.html", "Simple Mobile bill pay & refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-08", updatedText: "Last updated: October 8, 2026",
  }),
  es({
    key: "simple-mobile", name: "Simple Mobile", slug: "s1", checkout: "/es/s1.html",
    title: "Cómo Pagar su Factura de Simple Mobile en Línea | CellPay",
    description: "Pague su factura de Simple Mobile en línea sin iniciar sesión: ingrese el número, elija un plan y pague con tarjeta, Apple Pay, Google Pay y más.",
    h1: "Cómo Pagar su Factura de Simple Mobile en Línea",
    step3: "Elija un plan de la lista en la página de CellPay.",
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], ["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], ["/es/s1.html", "Pago de factura y recarga de Simple Mobile"], ["/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-08", updatedText: "Última actualización: 8 de octubre de 2026",
  }),
  en({
    key: "t-mobile-prepaid", name: "T-Mobile Prepaid", slug: "tmobile", checkout: "/tmobile-flexi.html", an: "a",
    title: "How to Pay Your T-Mobile Prepaid Bill or Refill Online | CellPay",
    description: `T-Mobile Prepaid pay bill online, no login: enter the number, pick an amount, pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your T-Mobile Prepaid Bill or Refill Online",
    step3: "Choose a plan from the list or enter a custom amount.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    related: [["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/how-to-pay/straight-talk", "How to pay Straight Talk"], ["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], ["/tmobile-flexi.html", "T-Mobile Prepaid refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-08", updatedText: "Last updated: October 8, 2026",
  }),
  es({
    key: "t-mobile-prepaid", name: "T-Mobile Prepaid", slug: "tmobile", checkout: "/es/tmobile-flexi.html",
    title: "Cómo Pagar la Factura de T-Mobile Prepago en Línea | CellPay", // TOP4-T4-1009 ("pagar factura t mobile")
    description: "Pagar factura de T-Mobile Prepago en línea sin iniciar sesión: ingrese el número, elija el monto y pague con tarjeta, Apple Pay, Google Pay y más.",
    h1: "Cómo pagar la factura de T-Mobile Prepago en línea",
    introLead: "Para pagar su factura o recargar su línea de T-Mobile Prepaid en línea sin iniciar sesión",
    step3: "Elija un plan de la lista o ingrese un monto personalizado.",
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], ["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], ["/es/tmobile-flexi.html", "Recarga T-Mobile Prepaid"], ["/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-08", updatedText: "Última actualización: 8 de octubre de 2026",
  }),
  // TOP4-T4-1009: Verizon Prepaid pay-bill pages (SPEC-05 + SPEC-T4). "Pay now" goes to /verizon-wireless-flexi.html (the page
  // that takes most Verizon sales and the one Ads uses); /verizon stays linked in "Related".
  en({
    key: "verizon-prepaid", name: "Verizon Prepaid", slug: "verizon", checkout: "/verizon-wireless-flexi.html", an: "a",
    title: "How to Pay Your Verizon Prepaid Bill Online | CellPay",
    description: `Verizon Prepaid pay bill online, no login: enter the number, pick an amount, pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your Verizon Prepaid Bill Online",
    step3: "Choose a plan from the list or enter a custom amount.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    related: [["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/verizon", "Verizon Prepaid refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-09", updatedText: "Last updated: October 9, 2026",
  }),
  es({
    key: "verizon-prepaid", name: "Verizon Prepago", slug: "verizon", checkout: "/es/verizon-wireless-flexi.html",
    title: "Cómo Pagar su Factura de Verizon Prepago en Línea | CellPay",
    description: "Pagar factura de Verizon Prepago en línea sin iniciar sesión: ingrese el número, elija el monto y pague con tarjeta, Apple Pay, Google Pay y más.",
    h1: "Cómo pagar su factura de Verizon Prepago en línea",
    step3: "Elija un plan de la lista o ingrese un monto personalizado.",
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/es/verizon", "Recarga Verizon Prepago"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-09", updatedText: "Última actualización: 9 de octubre de 2026",
  }),
  // AEO-06-LYCA-1011: Lyca Mobile pay-bill pages (SPEC-06 + overrides). "Pay now" goes to /lyca.html (ES: /es/lyca.html). Built like the Verizon pair.
  en({
    key: "lyca-mobile", name: "Lyca Mobile", slug: "lyca", checkout: "/lyca.html", an: "a",
    title: "How to Pay Your Lyca Mobile Bill or Recharge Online (USA) | CellPay",
    description: `Lyca Mobile pay bill online, no login: enter the number, pick an amount, pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your Lyca Mobile Bill or Recharge Online (USA)",
    step3: "Choose a plan from the list or enter a custom amount.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    moreFaqs: [
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your Lyca Mobile balance. Check the amount due in your Lyca Mobile app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." },
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." },
    ],
    related: [["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/guest-lyca.html", "Pay Lyca Mobile as a guest"], ["/lyca.html", "Lyca Mobile recharge"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-11", updatedText: "Last updated: October 11, 2026",
  }),
  es({
    key: "lyca-mobile", name: "Lyca Mobile", slug: "lyca", checkout: "/es/lyca.html",
    title: "Cómo Pagar su Factura de Lyca Mobile o Recargar en Línea | CellPay",
    description: "Pagar factura de Lyca Mobile en línea sin iniciar sesión: ingrese el número, elija el monto y pague con tarjeta, Apple Pay, Google Pay y más.",
    h1: "Cómo pagar su factura de Lyca Mobile o recargar en línea",
    introLead: "Para pagar su factura o recargar su línea de Lyca Mobile en línea sin iniciar sesión",
    step3: "Elija un plan de la lista o ingrese un monto personalizado.",
    autoPayA: "S\u00ed. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    moreFaqs: [
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de Lyca Mobile. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de Lyca Mobile, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." },
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." },
    ],
    related: [["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/guest-lyca.html", "Pagar Lyca Mobile como invitado"], ["/es/lyca.html", "Recarga Lyca Mobile"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-11", updatedText: "Última actualización: 11 de octubre de 2026",
  }),
  // AEO-07-METRO-1012: Metro by T-Mobile pay-bill pages (SPEC-07/08 + overrides). "Pay now" goes to /metropcs.html (ES: /es/metropcs.html). Built like the Lyca/Verizon pairs.
  en({
    key: "metro-pcs", name: "Metro by T-Mobile", slug: "metropcs", checkout: "/metropcs.html", an: "a",
    title: "How to Pay Your Metro by T-Mobile (MetroPCS) Bill Online | CellPay",
    description: `Metro PCS pay bill online, no login: enter the Metro by T-Mobile number, pick an amount, pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your Metro by T-Mobile (MetroPCS) Bill Online",
    step3: "Choose a plan from the list or enter a custom amount.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    moreFaqs: [
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your Metro by T-Mobile balance. Check the amount due in your Metro by T-Mobile app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." },
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." },
    ],
    related: [["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/how-to-pay/boost-mobile", "How to pay Boost Mobile"], ["/how-to-pay/cricket", "How to pay Cricket Wireless"] /* CRICKET-GUIDE-1014 */, ["/how-to-pay/lyca-mobile", "How to pay Lyca Mobile"], ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], ["/guest-metro-pcs.html", "Pay Metro by T-Mobile as a guest"], ["/metropcs.html", "Pay Metro by T-Mobile now"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-12", updatedText: "Last updated: October 12, 2026",
  }),
  es({
    key: "metro-pcs", name: "Metro by T-Mobile", slug: "metropcs", checkout: "/es/metropcs.html",
    title: "Cómo Pagar su Factura de Metro by T-Mobile (MetroPCS) en Línea | CellPay",
    description: "Pagar Metro PCS en línea sin iniciar sesión: ingrese el número de Metro by T-Mobile, elija el monto y pague con tarjeta, Apple Pay, Google Pay y más.",
    h1: "Cómo pagar su factura de Metro by T-Mobile (MetroPCS) en línea",
    step3: "Elija un plan de la lista o ingrese un monto personalizado.",
    autoPayA: "S\u00ed. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    moreFaqs: [
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de Metro by T-Mobile. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de Metro by T-Mobile, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." },
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." },
    ],
    related: [["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/es/como-pagar/boost-mobile", "Cómo pagar Boost Mobile"], ["/es/como-pagar/cricket", "Cómo pagar Cricket Wireless"] /* CRICKET-GUIDE-1014 */, ["/es/como-pagar/lyca-mobile", "Cómo pagar Lyca Mobile"], ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], ["/guest-metro-pcs.html", "Pagar Metro by T-Mobile como invitado"], ["/es/metropcs.html", "Pagar Metro by T-Mobile ahora"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-12", updatedText: "Última actualización: 12 de octubre de 2026",
  }),
  // SEO-CONTENT-1014 (AEO-08-BOOST-1014): Boost Mobile pay-bill guide pair (SPEC-09 + Oct 14 overrides). "Pay now" goes to /boost.html
  // (ES: /es/boost.html). Built like the Metro/Lyca pairs; pay wording only (no "refill"/"recarga"), no fee amounts or plan prices.
  en({
    key: "boost-mobile", name: "Boost Mobile", slug: "boost", checkout: "/boost.html", an: "a",
    title: "How to Pay a Boost Mobile Bill as a Guest (No Login) | CellPay",
    description: "Boost Mobile pay bill as guest: enter the Boost number, pick an amount and pay online. No login. Service fee shown before you pay.",
    h1: "How to Pay a Boost Mobile Bill as a Guest (No Login)",
    step3: "Enter the amount you want to pay.",
    faq2: { q: "Does Boost Mobile have online guest pay?", a: "Boost Mobile offers its own payment options on its official website and app. On CellPay you can pay online with only the Boost number." },
    postA: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    moreFaqs: [
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your Boost Mobile balance. Check the amount due in your Boost Mobile app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." },
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." },
    ],
    related: [["/how-to-pay/metro-pcs", "How to pay Metro by T-Mobile"], ["/how-to-pay/cricket", "How to pay Cricket Wireless"] /* CRICKET-GUIDE-1014 */, ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/guest-boost.html", "Pay Boost Mobile as a guest"], ["/boost.html", "Pay Boost Mobile now"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-14", updatedText: "Last updated: October 14, 2026",
  }),
  es({
    key: "boost-mobile", name: "Boost Mobile", slug: "boost", checkout: "/es/boost.html",
    title: "Cómo Pagar su Factura de Boost Mobile como Invitado (Sin Iniciar Sesión) | CellPay",
    description: "Pague Boost Mobile como invitado: ingrese el número, elija el monto y pague en línea. Sin iniciar sesión. El cargo por servicio se muestra antes de pagar.",
    h1: "Cómo pagar su factura de Boost Mobile como invitado (sin iniciar sesión)",
    introLead: "Para pagar su factura de Boost Mobile en línea como invitado, sin iniciar sesión",
    step3: "Ingrese el monto que desea pagar.",
    faq2: { q: "¿Boost Mobile tiene pago en línea como invitado?", a: "Boost Mobile ofrece sus propias formas de pago en su sitio web oficial y en su aplicación. En CellPay puede pagar en línea solo con el número de Boost." },
    postA: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción.",
    autoPayA: "S\u00ed. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    moreFaqs: [
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de Boost Mobile. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de Boost Mobile, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." },
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." },
    ],
    related: [["/es/como-pagar/metro-pcs", "Cómo pagar Metro by T-Mobile"], ["/es/como-pagar/cricket", "Cómo pagar Cricket Wireless"] /* CRICKET-GUIDE-1014 */, ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/guest-boost.html", "Pagar Boost Mobile como invitado"], ["/es/boost.html", "Pagar Boost Mobile ahora"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-14", updatedText: "Última actualización: 14 de octubre de 2026",
  }),
  // CRICKET-GUIDE-1014: Cricket Wireless pay-bill guide pair, built like the Boost/Metro pairs. "Pay now" goes to /topup-crc.html
  // (ES: /es/topup-crc.html), no amount prefill. Pay wording only; no fee amounts or plan prices.
  en({
    key: "cricket", name: "Cricket Wireless", slug: "topup-crc", checkout: "/topup-crc.html", an: "a",
    title: "How to Pay Cricket Wireless Online | CellPay",
    description: "Pay your Cricket Wireless bill online with just the phone number. No login. Choose the amount, see the total and pay. Service fee shown before you pay.",
    h1: "How to pay Cricket Wireless online",
    intro: `To pay Cricket Wireless online, open CellPay's Cricket page, enter the 10-digit Cricket number, choose the amount and review the total (service fee shown before you pay). Then pay with ${PAY_EN}. No Cricket login needed.`,
    step3: "Choose a plan from the list or enter the amount you want to pay.",
    postA: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    moreFaqs: [
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your Cricket Wireless balance. Check the amount due in your Cricket Wireless app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." },
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." },
    ],
    related: [["/how-to-pay/boost-mobile", "How to pay Boost Mobile"], ["/how-to-pay/metro-pcs", "How to pay Metro by T-Mobile"], ["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], ["/topup-crc.html", "Pay Cricket Wireless now"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-14", updatedText: "Last updated: October 14, 2026",
  }),
  es({
    key: "cricket", name: "Cricket Wireless", slug: "topup-crc", checkout: "/es/topup-crc.html",
    title: "Cómo pagar Cricket Wireless en línea | CellPay",
    description: "Pague su factura de Cricket Wireless en línea con solo el número. Sin cuenta. Elija el monto y pague. El cargo por servicio se muestra antes de pagar.",
    h1: "Cómo pagar Cricket Wireless en línea",
    intro: `Para pagar Cricket Wireless en línea, abra la página de Cricket de CellPay, ingrese el número de Cricket de 10 dígitos, elija el monto y revise el total (el cargo por servicio se muestra antes de pagar). Luego pague con ${PAY_ES}. No necesita iniciar sesión en Cricket.`,
    step3: "Elija un plan de la lista o ingrese el monto que desea pagar.",
    postA: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción.",
    autoPayA: "S\u00ed. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca est\u00e1 marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    moreFaqs: [
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de Cricket Wireless. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de Cricket Wireless, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." },
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." },
    ],
    related: [["/es/como-pagar/boost-mobile", "Cómo pagar Boost Mobile"], ["/es/como-pagar/metro-pcs", "Cómo pagar Metro by T-Mobile"], ["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], ["/es/topup-crc.html", "Pagar Cricket Wireless ahora"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-14", updatedText: "Última actualización: 14 de octubre de 2026",
  }),
  // AEO-09-NET10-1015: Net10 Wireless pay-bill guide pair, built like the Boost pair. "Pay now" goes to /net10.html (ES: /es/net10.html).
  // Pay wording only; no fee amounts, plan prices, Net10 phone numbers or Net10 fees.
  en({
    key: "net10", name: "Net10 Wireless", slug: "net10", checkout: "/net10.html", an: "a",
    title: "How to Pay Your Net10 Wireless Bill Online (No Login) | CellPay",
    description: "Pay Net10 bill online in 2 minutes: enter the Net10 Wireless number, pick a plan, pay by card, Apple Pay, Google Pay or PayPal. No login needed.",
    h1: "How to Pay Your Net10 Wireless Bill Online",
    intro: "To pay your Net10 Wireless bill online without logging in, open CellPay's Net10 Wireless page, enter the 10-digit Net10 Wireless phone number, pick your plan, and pay. Service fee shown before you pay. Most payments post within a few minutes (up to 30 minutes). CellPay is an independent payment service, not Net10 Wireless.",
    steps: [
      { name: "Open the page", text: "Open the CellPay Net10 Wireless page (/net10.html)." },
      { name: "Enter the number", text: "Enter the 10-digit Net10 Wireless number and check it." },
      { name: "Pick a plan", text: "Pick a plan from the list." },
      { name: "Review the total", text: "Review the total (service fee shown before you pay)." },
      { name: "Pay", text: `Pay with ${PAY_EN} and keep your confirmation.` },
    ],
    step3: "Pick a plan from the list.",
    faq2: { q: "Does Net10 Wireless have online guest pay?", a: "Net10 Wireless offers its own payment options on its official website and app. On CellPay you can pay online with only the Net10 Wireless number." },
    postA: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    moreFaqs: [
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your Net10 Wireless balance. Check the amount due in your Net10 Wireless app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." },
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." },
    ],
    related: [["/how-to-pay/straight-talk", "How to pay Straight Talk"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], ["/guest-net10.html", "Pay Net10 Wireless as a guest"], ["/net10.html", "Pay Net10 Wireless now"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-15", updatedText: "Last updated: October 15, 2026",
  }),
  es({
    key: "net10", name: "Net10 Wireless", slug: "net10", checkout: "/es/net10.html",
    title: "Cómo pagar su factura de Net10 Wireless en línea (sin cuenta) | CellPay",
    description: "Pague su factura de Net10 Wireless en línea: ingrese el número, elija su plan y pague. Sin cuenta. El cargo por servicio se muestra antes de pagar.",
    h1: "Cómo pagar su factura de Net10 Wireless en línea",
    intro: "Para pagar su factura de Net10 Wireless en línea sin iniciar sesión, abra la página de Net10 Wireless en CellPay, escriba el número de 10 dígitos, elija su plan y pague. El cargo por servicio se muestra antes de pagar. La mayoría de los pagos se aplican en pocos minutos (hasta 30 minutos). CellPay es un servicio de pago independiente, no Net10 Wireless.",
    steps: [
      { name: "Abra la página", text: "Abra la página de Net10 Wireless en CellPay (/es/net10.html)." },
      { name: "Ingrese el número", text: "Escriba el número de Net10 Wireless de 10 dígitos y verifíquelo." },
      { name: "Elija un plan", text: "Elija un plan de la lista." },
      { name: "Revise el total", text: "Revise el total (el cargo por servicio se muestra antes de pagar)." },
      { name: "Pague", text: `Pague con ${PAY_ES} y guarde su confirmación.` },
    ],
    step3: "Elija un plan de la lista.",
    faq2: { q: "¿Net10 Wireless tiene pago en línea como invitado?", a: "Net10 Wireless ofrece sus propias formas de pago en su sitio web oficial y en su aplicación. En CellPay puede pagar en línea solo con el número de Net10 Wireless." },
    postA: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción.",
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    moreFaqs: [
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de Net10 Wireless. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de Net10 Wireless, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." },
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." },
    ],
    related: [["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepaid"], ["/guest-net10.html", "Pagar Net10 Wireless como invitado"], ["/es/net10.html", "Pagar Net10 Wireless ahora"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-15", updatedText: "Última actualización: 15 de octubre de 2026",
  }),
  // AEO-10-H2O-1016: H2O Wireless pay-bill guide pair, built like the Boost pair. "Pay now" goes to /h2o.html (ES: /es/h2o.html).
  // Pay wording only; no fee amounts, plan prices, H2O phone numbers or H2O fees.
  en({
    key: "h2o", name: "H2O Wireless", slug: "h2o", checkout: "/h2o.html", an: "a",
    title: "How to Pay Your H2O Wireless Bill Online (No Login) | CellPay",
    description: "Pay H2O bill online in 2 minutes: enter the H2O Wireless number, pick a plan, pay by card, Apple Pay, Google Pay or PayPal. No login needed.",
    h1: "How to Pay Your H2O Wireless Bill Online",
    intro: "To pay your H2O Wireless bill online without logging in, open CellPay's H2O Wireless page, enter the 10-digit H2O Wireless phone number, pick your plan, and pay. Service fee shown before you pay. Most payments post within a few minutes (up to 30 minutes). CellPay is an independent payment service, not H2O Wireless.",
    steps: [
      { name: "Open the page", text: "Open the CellPay H2O Wireless page (/h2o.html)." },
      { name: "Enter the number", text: "Enter the 10-digit H2O Wireless number and check it." },
      { name: "Pick a plan", text: "Pick a plan from the list." },
      { name: "Review the total", text: "Review the total (service fee shown before you pay)." },
      { name: "Pay", text: `Pay with ${PAY_EN} and keep your confirmation.` },
    ],
    step3: "Pick a plan from the list.",
    faq2: { q: "Does H2O Wireless have online guest pay?", a: "H2O Wireless offers its own payment options on its official website and app. On CellPay you can pay online with only the H2O Wireless number." },
    postA: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through.",
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    moreFaqs: [
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your H2O Wireless balance. Check the amount due in your H2O Wireless app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." },
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." },
    ],
    related: [["/how-to-pay/net10", "How to pay Net10 Wireless"], ["/how-to-pay/straight-talk", "How to pay Straight Talk"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/guest-h2o.html", "Pay H2O Wireless as a guest"], ["/h2o.html", "Pay H2O Wireless now"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
    updatedIso: "2026-10-16", updatedText: "Last updated: October 16, 2026",
  }),
  es({
    key: "h2o", name: "H2O Wireless", slug: "h2o", checkout: "/es/h2o.html",
    title: "Cómo pagar su factura de H2O Wireless en línea (sin cuenta) | CellPay",
    description: "Pague su factura de H2O Wireless en línea: ingrese el número, elija su plan y pague. Sin cuenta. El cargo por servicio se muestra antes de pagar.",
    h1: "Cómo pagar su factura de H2O Wireless en línea",
    intro: "Para pagar su factura de H2O Wireless en línea sin iniciar sesión, abra la página de H2O Wireless en CellPay, escriba el número de 10 dígitos, elija su plan y pague. El cargo por servicio se muestra antes de pagar. La mayoría de los pagos se aplican en pocos minutos (hasta 30 minutos). CellPay es un servicio de pago independiente, no H2O Wireless.",
    steps: [
      { name: "Abra la página", text: "Abra la página de H2O Wireless en CellPay (/es/h2o.html)." },
      { name: "Ingrese el número", text: "Escriba el número de H2O Wireless de 10 dígitos y verifíquelo." },
      { name: "Elija un plan", text: "Elija un plan de la lista." },
      { name: "Revise el total", text: "Revise el total (el cargo por servicio se muestra antes de pagar)." },
      { name: "Pague", text: `Pague con ${PAY_ES} y guarde su confirmación.` },
    ],
    step3: "Elija un plan de la lista.",
    faq2: { q: "¿H2O Wireless tiene pago en línea como invitado?", a: "H2O Wireless ofrece sus propias formas de pago en su sitio web oficial y en su aplicación. En CellPay puede pagar en línea solo con el número de H2O Wireless." },
    postA: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción.",
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    moreFaqs: [
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de H2O Wireless. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de H2O Wireless, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." },
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." },
    ],
    related: [["/es/como-pagar/net10", "Cómo pagar Net10 Wireless"], ["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/guest-h2o.html", "Pagar H2O Wireless como invitado"], ["/es/h2o.html", "Pagar H2O Wireless ahora"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
    updatedIso: "2026-10-16", updatedText: "Última actualización: 16 de octubre de 2026",
  }),
];

HOW_TO_PAY_PAGES.push( // AEO-11-ULTRA-1017
  en({ // AEO-11-ULTRA-1017
    key: "ultra-mobile", name: "Ultra Mobile", slug: "ultra-mobile", checkout: "/ultra-mobile.html", an: "an", // AEO-11-ULTRA-1017
    title: "How to Pay Your Ultra Mobile Bill Online (No Login) | CellPay", // AEO-11-ULTRA-1017
    description: "Pay Ultra Mobile bill online in 2 minutes: enter the Ultra Mobile number, pick a plan, pay by card, Apple Pay, Google Pay or PayPal. No login needed.", // AEO-11-ULTRA-1017
    h1: "How to Pay Your Ultra Mobile Bill Online", // AEO-11-ULTRA-1017
    intro: "To pay your Ultra Mobile bill online without logging in, open CellPay's Ultra Mobile page, enter the 10-digit Ultra Mobile phone number, pick your plan, and pay. Service fee shown before you pay. Most payments post within a few minutes (up to 30 minutes). CellPay is an independent payment service, not Ultra Mobile.", // AEO-11-ULTRA-1017
    steps: [ // AEO-11-ULTRA-1017
      { name: "Open the page", text: "Open the CellPay Ultra Mobile page (/ultra-mobile.html)." }, // AEO-11-ULTRA-1017
      { name: "Enter the number", text: "Enter the 10-digit Ultra Mobile number and check it." }, // AEO-11-ULTRA-1017
      { name: "Pick a plan", text: "Pick a plan from the list." }, // AEO-11-ULTRA-1017
      { name: "Review the total", text: "Review the total (service fee shown before you pay)." }, // AEO-11-ULTRA-1017
      { name: "Pay", text: `Pay with ${PAY_EN} and keep your confirmation.` }, // AEO-11-ULTRA-1017
    ], // AEO-11-ULTRA-1017
    step3: "Pick a plan from the list.", // AEO-11-ULTRA-1017
    faq2: { q: "Does Ultra Mobile have online guest pay?", a: "Ultra Mobile offers its own payment options on its official website and app. On CellPay you can pay online with only the Ultra Mobile number." }, // AEO-11-ULTRA-1017
    postA: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through.", // AEO-11-ULTRA-1017
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.", // AEO-11-ULTRA-1017
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.", // AEO-11-ULTRA-1017
    moreFaqs: [ // AEO-11-ULTRA-1017
      { q: "What if I don't know how much I owe?", a: "CellPay doesn't show your Ultra Mobile balance. Check the amount due in your Ultra Mobile app, account or text messages, then choose that plan or amount here. The total with the service fee is shown before you pay." }, // AEO-11-ULTRA-1017
      { q: "I paid but my phone still isn't working. What should I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." }, // AEO-11-ULTRA-1017
    ], // AEO-11-ULTRA-1017
    related: [["/how-to-pay/h2o", "How to pay H2O"], ["/how-to-pay/lyca-mobile", "How to pay Lyca Mobile"], ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]], // AEO-11-ULTRA-1017
    updatedIso: "2026-10-17", updatedText: "Last updated: October 17, 2026", // AEO-11-ULTRA-1017
  }), // AEO-11-ULTRA-1017
  es({ // AEO-11-ULTRA-1017
    key: "ultra-mobile", name: "Ultra Mobile", slug: "ultra-mobile", checkout: "/es/ultra-mobile.html", // AEO-11-ULTRA-1017
    title: "Cómo pagar Ultra Mobile en línea (sin cuenta) | CellPay", // AEO-11-ULTRA-1017
    description: "Pague o recargue Ultra Mobile en línea: ingrese el número, elija su plan y pague. Sin cuenta. El cargo por servicio se muestra antes de pagar.", // AEO-11-ULTRA-1017
    h1: "Cómo pagar Ultra Mobile en línea", // AEO-11-ULTRA-1017
    intro: "Para pagar su factura de Ultra Mobile en línea sin iniciar sesión, abra la página de Ultra Mobile en CellPay, escriba el número de 10 dígitos, elija su plan y pague. El cargo por servicio se muestra antes de pagar. La mayoría de los pagos se aplican en pocos minutos (hasta 30 minutos). CellPay es un servicio de pago independiente, no Ultra Mobile.", // AEO-11-ULTRA-1017
    steps: [ // AEO-11-ULTRA-1017
      { name: "Abra la página", text: "Abra la página de Ultra Mobile en CellPay (/es/ultra-mobile.html)." }, // AEO-11-ULTRA-1017
      { name: "Ingrese el número", text: "Escriba el número de Ultra Mobile de 10 dígitos y verifíquelo." }, // AEO-11-ULTRA-1017
      { name: "Elija un plan", text: "Elija un plan de la lista." }, // AEO-11-ULTRA-1017
      { name: "Revise el total", text: "Revise el total (el cargo por servicio se muestra antes de pagar)." }, // AEO-11-ULTRA-1017
      { name: "Pague", text: `Pague con ${PAY_ES} y guarde su confirmación.` }, // AEO-11-ULTRA-1017
    ], // AEO-11-ULTRA-1017
    step3: "Elija un plan de la lista.", // AEO-11-ULTRA-1017
    faq2: { q: "¿Ultra Mobile tiene pago en línea como invitado?", a: "Ultra Mobile ofrece sus propias formas de pago en su sitio web oficial y en su aplicación. En CellPay puede pagar en línea solo con el número de Ultra Mobile." }, // AEO-11-ULTRA-1017
    postA: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción.", // AEO-11-ULTRA-1017
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.", // AEO-11-ULTRA-1017
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo cuando quiera con 'Unsubscribe From Autopay' en cellpay.us/faq.", // AEO-11-ULTRA-1017
    moreFaqs: [ // AEO-11-ULTRA-1017
      { q: "¿Qué hago si no sé cuánto debo?", a: "CellPay no muestra el saldo de Ultra Mobile. Revise el monto a pagar en la aplicación, la cuenta o los mensajes de texto de Ultra Mobile, y luego elija ese plan o monto aquí. El total con el cargo por servicio se muestra antes de pagar." }, // AEO-11-ULTRA-1017
      { q: "Ya pagué, pero mi teléfono todavía no funciona. ¿Qué hago?", a: "La mayoría de los pagos se acreditan en unos minutos; algunos tardan hasta 30 minutos. Reinicie su teléfono. Si después de 30 minutos todavía no funciona, toque Ayuda y elija Ver el estado del pedido, o escriba a support@getcellpay.com con su número de pedido." }, // AEO-11-ULTRA-1017
    ], // AEO-11-ULTRA-1017
    related: [["/es/como-pagar/h2o", "Cómo pagar H2O Wireless"], ["/es/como-pagar/lyca-mobile", "Cómo pagar Lyca Mobile"], ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"], ["/es/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]], // AEO-11-ULTRA-1017
    updatedIso: "2026-10-17", updatedText: "Última actualización: 17 de octubre de 2026", // AEO-11-ULTRA-1017
  }), // AEO-11-ULTRA-1017
); // AEO-11-ULTRA-1017
for (const pg of HOW_TO_PAY_PAGES.filter((p) => p.key === "ultra-mobile")) { // AEO-11-ULTRA-1017
  pg.labels.payNow = pg.lang === "es" ? "Pagar ahora" : "Pay now"; // AEO-11-ULTRA-1017
  if (pg.lang === "es") { // AEO-11-ULTRA-1017
    pg.faqs[0].a = pg.faqs[0].a.replace("ingresa el", "ingrese el").replace("elige el", "elija el").replace("y paga.", "y pague."); // AEO-11-ULTRA-1017
    pg.faqs[2].a = pg.faqs[2].a.replace("así que ve el", "así que verá el"); // AEO-11-ULTRA-1017
  } // AEO-11-ULTRA-1017
} // AEO-11-ULTRA-1017

// AI-ANSWERS-1014: 18 amount answer pages (Boost, Metro, Cricket x $25/$45/$50, EN + ES). Same template/renderers as the parent
// guides; pay wording only, no fee amounts, no plan contents or prices. Payment methods come from the shared flag-driven list.
type AmtCarrier = { key: HtpPage["key"]; name: string; short: string; slug: string; enPay: string; esPay: string };
const AMT_CARRIERS: AmtCarrier[] = [
  { key: "boost-mobile", name: "Boost Mobile", short: "Boost", slug: "boost", enPay: "/boost.html", esPay: "/es/boost.html" },
  { key: "metro-pcs", name: "Metro by T-Mobile (Metro PCS)", short: "Metro", slug: "metropcs", enPay: "/metropcs.html", esPay: "/es/metropcs.html" },
  { key: "cricket", name: "Cricket Wireless", short: "Cricket", slug: "topup-crc", enPay: "/topup-crc.html", esPay: "/es/topup-crc.html" },
];
export const HTP_AMOUNTS = [25, 45, 50] as const;
const AMT_TAIL_EN: Record<string, string> = {
  "boost-mobile": "New Boost lines work too.",
  "metro-pcs": "Metro PCS is now Metro by T-Mobile.",
  cricket: "Any Cricket line works, yours or family.",
};
const AMT_TAIL_ES: Record<string, string> = {
  "boost-mobile": "Sirve también para líneas nuevas de Boost.",
  "metro-pcs": "Metro PCS ahora es Metro by T-Mobile.",
  cricket: "Sirve para su línea o la de un familiar.",
};
const amtIntroEn = (c: AmtCarrier, a: number): string =>
  a === 25
    ? `Yes, you can pay $25 to ${c.name} online. Open CellPay's ${c.short} page, enter the 10-digit ${c.short} number, type $25, check the total and pay with ${PAY_EN}. No login needed. ${AMT_TAIL_EN[c.key]}`
    : a === 45
      ? `To pay $45 on a ${c.name} line, go to CellPay's ${c.short} page, enter the phone number, enter $45, review the total and pay with ${PAY_EN}. No account or login needed. ${AMT_TAIL_EN[c.key]}`
      : `Paying $50 toward ${c.name} takes about a minute on CellPay: enter the 10-digit ${c.short} number, enter $50, confirm the total, then pay with ${PAY_EN}. No login needed. ${AMT_TAIL_EN[c.key]}`;
const amtIntroEs = (c: AmtCarrier, a: number): string =>
  a === 25
    ? `Sí, puede pagar $25 a ${c.name} en línea. Abra la página de ${c.short} de CellPay, ingrese el número de ${c.short} de 10 dígitos, escriba $25, revise el total y pague con ${PAY_ES}. Sin iniciar sesión. ${AMT_TAIL_ES[c.key]}`
    : a === 45
      ? `Para pagar $45 en una línea de ${c.name}, vaya a la página de ${c.short} de CellPay, ingrese el número, ingrese $45, revise el total y pague con ${PAY_ES}. Sin cuenta. ${AMT_TAIL_ES[c.key]}`
      : `Pagar $50 a ${c.name} toma cerca de un minuto en CellPay: ingrese el número de ${c.short} de 10 dígitos, ingrese $50, confirme el total y pague con ${PAY_ES}. Sin iniciar sesión. ${AMT_TAIL_ES[c.key]}`;
const AMT_DATE_EN = "Last updated: October 14, 2026";
const AMT_DATE_ES = "Última actualización: 14 de octubre de 2026";
const amtPage = (c: AmtCarrier, a: number, lang: HtpLang): HtpPage => {
  const isEs = lang === "es";
  const enPath = `/how-to-pay/${c.key}/${a}`;
  const esPath = `/es/como-pagar/${c.key}/${a}`;
  const parentPath = isEs ? `/es/como-pagar/${c.key}` : `/how-to-pay/${c.key}`;
  const pay = isEs ? c.esPay : c.enPay;
  const shortTitle = c.key === "metro-pcs" ? "Metro by T-Mobile (Metro PCS)" : c.name;
  return {
    key: c.key, lang, path: isEs ? esPath : enPath, enPath, esPath, carrierSlug: c.slug, carrierName: c.name, checkoutPath: pay,
    title: isEs
      ? (c.key === "metro-pcs" ? `Cómo pagar ${shortTitle} $${a} | CellPay` : `Cómo pagar ${c.name} $${a} en línea | CellPay`)
      : (c.key === "metro-pcs" ? `How to Pay ${shortTitle} $${a} | CellPay` : `How to Pay ${c.name} $${a} Online | CellPay`),
    description: isEs
      ? `Pague $${a} a ${c.key === "metro-pcs" ? "Metro by T-Mobile" : c.name} en línea con solo el número de ${c.short}. Sin iniciar sesión. La tarifa de servicio se muestra antes de pagar.`
      : `Pay $${a} to ${c.key === "metro-pcs" ? "Metro by T-Mobile" : c.name} online with just the ${c.short} number. No login needed. Enter $${a}, review the total and pay. Service fee shown before you pay.`,
    h1: isEs ? `Cómo pagar ${c.name} $${a} en línea` : `How to pay ${c.name} $${a} online`,
    intro: isEs ? amtIntroEs(c, a) : amtIntroEn(c, a),
    steps: isEs
      ? [
          { name: "Ingrese el número de teléfono", text: `En la página de ${c.short} de CellPay (${pay}), escriba el número de ${c.short} de 10 dígitos y verifíquelo.` },
          { name: `Ingrese $${a}`, text: `Escriba $${a} como el monto que desea pagar.` },
          { name: "Revise el total", text: "El resumen del pedido muestra el número, el monto, la tarifa de servicio y el total." },
          { name: "Pague", text: `Pague con ${PAY_ES} y guarde su confirmación.` },
        ]
      : [
          { name: "Enter the phone number", text: `On the CellPay ${c.short} page (${pay}), type the 10-digit ${c.short} number and check it.` },
          { name: `Enter $${a}`, text: `Type $${a} as the amount you want to pay.` },
          { name: "Review the total", text: "The order summary shows the number, the amount, the service fee and the total." },
          { name: "Pay", text: `Pay with ${PAY_EN} and keep your confirmation.` },
        ],
    need: [], feeRows: [], feeNote: "", plansLabel: "", plansLoading: "", otherWays: "", someoneElseTitle: "", someoneElse: "", autoPayTitle: "", autoPay: "",
    faqs: isEs
      ? [
          { q: `¿Puedo pagar exactamente $${a} a ${c.name}?`, a: `Sí. La página de ${c.short} de CellPay acepta montos desde $5 hasta ${c.slug === "boost" ? "$199" : "$250 o más"}, así que puede ingresar $${a}. No necesita iniciar sesión en ${c.short} ni una cuenta de CellPay.` }, // PLAN-RANGES-1016
          { q: "¿Qué métodos de pago puedo usar?", a: METHODS_ES },
          { q: `¿Hay un cargo por pagar $${a} a ${c.name}?`, a: "Sí, se aplica una tarifa de servicio. La tarifa de servicio se muestra antes de pagar, en el resumen del pedido, así que ve el total completo primero." },
        ]
      : [
          { q: `Can I pay exactly $${a} to ${c.name}?`, a: `Yes. CellPay's ${c.short} page accepts amounts from $5 to ${c.slug === "boost" ? "$199" : "$250 or more"}, so you can enter $${a}. You don't need a ${c.short} login or a CellPay account.` }, // PLAN-RANGES-1016
          { q: "What payment methods can I use?", a: METHODS_EN },
          { q: `Is there a fee to pay $${a} to ${c.name}?`, a: "Yes, a service fee applies. The service fee is shown before you pay, in the order summary, so you see the full total first." },
        ],
    disclaimer: isEs ? `CellPay es un servicio de pago independiente y no está afiliado a ${c.name}.` : `CellPay is an independent payment service and is not affiliated with ${c.name}.`,
    updated: isEs ? AMT_DATE_ES : AMT_DATE_EN,
    updatedIso: "2026-10-14",
    related: [],
    labels: isEs
      ? { ...LABELS_ES, payNow: `Pagar ${c.name} ahora`, other: "" }
      : { ...LABELS_EN, payNow: `Pay ${c.name} now`, other: "" },
    amount: a,
    parentPath,
    parentLabel: isEs ? `Guía completa: cómo pagar ${c.name}` : `Full guide: how to pay ${c.name}`,
    methodsTitle: isEs ? "Métodos de pago" : "Payment methods",
    methodsLine: isEs ? METHODS_ES : METHODS_EN,
    feeLine: isEs ? "La tarifa de servicio se muestra antes de pagar." : "Service fee shown before you pay.",
  };
};
HOW_TO_PAY_PAGES.push(...AMT_CARRIERS.flatMap((c) => HTP_AMOUNTS.flatMap((a) => [amtPage(c, a, "en"), amtPage(c, a, "es")])));

/** AI-ANSWERS-1014: "Common amounts" links for a parent guide (empty for amount pages and other carriers). */
export const htpCommonAmounts = (pg: HtpPage): Array<[string, string]> =>
  pg.amount || !AMT_CARRIERS.some((c) => c.key === pg.key)
    ? []
    : HTP_AMOUNTS.map((a) => [pg.lang === "es" ? `/es/como-pagar/${pg.key}/${a}` : `/how-to-pay/${pg.key}/${a}`, pg.lang === "es" ? `Pagar $${a} a ${pg.carrierName}` : `Pay $${a} to ${pg.carrierName}`]);

export const howToPayByPath = (pathname: string): HtpPage | undefined => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return HOW_TO_PAY_PAGES.find((x) => x.path === p);
};

export const howToPayJsonLd = (pg: HtpPage): string => {
  const url = WWW + pg.path;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: pg.lang,
        mainEntity: pg.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "HowTo", "@id": `${url}#howto`, name: pg.h1, inLanguage: pg.lang, totalTime: "PT2M",
        supply: [{ "@type": "HowToSupply", name: pg.labels.supply }],
        tool: [{ "@type": "HowToTool", name: pg.labels.tool }],
        step: pg.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text, url: `${url}#step-${i + 1}` })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          ...(pg.amount // AI-ANSWERS-1014: Home › How to pay › <Carrier> › $<amount>
            ? [
                { "@type": "ListItem", position: 1, name: pg.lang === "es" ? "Inicio" : "Home", item: `${WWW}${pg.lang === "es" ? "/es" : "/"}` },
                { "@type": "ListItem", position: 2, name: pg.labels.breadcrumbHowTo, item: `${WWW}${pg.lang === "es" ? "/es/how-to-use" : "/how-to-use"}` },
                { "@type": "ListItem", position: 3, name: pg.carrierName, item: `${WWW}${pg.parentPath}` },
                { "@type": "ListItem", position: 4, name: `$${pg.amount}`, item: url },
              ]
            : [
                { "@type": "ListItem", position: 1, name: "CellPay", item: `${WWW}/` },
                { "@type": "ListItem", position: 2, name: pg.labels.breadcrumbHowTo, item: `${WWW}/how-to-use` },
                { "@type": "ListItem", position: 3, name: pg.carrierName, item: url },
              ]),
        ],
      },
    ],
    dateModified: pg.updatedIso,
  }).replace(/</g, "\\u003c");
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// AI-ANSWER-1010: plan NAMES (no prices) in the raw HTML and in the first React render, so assistants and crawlers see what the carrier
// offers instead of "Loading current plans". Prices and the live list still come from the CellPay catalog after load (HowToPay.tsx).
// Names are a general guide (snapshot Oct 10 2026); the note below the list says so.
const PLAN_NAMES: Record<HtpPage["key"], Record<HtpLang, string[]>> = {
  "att-prepaid": {
    en: ["AT&T Prepaid refill: choose one of the fixed amounts shown on the CellPay page, or a custom amount where offered"],
    es: ["Recarga AT&T Prepaid: elija uno de los montos fijos que aparecen en la página de CellPay, o un monto personalizado cuando esté disponible"],
  },
  "t-mobile-prepaid": {
    en: ["T-Mobile Prepaid refill: choose one of the fixed amounts shown on the CellPay page, or a custom amount where offered"],
    es: ["Recarga T-Mobile Prepaid: elija uno de los montos fijos que aparecen en la página de CellPay, o un monto personalizado cuando esté disponible"],
  },
  "lyca-mobile": { // AEO-06-LYCA-1011 (no plan names or prices: the live list loads from the CellPay catalog)
    en: ["Lyca Mobile refill: choose one of the fixed amounts shown on the CellPay page, or a custom amount where offered"],
    es: ["Recarga Lyca Mobile: elija uno de los montos fijos que aparecen en la página de CellPay, o un monto personalizado cuando esté disponible"],
  },
  "metro-pcs": { // AEO-07-METRO-1012 (no plan names or prices: the live list loads from the CellPay catalog)
    en: ["Metro by T-Mobile payment: choose one of the fixed amounts shown on the CellPay page, or a custom amount where offered"],
    es: ["Pago de Metro by T-Mobile: elija uno de los montos fijos que aparecen en la página de CellPay, o un monto personalizado cuando esté disponible"],
  },
  "boost-mobile": { // SEO-CONTENT-1014 (no plan names or prices: the live list loads from the CellPay catalog)
    en: ["Boost Mobile payment: enter the amount you want to pay on the CellPay page, or choose a plan where offered"],
    es: ["Pago de Boost Mobile: ingrese el monto que desea pagar en la página de CellPay, o elija un plan cuando esté disponible"],
  },
  cricket: { // CRICKET-GUIDE-1014 (no plan names or prices: the live list loads from the CellPay catalog)
    en: ["Cricket Wireless payment: choose one of the amounts shown on the CellPay page, or enter the amount you want to pay where offered"],
    es: ["Pago de Cricket Wireless: elija uno de los montos que aparecen en la página de CellPay, o ingrese el monto que desea pagar cuando esté disponible"],
  },
  net10: { // AEO-09-NET10-1015 (no plan names or prices: the live list loads from the CellPay catalog)
    en: ["Net10 Wireless payment: choose one of the plans shown on the CellPay page"],
    es: ["Pago de Net10 Wireless: elija uno de los planes que aparecen en la página de CellPay"],
  },
  "ultra-mobile": { // AEO-11-ULTRA-1017
    en: ["Ultra Mobile payment: choose one of the plans shown on the CellPay page"], // AEO-11-ULTRA-1017
    es: ["Pago de Ultra Mobile: elija uno de los planes que aparecen en la página de CellPay"], // AEO-11-ULTRA-1017
  }, // AEO-11-ULTRA-1017
  h2o: { // AEO-10-H2O-1016 (no plan names or prices: the live list loads from the CellPay catalog)
    en: ["H2O Wireless payment: choose one of the plans shown on the CellPay page"],
    es: ["Pago de H2O Wireless: elija uno de los planes que aparecen en la página de CellPay"],
  },
  "verizon-prepaid": {
    en: ["Verizon Prepaid refill: choose one of the fixed amounts shown on the CellPay page, or a custom amount where offered"],
    es: ["Recarga Verizon Prepago: elija uno de los montos fijos que aparecen en la página de CellPay, o un monto personalizado cuando esté disponible"],
  },
  "simple-mobile": {
    en: [
      "Unlimited Talk, Text, Unlimited 5G Ultra Wideband",
      "Unlimited Talk, Text, Unlimited high-speed data",
      "Unlimited Talk, Text, 30 GB high-speed data",
      "Unlimited Talk, Text, 20 GB high-speed data",
      "Unlimited Talk, Text, 15 GB high-speed data",
      "3-month Unlimited plan",
    ],
    es: [
      "Llamadas y texto ilimitados, 5G Ultra Wideband ilimitado",
      "Llamadas y texto ilimitados, datos de alta velocidad ilimitados",
      "Llamadas y texto ilimitados, 30 GB de datos de alta velocidad",
      "Llamadas y texto ilimitados, 20 GB de datos de alta velocidad",
      "Llamadas y texto ilimitados, 15 GB de datos de alta velocidad",
      "Plan Ilimitado de 3 meses",
    ],
  },
  "straight-talk": {
    en: ["Platinum Unlimited", "Gold Unlimited", "Silver Unlimited", "Bronze 10 GB", "2 GB of data (unused balance rolls over)", "Global Calling Add-On"],
    es: ["Platinum Unlimited", "Gold Unlimited", "Silver Unlimited", "Bronze 10 GB", "2 GB de datos (el saldo no usado se acumula)", "Complemento Global Calling"],
  },
};
export const htpPlanNames = (pg: HtpPage): string[] => PLAN_NAMES[pg.key]?.[pg.lang] ?? [];
export const htpPlansNote = (pg: HtpPage): string =>
  pg.lang === "es"
    ? "Los nombres de planes son una guía general. Los planes y precios actuales los define el operador, se cargan en vivo desde el catálogo de CellPay y se muestran antes de pagar."
    : "Plan names are a general guide. Current plans and prices are set by the carrier, loaded live from the CellPay catalog, and shown before you pay.";

// TOP4-T4-1009 (guide LCP): static first render for the raw HTML = the SAME DOM, classes and text as the first React render of
// src/pages/HowToPay.tsx (plans still loading). data-go-prerender lets the browser paint it before React starts (main.tsx),
// and main.tsx waits for the guide chunk, so React swaps in identical markup and nothing new paints. Keep in sync with HowToPay.tsx.
export const howToPayStaticHtml = (pg: HtpPage): string => {
  const L = pg.labels;
  const h2 = (t: string) => `<h2 class="text-xl font-extrabold mt-8 mb-3">${esc(t)}</h2>`;
  const head =
    `<div id="root" data-go-prerender="1"><div class="min-h-screen bg-background font-sans antialiased text-foreground" lang="${pg.lang}">` +
    `<nav class="border-b border-border bg-card"><div class="max-w-3xl mx-auto px-5 h-14 flex items-center"><a class="font-extrabold text-lg" href="${pg.lang === "es" ? "/es" : "/"}">CellPay</a></div></nav>` +
    `<main class="max-w-3xl mx-auto px-5 py-8 leading-relaxed">` +
    `<h1 class="text-2xl md:text-3xl font-extrabold leading-tight mb-4">${esc(pg.h1)}</h1>` +
    `<div class="rounded-xl border border-border bg-muted/40 p-4 mb-6"><p>${esc(pg.intro)}</p><a href="${pg.checkoutPath}" class="inline-block mt-3 rounded-lg bg-primary text-primary-foreground font-bold px-5 py-2.5">${esc(L.payNow)}</a></div>` +
    h2(L.steps) + `<ol class="list-decimal pl-6 space-y-2">` + pg.steps.map((s, i) => `<li id="step-${i + 1}"><strong>${esc(s.name)}.</strong> ${esc(s.text)}</li>`).join("") + `</ol>`;
  const faqHtml = h2(L.faq) + pg.faqs.map((f) => `<div class="mb-4"><h3 class="font-bold">${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("");
  const foot = `<p class="text-xs text-muted-foreground mt-8">${esc(pg.disclaimer)}</p><p class="text-xs text-muted-foreground">${esc(pg.updated)}</p>`;
  if (pg.amount) {
    // AI-ANSWERS-1014: amount page (same markup as HowToPay.tsx AmountView)
    return (
      head +
      h2(pg.methodsTitle ?? "") + `<p>${esc(pg.methodsLine ?? "")}</p>` + `<p class="mt-2 font-bold">${esc(pg.feeLine ?? "")}</p>` +
      faqHtml + foot +
      `<p class="mt-6"><a href="${pg.parentPath}" class="underline">${esc(pg.parentLabel ?? "")}</a></p>` +
      `</main></div></div>`
    );
  }
  const common = htpCommonAmounts(pg); // AI-ANSWERS-1014
  return (
    `<div id="root" data-go-prerender="1"><div class="min-h-screen bg-background font-sans antialiased text-foreground" lang="${pg.lang}">` +
    `<nav class="border-b border-border bg-card"><div class="max-w-3xl mx-auto px-5 h-14 flex items-center"><a class="font-extrabold text-lg" href="${pg.lang === "es" ? "/es" : "/"}">CellPay</a></div></nav>` +
    `<main class="max-w-3xl mx-auto px-5 py-8 leading-relaxed">` +
    `<h1 class="text-2xl md:text-3xl font-extrabold leading-tight mb-4">${esc(pg.h1)}</h1>` +
    `<div class="rounded-xl border border-border bg-muted/40 p-4 mb-6"><p>${esc(pg.intro)}</p><a href="${pg.checkoutPath}" class="inline-block mt-3 rounded-lg bg-primary text-primary-foreground font-bold px-5 py-2.5">${esc(L.payNow)}</a></div>` +
    h2(L.steps) + `<ol class="list-decimal pl-6 space-y-2">` + pg.steps.map((s, i) => `<li id="step-${i + 1}"><strong>${esc(s.name)}.</strong> ${esc(s.text)}</li>`).join("") + `</ol>` +
    h2(L.need) + `<ul class="list-disc pl-6 space-y-1">` + pg.need.map((n) => `<li>${esc(n)}</li>`).join("") + `</ul>` +
    h2(L.fees) + `<table class="w-full text-sm border border-border"><thead><tr class="bg-muted/40"><th class="text-left p-2">${esc(L.item)}</th><th class="text-left p-2">${esc(L.amount)}</th></tr></thead><tbody>` +
    pg.feeRows.map(([a, b]) => `<tr class="border-t border-border"><td class="p-2">${esc(a)}</td><td class="p-2">${esc(b)}</td></tr>`).join("") + `</tbody></table>` +
    `<p class="text-xs text-muted-foreground mt-1">${esc(pg.feeNote)}</p>` +
    `<h3 class="font-bold mt-5 mb-2">${esc(pg.plansLabel)}</h3>` +
    `<ul class="list-disc pl-6 text-sm space-y-1">${htpPlanNames(pg).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` +
    `<p class="text-sm text-muted-foreground mt-2">${esc(htpPlansNote(pg))}</p>` + // AI-ANSWER-1010 (same markup as HowToPay.tsx while plans load)
    h2(L.other) + `<p>${esc(pg.otherWays)}</p>` +
    h2(pg.someoneElseTitle) + `<p>${esc(pg.someoneElse)}</p>` +
    h2(pg.autoPayTitle) + `<p>${esc(pg.autoPay)} <a href="${pg.checkoutPath}" class="underline">${esc(L.payNow)}</a></p>` +
    h2(L.faq) + pg.faqs.map((f) => `<div class="mb-4"><h3 class="font-bold">${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("") +
    `<p class="text-xs text-muted-foreground mt-8">${esc(pg.disclaimer)}</p><p class="text-xs text-muted-foreground">${esc(pg.updated)}</p>` +
    (common.length ? h2(pg.lang === "es" ? "Montos comunes" : "Common amounts") + `<ul class="list-disc pl-6 space-y-1">` + common.map(([h, t]) => `<li><a href="${h}" class="underline">${esc(t)}</a></li>`).join("") + `</ul>` : "") + // AI-ANSWERS-1014
    h2(L.related) + `<ul class="list-disc pl-6 space-y-1">` + pg.related.map(([h, t]) => `<li><a href="${h}" class="underline">${esc(t)}</a></li>`).join("") + `</ul>` +
    `</main></div></div>`
  );
};
