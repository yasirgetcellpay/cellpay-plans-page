// SWITCHER-1014: carrier-switcher pages (/switched-to-boost, /es/cambiaste-a-boost, /switched-to-metro, /es/cambiaste-a-metro).
// One source for the page (src/pages/Switcher.tsx) and the static raw HTML + JSON-LD (vite.config.ts).
// Relative imports only (vite.config.ts loads this file; the "@/" alias is not available there).
import { payWith } from "./paymentMethods";

export type SwLang = "en" | "es";
const WWW = "https://www.cellpay.us";

export type SwPage = {
  lang: SwLang;
  path: string;
  altPath: string;
  enPath: string;
  esPath: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  steps: string[];
  cta: string;
  ctaHref: string;
  methodsTitle: string;
  methods: string;
  fee: string;
  guide: string;
  guideHref: string;
  faqTitle: string;
  faqs: { q: string; a: string }[];
  home: string;
  homePath: string;
  crumb: string;
};

type Carrier = { name: string; short: string; en: string; es: string; page: string; guide: string };
const CARRIERS: Carrier[] = [
  { name: "Boost Mobile", short: "Boost", en: "/switched-to-boost", es: "/es/cambiaste-a-boost", page: "/boost.html", guide: "boost-mobile" },
  { name: "Metro PCS", short: "Metro", en: "/switched-to-metro", es: "/es/cambiaste-a-metro", page: "/metropcs.html", guide: "metro-pcs" },
];

const build = (c: Carrier, lang: SwLang): SwPage => {
  const es = lang === "es";
  const base = { lang, enPath: c.en, esPath: c.es, path: es ? c.es : c.en, altPath: es ? c.en : c.es };
  if (es) {
    return {
      ...base,
      title: `¿Te cambiaste a ${c.name}? Paga tu factura | CellPay`,
      description: `¿Vienes de Simple Mobile, T-Mobile u otra compañía? Paga tu factura de ${c.name} con solo el número. Sin cuenta. Cash App, Pay by Bank y más.`,
      h1: `¿Te cambiaste a ${c.name}? Paga tu factura aquí`,
      intro: `¿Vienes de Simple Mobile, T-Mobile u otra compañía? Tu número nuevo o el número que trajiste funciona igual. No necesitas cuenta de ${c.name}.`,
      steps: ["Escribe el número de 10 dígitos.", "Elige un monto.", "Paga."],
      cta: `Pagar ${c.name}`,
      ctaHref: "/es" + c.page,
      methodsTitle: "Métodos de pago",
      methods: `Paga con ${payWith("es")}.`,
      fee: "El cargo por servicio se muestra antes de pagar.",
      guide: `Cómo pagar ${c.name}`,
      guideHref: `/es/como-pagar/${c.guide}`,
      faqTitle: "Preguntas frecuentes",
      faqs: [
        { q: `¿Puedo pagar mi número nuevo de ${c.short} en CellPay?`, a: `Sí. Escribe tu número de ${c.name}, elige un monto y paga.` },
        { q: `¿Necesito iniciar sesión en mi cuenta de ${c.short}?`, a: "No. Solo necesitas el número de teléfono. No necesitas cuenta ni contraseña." },
        { q: "¿Qué métodos de pago?", a: `Puedes pagar con ${payWith("es")}.` },
      ],
      home: "Inicio",
      homePath: "/es",
      crumb: `Te cambiaste a ${c.name}`,
    };
  }
  return {
    ...base,
    title: `Switched to ${c.name}? Pay Your Bill Here | CellPay`,
    description: `Came from Simple Mobile, T-Mobile or another carrier? Pay your ${c.name} bill with just the number. No account. Cash App, Pay by Bank and more.`,
    h1: `Switched to ${c.name}? Pay your bill here`,
    intro: `Came from Simple Mobile, T-Mobile or another carrier? Your new number or moved number works the same. No ${c.name} account needed.`,
    steps: ["Enter the 10-digit number.", "Pick an amount.", "Pay."],
    cta: `Pay ${c.name}`,
    ctaHref: c.page,
    methodsTitle: "Payment methods",
    methods: `Pay with ${payWith("en")}.`,
    fee: "Service fee shown before you pay.",
    guide: `How to pay ${c.name}`,
    guideHref: `/how-to-pay/${c.guide}`,
    faqTitle: "Common questions",
    faqs: [
      { q: `Can I pay my new ${c.short} number on CellPay?`, a: `Yes. Enter your ${c.name} number, pick an amount and pay.` },
      { q: `Do I need a ${c.short} account login?`, a: "No. All you need is the phone number. No account or password needed." },
      { q: "What payment methods?", a: `You can pay with ${payWith("en")}.` },
    ],
    home: "Home",
    homePath: "/",
    crumb: `Switched to ${c.name}`,
  };
};

export const SW_PAGES: SwPage[] = CARRIERS.flatMap((c) => [build(c, "en"), build(c, "es")]);

export const swByPath = (p: string): SwPage | null => {
  const clean = p.replace(/\/+$/, "") || "/";
  return SW_PAGES.find((x) => x.path === clean) || null;
};

export const swJsonLd = (pg: SwPage): string =>
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
const H2 = `style="font-size:20px;font-weight:800;margin:24px 0 8px"`;

/** Static first screen for the raw HTML (same text as Switcher.tsx). */
export const swStaticHtml = (pg: SwPage): string =>
  `<div id="root"><main lang="${pg.lang}" style="max-width:768px;margin:0 auto;padding:32px 20px;font-family:'Open Sans',system-ui,sans-serif;line-height:1.6">` +
  `<h1 style="font-size:28px;font-weight:800;line-height:1.2;margin:0 0 12px">${esc(pg.h1)}</h1>` +
  `<p>${esc(pg.intro)}</p><ol>` +
  pg.steps.map((s) => `<li>${esc(s)}</li>`).join("") +
  `</ol><p><a href="${pg.ctaHref}" style="font-weight:800">${esc(pg.cta)}</a></p>` +
  `<h2 ${H2}>${esc(pg.methodsTitle)}</h2><p>${esc(pg.methods)} ${esc(pg.fee)}</p>` +
  `<p><a href="${pg.guideHref}">${esc(pg.guide)}</a></p>` +
  `<h2 ${H2}>${esc(pg.faqTitle)}</h2>` +
  pg.faqs.map((f) => `<h3 style="font-size:16px;font-weight:700;margin:12px 0 4px">${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("") +
  `</main></div>`;
