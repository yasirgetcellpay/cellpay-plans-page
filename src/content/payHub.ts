// ES-FIRST-1014: Spanish-first bill-pay hub (/es/paga-tu-factura) + EN twin (/pay-your-phone-bill).
// One source for the page (src/pages/PayHub.tsx) and the static raw HTML + JSON-LD (vite.config.ts).
// Relative imports only (vite.config.ts loads this file; the "@/" alias is not available there).
import { payWith } from "./paymentMethods";

export type HubLang = "en" | "es";
const WWW = "https://www.cellpay.us";
export const HUB_PATHS = { es: "/es/paga-tu-factura", en: "/pay-your-phone-bill" } as const;

export type HubPage = {
  lang: HubLang;
  path: string;
  altPath: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  phoneLabel: string;
  phoneHelp: string;
  carriersTitle: string;
  carriers: { name: string; href: string }[];
  methodsTitle: string;
  methods: string;
  fee: string;
  guidesTitle: string;
  guides: { name: string; href: string }[];
  faqTitle: string;
  faqs: { q: string; a: string }[];
  home: string;
  homePath: string;
  crumb: string;
};

const CARRIERS = (es: boolean) => {
  const p = es ? "/es" : "";
  return [
    { name: "Boost Mobile", href: `${p}/boost.html` },
    { name: "Metro by T-Mobile", href: `${p}/metropcs.html` },
    { name: "Cricket Wireless", href: `${p}/topup-crc.html` },
    { name: "Simple Mobile", href: `${p}/s1.html` },
    { name: "T-Mobile Prepaid", href: `${p}/tmobile-flexi.html` },
    { name: "AT&T Prepaid", href: `${p}/topup-at.html` },
  ];
};

const GUIDES = (es: boolean) => {
  const p = es ? "/es/como-pagar/" : "/how-to-pay/";
  return [
    { name: "Boost Mobile", href: `${p}boost-mobile` },
    { name: "Metro by T-Mobile", href: `${p}metro-pcs` },
    { name: "Cricket Wireless", href: `${p}cricket` }, // CRICKET-GUIDE-1014
    { name: "Simple Mobile", href: `${p}simple-mobile` },
    { name: "T-Mobile Prepaid", href: `${p}t-mobile-prepaid` },
    { name: "AT&T Prepaid", href: `${p}att-prepaid` },
  ];
};

export const HUB_PAGES: Record<HubLang, HubPage> = {
  es: {
    lang: "es",
    path: HUB_PATHS.es,
    altPath: HUB_PATHS.en,
    title: "Pague su factura de celular en 1 minuto | CellPay", // BILLPAY-METRO-1021
    description:
      "Pague su factura Boost, Metro, Cricket, Simple, T-Mobile o AT&T con solo el número. Sin cuenta. Tarjeta, Cash App, Pay by Bank y más.", // BILLPAY-METRO-1021
    h1: "Pague su factura Boost, Metro, Cricket o Simple en 1 minuto", // BILLPAY-METRO-1021
    intro: "Solo necesita el número de 10 dígitos. Sin cuenta y sin contraseña de la compañía.",
    phoneLabel: "Número de teléfono",
    phoneHelp: "Escriba el número y elija su compañía.",
    carriersTitle: "Elija su compañía",
    carriers: CARRIERS(true),
    methodsTitle: "Métodos de pago",
    methods: `Pague con ${payWith("es")}.`,
    fee: "El cargo por servicio se muestra antes de pagar.",
    guidesTitle: "¿Cómo pagar?",
    guides: GUIDES(true),
    faqTitle: "Preguntas frecuentes",
    faqs: [
      { q: "¿Necesito cuenta?", a: "No. Solo escriba el número de teléfono y pague. No necesita cuenta ni contraseña." },
      { q: "¿Qué métodos de pago?", a: `Puede pagar con ${payWith("es")}.` },
      { q: "¿Cuándo se aplica el pago?", a: "Por lo general en pocos minutos después de que se aprueba el pago." },
    ],
    home: "Inicio",
    homePath: "/es",
    crumb: "Pague su factura", // BILLPAY-METRO-1021
  },
  en: {
    lang: "en",
    path: HUB_PATHS.en,
    altPath: HUB_PATHS.es,
    title: "Pay Your Phone Bill in 1 Minute | CellPay",
    description:
      "Pay your Boost, Metro, Cricket, Simple, T-Mobile or AT&T bill with just the number. No account. Card, Cash App, Pay by Bank and more.",
    h1: "Pay your Boost, Metro, Cricket or Simple bill in 1 minute",
    intro: "All you need is the 10-digit number. No account and no carrier password.",
    phoneLabel: "Phone number",
    phoneHelp: "Type the number and pick your carrier.",
    carriersTitle: "Pick your carrier",
    carriers: CARRIERS(false),
    methodsTitle: "Payment methods",
    methods: `Pay with ${payWith("en")}.`,
    fee: "Service fee shown before you pay.",
    guidesTitle: "How to pay",
    guides: GUIDES(false),
    faqTitle: "Common questions",
    faqs: [
      { q: "Do I need an account?", a: "No. Just enter the phone number and pay. No account or password needed." },
      { q: "What payment methods?", a: `You can pay with ${payWith("en")}.` },
      { q: "When does the payment post?", a: "Usually within minutes after the payment is approved." },
    ],
    home: "Home",
    homePath: "/",
    crumb: "Pay your phone bill",
  },
};

