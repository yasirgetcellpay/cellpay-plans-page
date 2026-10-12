// LPX-1010 (SPEC-LPX-3): carrier-specific page text for the /go + /es/go ad landers, shared by GoLander.tsx (rendered) and vite.config.ts
// (raw HTML): the FAQ (moved here unchanged from GoLander.tsx), the "active line" sentence under the subline, and customer plan names
// for AT&T / Simple Mobile tiles. Display text only: no prices, no fee amounts, no plan IDs, no checkout values.
// Relative imports only (vite.config.ts loads this file).
import { payWith, CARD_BRANDS } from "./paymentMethods";
import { top4Name, refundFaq } from "./carrierHero";

export type GoPageLang = "en" | "es";

/** ADS-FOLLOWUPS-1008: ad-style carrier names for the /go FAQs + FAQPage JSON-LD (same name as each lander's H1). Checkout keeps the catalog name. */
export const GO_AD_NAMES: Record<string, string> = {
  boost: "Boost",
  metropcs: "Metro",
  s1: "Simple Mobile",
  "topup-crc": "Cricket",
  "topup-at": "AT&T Prepaid",
  "ultra-mobile": "Ultra Mobile",
  "straight-talk": "Straight Talk",
  lyca: "Lyca Mobile",
  h2o: "H2O Wireless",
  net10: "Net10",
  tmobile: "T-Mobile",
  verizon: "Verizon Prepaid",
  pageplus: "Page Plus",
  "total-wireless": "Total Wireless",
  tracfone: "Tracfone",
};

/** GO-COPY-1008: carrier-specific FAQs (also sent as FAQPage JSON-LD). True claims only: no refunds, no email-receipt claim, no fee amounts. */
export const goFaqsEn = (c: string) => [
  {
    q: `Can I pay my ${c} bill without signing in?`,
    a: `Yes. No account or login needed. Enter the ${c} phone number, pick the amount or plan, and pay as a guest.`,
  },
  {
    q: `Can I pay for someone else's ${c} line?`,
    a: `Yes. Enter their ${c} phone number, choose the amount or plan, and pay. The refill goes to that line.`,
  },
  {
    q: `Do I just need the ${c} phone number?`,
    a: `Yes. Enter the 10-digit phone number of the ${c} line you want to refill. Then pick the amount or plan and pay.`,
  },
  {
    q: `Do I need to call ${c} to pay?`,
    a: "No. You pay online on this page with the phone number. No phone call needed.",
  },
  {
    q: "How can I pay?",
    a: payWith("en", `Card (${CARD_BRANDS})`) + ". Apple Pay shows on supported Apple devices. The service fee is shown before you pay.",
  },
  {
    q: `How long does a ${c} refill take?`,
    a: "Most refills finish in a few minutes. Some can take up to 30 minutes.",
  },
  {
    q: "What if the payment fails?",
    a: "If it fails, your card was NOT charged. If you see a pending amount, your bank removes it in 1–2 days. You can try another card or payment method.",
  },
  {
    q: "How do I get help?",
    a: "Support: Monday–Friday 9:00 AM–6:00 PM (EST) · Saturday–Sunday 10:00 AM–4:00 PM (EST) · support@getcellpay.com",
  },
];

/** Very simple Spanish. Never "cualquier". No refunds / 24/7 / instant / authorized. */
export const goFaqsEs = (c: string) => [
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
  {
    q: "¿Qué pasa si el pago falla?",
    a: "Si falla, su tarjeta NO fue cobrada. Si ve un cargo pendiente, su banco lo quita en 1–2 días. Puede probar otra tarjeta u otra forma de pago.",
  },
  {
    q: "¿Cómo pido ayuda?",
    a: "Soporte: lunes–viernes 9:00 AM–6:00 PM (EST) · sábado–domingo 10:00 AM–4:00 PM (EST) · support@getcellpay.com",
  },
];

/** FAQ list exactly as the lander shows it (4 carriers also get the refund question). */
export const goFaqList = (slug: string, lang: GoPageLang, fallbackName = ""): Array<{ q: string; a: string }> => {
  const c = GO_AD_NAMES[slug] ?? fallbackName;
  const r = refundFaq(slug, lang);
  return [...(lang === "es" ? goFaqsEs(c) : goFaqsEn(c)), ...(r ? [r] : [])];
};

/** One sentence under the subline (same wording as the active-line note on the carrier pages, plus what happens next). */
export const goCarrierSentence = (slug: string, lang: GoPageLang, fallbackName = ""): string => {
  const c = top4Name(slug, lang) ?? GO_AD_NAMES[slug] ?? fallbackName;
  return lang === "es"
    ? `Use el número de 10 dígitos de una línea activa de ${c}. El pago se aplica a esa línea; verá el total, incluido el cargo por servicio, antes de pagar.`
    : `Use the 10-digit number of an active ${c} line. Payment posts to that line; you will see the total, including any service fee, before you pay.`;
};

/** Customer plan names (display only; amounts and IDs untouched). */
export const goTileName = (slug: string, lang: GoPageLang, highlight: string): string => {
  if (slug === "topup-at") {
    const m = /^AT&T RTR (\$\d+(?:\.\d+)?)\s*$/.exec(highlight.trim());
    if (m) return lang === "es" ? `Recarga AT&T Prepago ${m[1]}` : `AT&T Prepaid ${m[1]} Refill`;
  }
  if (slug === "s1" && /\b3[- ]?Month\b/i.test(highlight)) return lang === "es" ? "Plan Ilimitado de 3 meses" : "3-month Unlimited plan";
  return highlight;
};

const ROUTE_CARRIER: Record<string, string> = {
  att: "topup-at", tmobile: "tmobile", verizon: "verizon", cricket: "topup-crc", h2o: "h2o", "simple-mobile": "s1", metro: "metropcs",
  boost: "boost", ultra: "ultra-mobile", "straight-talk": "straight-talk", lyca: "lyca", net10: "net10", pageplus: "pageplus",
  totalwireless: "total-wireless", tracfone: "tracfone",
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Static shell: build route ("go/att.html", "es/go/att/index.html") -> carrierSlug + language, or null. */
export const goRouteInfo = (route: string): { slug: string; lang: GoPageLang } | null => {
  const m = /^(es\/)?go\/([a-z0-9-]+?)(?:\/index)?\.html$/.exec(route);
  const slug = m ? ROUTE_CARRIER[m[2]] : undefined;
  return m && slug ? { slug, lang: m[1] ? "es" : "en" } : null;
};

/** Raw HTML only: carrier sentence for the first screen (React renders the same text). */
export const goStaticSentence = (route: string): string => {
  const i = goRouteInfo(route);
  return i ? esc(goCarrierSentence(i.slug, i.lang)) : "";
};

/** Raw HTML only: "Common questions" with the answers, below the loading block (React replaces #root on load). */
export const goStaticFaqHtml = (route: string, color: string): string => {
  const i = goRouteInfo(route);
  if (!i) return "";
  return (
    `<section class="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8" data-go-static-faq="1">` +
    `<h2 class="text-xl sm:text-2xl font-extrabold text-foreground mb-4 text-left">${i.lang === "es" ? "Preguntas frecuentes" : "Common questions"}</h2>` +
    goFaqList(i.slug, i.lang).map((f) => `<div class="border-b py-4"><h3 class="font-bold text-foreground" style="color:${color}">${esc(f.q)}</h3><p class="text-muted-foreground mt-1">${esc(f.a)}</p></div>`).join("") +
    `</section>`
  );
};
