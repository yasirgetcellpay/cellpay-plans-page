// SEO-CONTENT-1014: pay-wording head, H1, short FAQ (4 Q) + FAQPage/BreadcrumbList JSON-LD for the bill-pay carrier pages
// /es/metropcs.html, /es/boost.html, /topup-crc.html and /es/topup-crc.html. Single source for DynamicCarrier.tsx (rendered page)
// AND vite.config.ts (raw HTML), so the visible FAQ and the FAQPage JSON-LD stay word for word identical.
// Wording rule (Metro, Boost, Cricket): pay/payment, pagar/pago only. No fee amounts. Relative imports only (vite.config.ts loads this).
import { methodsLong } from "./paymentMethods";

export type BillLang = "en" | "es";
export type BillFaq = { q: string; a: string };
export type BillPage = {
  path: string; // www path
  lang: BillLang;
  name: string;
  title?: string; // undefined = keep the page's existing title
  description: string;
  h1: string;
  sub: string;
  autoPayInfoLead: string; // first sentence of the Auto Pay info card
  enterAmount: string;
  securePayment: string;
  faqTitle: string;
  faqs: BillFaq[];
  guide?: [string, string]; // how-to-pay guide link (Metro, Boost; CRICKET-GUIDE-1014: + Cricket)
  more?: [string, string][]; // BILLPAY-BOOST-1022 extra internal links [href, label]
};

const WWW = "https://www.cellpay.us";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const faqsEn = (name: string): BillFaq[] => [
  { q: "Do I need an account to pay?", a: `No. You don't need a CellPay account or a ${name} login. Enter the 10-digit phone number, pick the amount and pay.` },
  { q: "What payment methods can I use?", a: methodsLong("en") },
  { q: "Can I pay for someone else?", a: `Yes. Enter their 10-digit ${name} phone number. Double-check the number before you pay.` },
  { q: "Is there a fee?", a: "Service fee shown before you pay." },
];

const faqsEs = (name: string): BillFaq[] => [
  { q: "¿Necesito una cuenta para pagar?", a: `No. No necesita una cuenta de CellPay ni iniciar sesión en ${name}. Ingrese el número de teléfono de 10 dígitos, elija el monto y pague.` },
  { q: "¿Qué métodos de pago puedo usar?", a: methodsLong("es") },
  { q: "¿Puedo pagar por otra persona?", a: `Sí. Ingrese su número de teléfono de ${name} de 10 dígitos. Revise bien el número antes de pagar.` },
  { q: "¿Hay un cargo?", a: "El cargo por servicio se muestra antes de pagar." },
];

const esPage = (path: string, name: string, guide?: [string, string]): BillPage => ({
  path, lang: "es", name,
  title: `Pague su factura de ${name} en línea | CellPay`,
  description: `Pague su factura de ${name} en línea, sin cuenta y sin iniciar sesión, también por otra persona. El cargo por servicio se muestra antes de pagar.`,
  h1: `Pague su factura de ${name} en línea, rápido y seguro`,
  sub: "Sin cuenta y sin iniciar sesión. Ingrese el número, elija el monto y pague.",
  autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.",
  enterAmount: "Ingrese el monto que desea pagar",
  securePayment: "Pago seguro. Su pago se aplica al número que ingresó.",
  faqTitle: "Preguntas frecuentes",
  faqs: faqsEs(name),
  guide,
});

// BILLPAY-METRO-1021
const metroFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [
  { q: "¿Cómo pago mi factura de Metro PCS en línea?", a: "Ingrese el número de Metro, elija el monto de su plan y pague. Toma alrededor de un minuto." },
  { q: "¿Puedo pagar Metro PCS como invitado?", a: "Sí. Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono." },
  { q: "¿Puedo pagar sin el PIN de la cuenta?", a: "Sí, el número de teléfono es suficiente." },
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` },
  { q: "¿Cuándo se aplica mi pago?", a: "Por lo general en pocos minutos. Recibe una confirmación en pantalla y por correo electrónico." },
  { q: "¿Puedo pagar la línea de Metro de otra persona?", a: "Sí, ingrese su número." },
] : [
  { q: "How do I pay my Metro PCS bill online?", a: "Enter the Metro phone number, pick the amount for your plan, and pay. It takes about a minute." },
  { q: "Can I pay Metro PCS as a guest?", a: "Yes. No account or login. You only need the phone number." },
  { q: "Can I pay without the account PIN?", a: "Yes, the phone number is enough." },
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en")}` },
  { q: "When does my payment post?", a: "Usually within minutes. You get a confirmation on screen and by email." },
  { q: "Can I pay for someone else's Metro line?", a: "Yes, enter their number." },
];

