// AEO-PAGES-1007: "how to pay" pages (SPEC-01 Straight Talk, SPEC-02 AT&T Prepaid, + ES pairs).
// Single source for the React page (src/pages/HowToPay.tsx) AND the static raw HTML + JSON-LD emitted by vite.config.ts,
// so visible FAQ text and FAQPage JSON-LD stay word for word identical. Relative imports only: vite.config.ts loads this file.
// PAYCOPY-1008: payment methods come from ./paymentMethods (follows src/config/paymentFlags.ts; PayPal only while enabled).
import { methodsLong, payWith, payWallets } from "./paymentMethods";
// No prices or fee amounts here: plan prices render live from the carrier catalog; the fee is shown at checkout.

export type HtpLang = "en" | "es";
export type HtpFaq = { q: string; a: string };
export type HtpPage = {
  key: "straight-talk" | "att-prepaid";
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
  related: Array<[string, string]>;
  labels: { payNow: string; steps: string; need: string; fees: string; item: string; amount: string; other: string; faq: string; related: string; breadcrumbHowTo: string; tool: string; supply: string };
};

const WWW = "https://www.cellpay.us";
const UPDATED_ISO = "2026-10-07";
const METHODS_EN = methodsLong("en");
const METHODS_ES = methodsLong("es");
const PAY_EN = payWith("en");
const PAY_ES = payWith("es");

const LABELS_EN = { payNow: "", steps: "Steps", need: "What you need", fees: "Fees and totals", item: "Item", amount: "Amount", other: "", faq: "Frequently asked questions", related: "Related", breadcrumbHowTo: "How to pay", tool: payWith("en", "Card"), supply: "10-digit phone number" };
const LABELS_ES = { payNow: "", steps: "Pasos", need: "Lo que necesita", fees: "Cargos y totales", item: "Concepto", amount: "Monto", other: "", faq: "Preguntas frecuentes", related: "Relacionado", breadcrumbHowTo: "Cómo pagar", tool: payWith("es", "Tarjeta"), supply: "Número de teléfono de 10 dígitos" };

const en = (o: {
  key: HtpPage["key"]; name: string; slug: string; checkout: string; title: string; description: string; h1: string;
  step3: string; faq2: HtpFaq; autoPayA: string; autoPayBody: string; related: Array<[string, string]>; an: string;
}): HtpPage => ({
  key: o.key, lang: "en", path: `/how-to-pay/${o.key}`, enPath: `/how-to-pay/${o.key}`, esPath: `/es/como-pagar/${o.key}`,
  carrierSlug: o.slug, carrierName: o.name, checkoutPath: o.checkout, title: o.title, description: o.description, h1: o.h1,
  intro: `To pay your ${o.name} bill online without logging in, go to CellPay's ${o.name} page, enter the 10-digit ${o.name} phone number, pick your amount or plan, and pay with ${PAY_EN}. The service fee is shown before you pay, and most payments post within a few minutes (up to 30 minutes). CellPay is an independent payment service, not ${o.name}; you can also pay ${o.name} directly on its official site.`,
  steps: [
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
    { q: `Can I pay ${o.name} online without logging in?`, a: `Yes. On CellPay you enter the ${o.name} phone number, choose the amount or plan, and pay. You don't need ${o.an} ${o.name} login or a CellPay account. CellPay is an independent payment service, not ${o.name}.` },
    o.faq2,
    { q: `How fast does ${o.key === "att-prepaid" ? "an" : "a"} ${o.name} payment through CellPay post?`, a: "Most payments post within a few minutes, but it can take up to 30 minutes for a refill to show on the account. If it hasn't posted after 30 minutes, email support@getcellpay.com with your phone number and transaction details. You see a confirmation with your transaction details once the payment goes through." },
    { q: `Is there a fee to pay ${o.name} on CellPay?`, a: "Yes, a service fee applies. The service fee is shown in the order summary before you pay, so you see the full total first. Taxes and fees can vary by location." },
    { q: "What payment methods can I use?", a: METHODS_EN },
    { q: `Can I pay someone else's ${o.name} phone?`, a: `Yes. You only need their ${o.name} phone number. The charge goes on your payment method, not their account. Double-check the number, because all CellPay payments are final: a payment sent to a wrong number can't be refunded or cancelled.` },
    { q: `Can I set up automatic ${o.name} payments?`, a: o.autoPayA },
    { q: `What do I need to pay my ${o.name} bill?`, a: `Only the 10-digit ${o.name} phone number, the amount or plan you want, and a payment method. You don't need a carrier login, a CellPay account or the account holder's password.` },
  ],
  disclaimer: `CellPay is an independent payment service and is not affiliated with ${o.name}.`,
  updated: "Last updated: October 7, 2026",
  related: o.related,
  labels: { ...LABELS_EN, payNow: `Pay ${o.name} now`, other: `Other ways to pay ${o.name}` },
});

