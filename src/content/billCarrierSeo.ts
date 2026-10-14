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

export const BILL_PAGES: BillPage[] = [
  esPage("/es/metropcs.html", "Metro PCS", ["/es/como-pagar/metro-pcs", "Cómo pagar Metro by T-Mobile"]),
  esPage("/es/boost.html", "Boost Mobile", ["/es/como-pagar/boost-mobile", "Cómo pagar Boost Mobile"]),
  esPage("/es/topup-crc.html", "Cricket Wireless", ["/es/como-pagar/cricket", "Cómo pagar Cricket Wireless"]), // CRICKET-GUIDE-1014
  {
    path: "/topup-crc.html", lang: "en", name: "Cricket Wireless",
    // title kept: "Cricket Quick Pay — Pay Your Cricket Bill Online | CellPay"
    description: "Cricket Quick Pay on CellPay: pay any Cricket Wireless bill online. No login needed. All major cards & wallets. Service fee shown before you pay.",
    h1: "Pay Your Cricket Wireless Bill Online—Fast & Secure",
    sub: "No login needed. Enter your phone number, choose your plan, and pay.",
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: faqsEn("Cricket Wireless"),
    guide: ["/how-to-pay/cricket", "How to pay Cricket Wireless"], // CRICKET-GUIDE-1014
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
  `</section>`;