// BILLPAY-BOOST-1022
const boostFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [
  { q: "¿Cómo pago mi factura de Boost Mobile en línea?", a: "Ingrese el número de Boost, elija el monto de su plan y pague. Toma alrededor de un minuto." },
  { q: "¿Puedo pagar Boost como invitado?", a: "Sí. Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono." },
  { q: "¿Puedo pagar sin iniciar sesión en mi cuenta de Boost?", a: "Sí. No necesita su usuario ni su PIN de Boost. El número de teléfono es suficiente." },
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` },
  { q: "¿Cuándo se aplica mi pago?", a: "Por lo general en pocos minutos. Recibe una confirmación en pantalla y por correo electrónico." },
  { q: "Me cambié a Boost, ¿puedo pagar aquí?", a: "Sí. Si acaba de pasar su número a Boost, ingréselo y pague de la misma forma." },
] : [
  { q: "How do I pay my Boost Mobile bill online?", a: "Enter the Boost phone number, pick the amount for your plan, and pay. It takes about a minute." },
  { q: "Can I pay Boost as a guest?", a: "Yes. No account or login. You only need the phone number." },
  { q: "Can I pay without logging in to my Boost account?", a: "Yes. You don't need your Boost login or PIN. The phone number is enough." },
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en")}` },
  { q: "When does my payment post?", a: "Usually within minutes. You get a confirmation on screen and by email." },
  { q: "I switched to Boost — can I still pay here?", a: "Yes. If you just moved your number to Boost, enter it and pay the same way." },
];

const cricketFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-CRICKET-1023
  { q: "¿Cómo pago mi factura de Cricket en línea?", a: "Ingrese el número de teléfono de Cricket, elija su plan o monto y complete el pago en línea." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar Cricket como invitado, al estilo Quick Pay?", a: "Sí. Puede pagar como invitado solo con el número de teléfono de Cricket. No necesita una cuenta." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar sin iniciar sesión en Cricket?", a: "Sí. No necesita su usuario ni su contraseña de Cricket. Ingrese el número de la línea que desea pagar." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` }, // BILLPAY-CRICKET-1023
  { q: "¿Cuándo se aplica mi pago?", a: "Puede tardar hasta 30 minutos en verse reflejado en su cuenta." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar la línea de Cricket de un familiar?", a: "Sí. Ingrese el número de Cricket de su familiar y revise que sea correcto antes de pagar. El pago se aplica a esa línea." }, // BILLPAY-CRICKET-1023
  faqsEs("Cricket Wireless")[3], // BILLPAY-CRICKET-1023: preserve the existing fee question and answer exactly
] : [ // BILLPAY-CRICKET-1023
  { q: "How do I pay my Cricket bill online?", a: "Enter the Cricket phone number, choose your plan or amount, and complete your payment online." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay Cricket as a guest (Quick Pay style)?", a: "Yes. You can pay as a guest with just the Cricket phone number. No account is needed." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay without my Cricket login?", a: "Yes. You don't need your Cricket username or password. Enter the number of the line you want to pay." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-CRICKET-1023
  { q: "When does my payment post?", a: "It can take up to 30 min for a payment to reflect on your account." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay a family member's Cricket line?", a: "Yes. Enter your family member's Cricket number and double-check it before paying. The payment applies to their line." }, // BILLPAY-CRICKET-1023
  faqsEn("Cricket Wireless")[3], // BILLPAY-CRICKET-1023: preserve the existing fee question and answer exactly
]; // BILLPAY-CRICKET-1023

export const BILL_PAGES: BillPage[] = [
  { // BILLPAY-METRO-1021
    ...esPage("/es/metropcs.html", "Metro PCS", ["/es/como-pagar/metro-pcs", "Cómo pagar Metro by T-Mobile"]),
    title: "Pagar Factura Metro PCS en Línea sin Cuenta | CellPay",
    h1: "Pague su Factura de Metro by T-Mobile en Línea",
    sub: "Pague su línea de Metro PCS como invitado, solo con el número. Sin cuenta ni PIN.",
    faqs: metroFaqs("es"),
  },
  { // BILLPAY-METRO-1021
    path: "/metropcs.html", lang: "en", name: "Metro PCS",
    title: "Pay Metro PCS Bill Online as a Guest – No Login | CellPay",
    description: "Metro PCS pay bill online. Pay your Metro by T-Mobile prepaid bill with any card or wallet. No login needed. Service fee shown before you pay.",
    h1: "Pay Your Metro by T-Mobile Bill Online",
    sub: "Pay your Metro PCS bill as a guest with just the phone number. No login, no PIN.",
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: metroFaqs("en"),
    guide: ["/how-to-pay/metro-pcs", "How to pay Metro by T-Mobile"],
  },
  { // BILLPAY-BOOST-1022
    ...esPage("/es/boost.html", "Boost Mobile", ["/es/como-pagar/boost-mobile", "Cómo pagar Boost Mobile"]),
    title: "Pagar Factura Boost Mobile en Línea sin Cuenta | CellPay",
    h1: "Pague su Factura de Boost Mobile en Línea",
    sub: "Pague su plan de Boost como invitado, solo con el número. Sin cuenta.",
    faqs: boostFaqs("es"),
    more: [["/es/cambiaste-a-boost", "¿Se cambió a Boost Mobile?"], ["/es/paga-tu-factura", "Pague su factura de celular"]],
  },
  { // BILLPAY-BOOST-1022
    path: "/boost.html", lang: "en", name: "Boost Mobile",
    title: "Pay Boost Mobile Bill Online as a Guest – No Login | CellPay",
    description: "Pay your Boost Mobile bill online as a guest with just the phone number. No login needed. Service fee shown before you pay.",
    h1: "Pay Your Boost Mobile Bill Online",
    sub: "Pay your Boost Mobile bill as a guest with just the phone number. No login needed.",
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: boostFaqs("en"),
    guide: ["/how-to-pay/boost-mobile", "How to pay Boost Mobile"],
    more: [["/switched-to-boost", "Switched to Boost Mobile?"], ["/pay-your-phone-bill", "Pay your phone bill"]],
  },
  { // BILLPAY-CRICKET-1023
    ...esPage("/es/topup-crc.html", "Cricket Wireless", ["/es/como-pagar/cricket", "Cómo pagar Cricket Wireless"]), // BILLPAY-CRICKET-1023
    title: "Pagar Factura Cricket en Línea sin Cuenta | CellPay", // BILLPAY-CRICKET-1023
    h1: "Pague su Factura de Cricket Wireless en Línea", // BILLPAY-CRICKET-1023
    sub: "Pague su línea o plan de Cricket solo con el número. Sin cuenta.", // BILLPAY-CRICKET-1023
    faqs: cricketFaqs("es"), // BILLPAY-CRICKET-1023
    more: [["/es/paga-tu-factura", "Pague su factura de celular"]], // BILLPAY-CRICKET-1023
  }, // BILLPAY-CRICKET-1023
  { // BILLPAY-CRICKET-1023
    path: "/topup-crc.html", lang: "en", name: "Cricket Wireless",
    title: "Pay Cricket Bill Online – Quick Pay as a Guest | CellPay", // BILLPAY-CRICKET-1023
    description: "Cricket Quick Pay on CellPay: pay any Cricket Wireless bill online. No login needed. All major cards & wallets. Service fee shown before you pay.",
    h1: "Pay Your Cricket Wireless Bill Online", // BILLPAY-CRICKET-1023
    sub: "Pay your Cricket bill with just the phone number. No login, no account.", // BILLPAY-CRICKET-1023
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: cricketFaqs("en"), // BILLPAY-CRICKET-1023
    guide: ["/how-to-pay/cricket", "How to pay Cricket Wireless"], // CRICKET-GUIDE-1014
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-CRICKET-1023
  },
];

export const billPageByPath = (pathname: string): BillPage | undefined => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return BILL_PAGES.find((x) => x.path === p);
};

/** FAQPage + BreadcrumbList (Home › Carrier). Same FAQ text as the visible FAQ. */
export const billJsonLd = (pg: BillPage): string => {
  const url = WWW + pg.path;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: pg.lang,
        mainEntity: pg.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: pg.lang === "es" ? "Inicio" : "Home", item: pg.lang === "es" ? `${WWW}/es` : `${WWW}/` },
          { "@type": "ListItem", position: 2, name: pg.name, item: url },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");
};

/** Raw-HTML block below the first screen (same text as the rendered FAQ + guide link). */
export const billStaticBlock = (pg: BillPage): string =>
  `<section class="max-w-3xl mx-auto px-4 sm:px-6 py-10" data-bill-static="1">` +
  `<h2 class="text-2xl font-extrabold text-foreground mb-4 text-left">${esc(pg.faqTitle)}</h2>` +
  pg.faqs.map((f) => `<div class="mb-4 text-left"><h3 class="font-bold">${esc(f.q)}</h3><p class="text-sm text-muted-foreground mt-1">${esc(f.a)}</p></div>`).join("") +
  (pg.guide ? `<p class="text-sm mt-4"><a href="${pg.guide[0]}" class="underline">${esc(pg.guide[1])}</a></p>` : "") +
  (pg.more ? pg.more.map(([href, label]) => `<p class="text-sm mt-2"><a href="${href}" class="underline">${esc(label)}</a></p>`).join("") : "") + // BILLPAY-BOOST-1022
  `</section>`;