const es = (o: {
  key: HtpPage["key"]; name: string; slug: string; checkout: string; title: string; description: string; h1: string;
  step3: string; faq2: HtpFaq; autoPayA: string; autoPayBody: string; related: Array<[string, string]>;
}): HtpPage => ({
  key: o.key, lang: "es", path: `/es/como-pagar/${o.key}`, enPath: `/how-to-pay/${o.key}`, esPath: `/es/como-pagar/${o.key}`,
  carrierSlug: o.slug, carrierName: o.name, checkoutPath: o.checkout, title: o.title, description: o.description, h1: o.h1,
  intro: `Para pagar su factura de ${o.name} en línea sin iniciar sesión, vaya a la página de ${o.name} de CellPay, ingrese el número de teléfono de ${o.name} de 10 dígitos, elija el monto o el plan y pague con ${PAY_ES}. El cargo por servicio se muestra antes de pagar y la mayoría de los pagos se acreditan en pocos minutos (hasta 30 minutos). CellPay es un servicio de pago independiente, no ${o.name}; también puede pagar directamente en el sitio oficial de ${o.name}.`,
  steps: [
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
    { q: `¿Puedo pagar ${o.name} en línea sin iniciar sesión?`, a: `Sí. En CellPay ingresa el número de teléfono de ${o.name}, elige el monto o el plan y paga. No necesita una cuenta de ${o.name} ni una cuenta de CellPay. CellPay es un servicio de pago independiente, no ${o.name}.` },
    o.faq2,
    { q: `¿Cuánto tarda en acreditarse un pago de ${o.name} hecho en CellPay?`, a: "La mayoría de los pagos se acreditan en pocos minutos, pero la recarga puede tardar hasta 30 minutos en aparecer en la cuenta. Si no se ha acreditado después de 30 minutos, escriba a support@getcellpay.com con su número de teléfono y los datos de la transacción. Cuando el pago se completa, verá una confirmación con los datos de su transacción." },
    { q: `¿Hay un cargo por pagar ${o.name} en CellPay?`, a: "Sí, se aplica un cargo por servicio. El cargo por servicio se muestra en el resumen del pedido antes de pagar, así que ve el total completo primero. Los impuestos y cargos pueden variar según la ubicación." },
    { q: "¿Qué métodos de pago puedo usar?", a: METHODS_ES },
    { q: `¿Puedo pagar el teléfono ${o.name} de otra persona?`, a: `Sí. Solo necesita su número de teléfono de ${o.name}. El cargo se hace a su método de pago, no a la cuenta de esa persona. Verifique bien el número, porque todos los pagos en CellPay son definitivos: un pago enviado a un número equivocado no se puede reembolsar ni cancelar.` },
    { q: `¿Puedo programar pagos automáticos de ${o.name}?`, a: o.autoPayA },
    { q: `¿Qué necesito para pagar mi factura de ${o.name}?`, a: `Solo el número de teléfono de ${o.name} de 10 dígitos, el monto o el plan que desea y un método de pago. No necesita una cuenta del operador, una cuenta de CellPay ni la contraseña del titular de la cuenta.` },
  ],
  disclaimer: `CellPay es un servicio de pago independiente y no está afiliado a ${o.name}.`,
  updated: "Última actualización: 7 de octubre de 2026",
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
    related: [["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], ["/straight-talk.html", "Straight Talk refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
  }),
  es({
    key: "straight-talk", name: "Straight Talk", slug: "straight-talk", checkout: "/es/straight-talk.html",
    title: "Cómo Pagar su Factura de Straight Talk en Línea (Sin Iniciar Sesión) | CellPay",
    description: `Pague Straight Talk en línea sin iniciar sesión: ingrese el número, elija un plan y pague con ${payWith("es")}.`,
    h1: "Cómo Pagar su Factura de Straight Talk en Línea (Sin Iniciar Sesión)",
    step3: "Elija un plan de la lista en la página de CellPay.",
    faq2: { q: "¿Puedo recargar Straight Talk sin la aplicación de Straight Talk?", a: "Straight Talk ofrece sus propias opciones de recarga en su sitio web oficial y en su aplicación. En CellPay puede recargar desde cualquier dispositivo solo con el número de teléfono." },
    autoPayA: "Si CellPay ofrece Auto Pago al pagar, puede activarlo ahí; nunca está marcado de antemano. Puede cancelarlo en cualquier momento con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "Si CellPay ofrece Auto Pago al pagar, puede activarlo ahí; nunca está marcado de antemano. Puede cancelarlo en cualquier momento con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], ["/es/straight-talk.html", "Recarga Straight Talk"], ["/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
  }),
  en({
    key: "att-prepaid", name: "AT&T Prepaid", slug: "topup-at", checkout: "/topup-at.html", an: "an",
    title: "How to Pay Your AT&T Prepaid Bill Online Without Signing In | CellPay",
    description: `AT&T Prepaid pay bill online without signing in: enter the number, pick an amount and pay by ${payWith("en", "card")}.`,
    h1: "How to Pay Your AT&T Prepaid Bill Online Without Signing In",
    step3: "Choose a plan from the list or enter a custom amount.",
    faq2: { q: "Does AT&T have its own way to pay prepaid without signing in?", a: "AT&T offers its own payment options on its official website and app. CellPay is another option if you want to pay without an AT&T login, with " + payWallets("en") + "." },
    autoPayA: "Yes. CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq. Payments already made can't be refunded.",
    autoPayBody: "CellPay offers optional Auto Pay that you can turn on at checkout; it's never pre-checked. You can cancel it anytime with 'Unsubscribe From Autopay' on cellpay.us/faq.",
    related: [["/how-to-pay/straight-talk", "How to pay Straight Talk"], ["/topup-at.html", "AT&T Prepaid refill"], ["/how-to-use", "How to use CellPay"], ["/faq", "FAQ"], ["/returns-policy", "Returns & Refunds Policy"]],
  }),
  es({
    key: "att-prepaid", name: "AT&T Prepaid", slug: "topup-at", checkout: "/es/topup-at.html",
    title: "Cómo Pagar su Factura de AT&T Prepaid en Línea Sin Iniciar Sesión | CellPay",
    description: `Pague AT&T Prepaid en línea sin iniciar sesión: ingrese el número, elija el monto y pague con ${payWith("es")}.`,
    h1: "Cómo Pagar su Factura de AT&T Prepaid en Línea Sin Iniciar Sesión",
    step3: "Elija un plan de la lista o ingrese un monto personalizado.",
    faq2: { q: "¿AT&T tiene su propia forma de pagar el servicio prepagado sin iniciar sesión?", a: "AT&T ofrece sus propias opciones de pago en su sitio web oficial y en su aplicación. CellPay es otra opción si quiere pagar sin una cuenta de AT&T, con " + payWallets("es") + "." },
    autoPayA: "Sí. CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo en cualquier momento con 'Unsubscribe From Autopay' en cellpay.us/faq. Los pagos ya realizados no se pueden reembolsar.",
    autoPayBody: "CellPay ofrece Auto Pago opcional que puede activar al pagar; nunca está marcado de antemano. Puede cancelarlo en cualquier momento con 'Unsubscribe From Autopay' en cellpay.us/faq.",
    related: [["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], ["/es/topup-at.html", "Recarga AT&T Prepaid"], ["/how-to-use", "Cómo usar CellPay"], ["/faq", "Preguntas frecuentes"], ["/returns-policy", "Política de devoluciones y reembolsos"]],
  }),
];

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
          { "@type": "ListItem", position: 1, name: "CellPay", item: `${WWW}/` },
          { "@type": "ListItem", position: 2, name: pg.labels.breadcrumbHowTo, item: `${WWW}/how-to-use` },
          { "@type": "ListItem", position: 3, name: pg.carrierName, item: url },
        ],
      },
    ],
    dateModified: UPDATED_ISO,
  }).replace(/</g, "\\u003c");
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Static first render for raw HTML (crawlers / no JS). React replaces #root on mount with the same content.
export const howToPayStaticHtml = (pg: HtpPage): string =>
  `<div id="root"><main role="main" data-htp-static="1" style="font-family:'Open Sans',system-ui,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#0f172a;line-height:1.55">` +
  `<h1 style="font-size:28px;line-height:1.25;font-weight:800;margin:0 0 16px">${esc(pg.h1)}</h1>` +
  `<p>${esc(pg.intro)}</p>` +
  `<p><a href="${pg.checkoutPath}">${esc(pg.labels.payNow)}</a></p>` +
  `<h2>${esc(pg.labels.steps)}</h2><ol>` + pg.steps.map((s, i) => `<li id="step-${i + 1}"><strong>${esc(s.name)}.</strong> ${esc(s.text)}</li>`).join("") + `</ol>` +
  `<h2>${esc(pg.labels.need)}</h2><ul>` + pg.need.map((n) => `<li>${esc(n)}</li>`).join("") + `</ul>` +
  `<h2>${esc(pg.labels.fees)}</h2><table><thead><tr><th>${esc(pg.labels.item)}</th><th>${esc(pg.labels.amount)}</th></tr></thead><tbody>` +
  pg.feeRows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("") + `</tbody></table><p><small>${esc(pg.feeNote)}</small></p>` +
  `<h2>${esc(pg.labels.other)}</h2><p>${esc(pg.otherWays)}</p>` +
  `<h2>${esc(pg.someoneElseTitle)}</h2><p>${esc(pg.someoneElse)}</p>` +
  `<h2>${esc(pg.autoPayTitle)}</h2><p>${esc(pg.autoPay)} <a href="${pg.checkoutPath}">${esc(pg.labels.payNow)}</a></p>` +
  `<h2>${esc(pg.labels.faq)}</h2>` + pg.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("") +
  `<p><small>${esc(pg.disclaimer)}</small></p><p><small>${esc(pg.updated)}</small></p>` +
  `<h2>${esc(pg.labels.related)}</h2><ul>` + pg.related.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join("") + `</ul>` +
  `</main></div>`;