export const hubByPath = (p: string): HubPage | null => {
  const clean = p.replace(/\/+$/, "") || "/";
  return clean === HUB_PATHS.es ? HUB_PAGES.es : clean === HUB_PATHS.en ? HUB_PAGES.en : null;
};

export const hubJsonLd = (pg: HubPage): string =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${WWW}/#organization`, name: "CellPay", url: `${WWW}/` },
      {
        "@type": "WebPage",
        "@id": `${WWW}${pg.path}#webpage`,
        url: `${WWW}${pg.path}`,
        name: pg.title,
        description: pg.description,
        inLanguage: pg.lang,
        publisher: { "@id": `${WWW}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: pg.home, item: `${WWW}${pg.homePath}` },
          { "@type": "ListItem", position: 2, name: pg.crumb, item: `${WWW}${pg.path}` },
        ],
      },
      {
        "@type": "FAQPage",
        inLanguage: pg.lang,
        mainEntity: pg.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  }).replace(/</g, "\\u003c");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Static first screen for the raw HTML (same text as PayHub.tsx). */
export const hubStaticHtml = (pg: HubPage): string =>
  `<div id="root"><main lang="${pg.lang}" style="max-width:768px;margin:0 auto;padding:32px 20px;font-family:'Open Sans',system-ui,sans-serif;line-height:1.6">` +
  `<h1 style="font-size:28px;font-weight:800;line-height:1.2;margin:0 0 12px">${esc(pg.h1)}</h1>` +
  `<p>${esc(pg.intro)}</p>` +
  `<h2 style="font-size:20px;font-weight:800;margin:24px 0 8px">${esc(pg.carriersTitle)}</h2><ul>` +
  pg.carriers.map((c) => `<li><a href="${c.href}">${esc(c.name)}</a></li>`).join("") +
  `</ul><h2 style="font-size:20px;font-weight:800;margin:24px 0 8px">${esc(pg.methodsTitle)}</h2><p>${esc(pg.methods)} ${esc(pg.fee)}</p>` +
  `<h2 style="font-size:20px;font-weight:800;margin:24px 0 8px">${esc(pg.guidesTitle)}</h2><ul>` +
  pg.guides.map((g) => `<li><a href="${g.href}">${esc(g.name)}</a></li>`).join("") +
  `</ul><h2 style="font-size:20px;font-weight:800;margin:24px 0 8px">${esc(pg.faqTitle)}</h2>` +
  pg.faqs.map((f) => `<h3 style="font-size:16px;font-weight:700;margin:12px 0 4px">${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("") +
  `</main></div>`;
