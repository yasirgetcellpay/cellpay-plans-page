// PRIVACY-1007: CellPay privacy policy, English (/privacy-policy) and Spanish (/es/privacy-policy).
// Single source for the React page (src/pages/PrivacyPolicy.tsx) AND the static raw HTML emitted by vite.config.ts,
// so the policy text in the raw HTML and on screen stays word for word identical. No imports: vite.config.ts loads this file.
// Legal text: change only with Parvez's OK. Oct 7, 2026 update (Parvez approved): section 2 ads line, section 3 sharing text,
// section 6 ads opt-out, new Effective Date, Spanish version.

export type PpLang = "en" | "es";
export type PpInline = string | { strong: string } | { href: string; text: string };
export type PpBlock = { p: PpInline[] } | { ul: PpInline[][] };
export type PpSection = { h: string; blocks: PpBlock[] };
export type PpPage = {
  lang: PpLang;
  path: string;
  title: string;
  description: string;
  h1: string;
  effectiveLabel: string;
  effectiveDate: string;
  sections: PpSection[];
};

const EMAIL = "support@getcellpay.com";
const AD_CENTER = "https://myadcenter.google.com";

export const PRIVACY_PAGES: Record<PpLang, PpPage> = {
  en: {
    lang: "en",
    path: "/privacy-policy",
    title: "Privacy Policy — CellPay",
    description:
      "How CellPay collects, uses, and protects customer information when you purchase a prepaid mobile refill: data we collect, how we share it, and your choices.",
    h1: "Privacy Policy",
    effectiveLabel: "Effective Date:",
    effectiveDate: "October 7, 2026",
    sections: [
      {
        h: "1. Information We Collect",
        blocks: [
          { p: ["When you use CellPay, we may collect the following information:"] },
          {
            ul: [
              ["Phone number (for processing your refill)"],
              ["Email address (to contact you about your order and for support)"],
              ["Payment information (Card payments are processed by our third-party payment processors. If you choose to save a card, it is stored securely for your future payments.)"],
              ["Transaction history (order amounts, carriers, dates)"],
            ],
          },
        ],
      },
      {
        h: "2. How We Use Your Information",
        blocks: [
          {
            ul: [
              ["To process and complete your prepaid refill transactions"],
              ["To contact you about your order"],
              ["To provide customer support"],
              ["To improve our services and user experience"],
              ["To show you relevant CellPay ads and offers, and to avoid showing you ads for services you already use."],
            ],
          },
        ],
      },
      {
        h: "3. Information Sharing",
        blocks: [
          { p: ["We do not sell your personal information. We share it only with: payment processors to complete your payment; carrier networks to send your refill; service providers that work for us, including advertising partners like Google. We may send them your email or phone number in a protected (encrypted/hashed) form so they can show you relevant CellPay ads or leave you out of ads you don't need. They may use it only to provide these services to us. We also share information with law enforcement when the law requires it."] },
        ],
      },
      {
        h: "4. Data Security",
        blocks: [
          { p: ["We use industry-standard encryption (SSL/TLS) to protect your data during transmission. Payment information is handled by our third-party payment processors."] },
        ],
      },
      {
        h: "5. Cookies",
        blocks: [
          { p: ["We use essential cookies to maintain your session and improve site functionality. We and our partners (such as Google) use cookies and similar technologies for analytics and advertising."] },
        ],
      },
      {
        h: "6. Your Rights",
        blocks: [
          { p: ["You may request access to, correction of, or deletion of your personal data by contacting us at support@getcellpay.com."] },
          {
            p: [
              "You can ask us at any time to stop using your email or phone number for ads. Email ",
              { href: `mailto:${EMAIL}?subject=Ads%20opt-out`, text: EMAIL },
              ' with the subject "Ads opt-out" and we will remove you within 30 days. You can also control Google ads at ',
              { href: AD_CENTER, text: "myadcenter.google.com" },
              ".",
            ],
          },
        ],
      },
      {
        h: "7. Contact",
        blocks: [{ p: ["For privacy-related inquiries, email us at ", { strong: EMAIL }, "."] }],
      },
    ],
  },
  es: {
    lang: "es",
    path: "/es/privacy-policy",
    title: "Política de Privacidad — CellPay",
    description:
      "Cómo CellPay recopila, usa y protege la información de sus clientes cuando compra una recarga prepagada: qué datos recopilamos, cómo los compartimos y sus opciones.",
    h1: "Política de Privacidad",
    effectiveLabel: "Fecha de vigencia:",
    effectiveDate: "7 de octubre de 2026",
    sections: [
      {
        h: "1. Información que recopilamos",
        blocks: [
          { p: ["Cuando usa CellPay, podemos recopilar la siguiente información:"] },
          {
            ul: [
              ["Número de teléfono (para procesar su recarga)"],
              ["Correo electrónico (para comunicarnos con usted sobre su pedido y para darle soporte)"],
              ["Información de pago (Los pagos con tarjeta los procesan nuestros procesadores de pago externos. Si decide guardar una tarjeta, se guarda de forma segura para sus pagos futuros.)"],
              ["Historial de transacciones (montos de los pedidos, operadores y fechas)"],
            ],
          },
        ],
      },
      {
        h: "2. Cómo usamos su información",
        blocks: [
          {
            ul: [
              ["Para procesar y completar sus recargas prepagadas"],
              ["Para comunicarnos con usted sobre su pedido"],
              ["Para darle soporte al cliente"],
              ["Para mejorar nuestros servicios y su experiencia en el sitio"],
              ["Para mostrarle anuncios y ofertas relevantes de CellPay, y para evitar mostrarle anuncios de servicios que ya usa."],
            ],
          },
        ],
      },
      {
        h: "3. Información que compartimos",
        blocks: [
          { p: ["No vendemos su información personal. Solo la compartimos con: procesadores de pago para completar su pago; redes de operadores para enviar su recarga; proveedores de servicios que trabajan para nosotros, incluidos socios de publicidad como Google. Podemos enviarles su correo electrónico o número de teléfono de forma protegida (cifrada) para que le muestren anuncios relevantes de CellPay o no le muestren anuncios que no necesita. Solo pueden usarla para darnos estos servicios. También compartimos información con las autoridades cuando la ley lo exige."] },
        ],
      },
      {
        h: "4. Seguridad de los datos",
        blocks: [
          { p: ["Usamos cifrado estándar de la industria (SSL/TLS) para proteger sus datos mientras se envían. La información de pago la manejan nuestros procesadores de pago externos."] },
        ],
      },
      {
        h: "5. Cookies",
        blocks: [
          { p: ["Usamos cookies esenciales para mantener su sesión y para que el sitio funcione mejor. Nosotros y nuestros socios (como Google) usamos cookies y tecnologías similares para análisis y publicidad."] },
        ],
      },
      {
        h: "6. Sus derechos",
        blocks: [
          { p: ["Puede pedir ver, corregir o borrar sus datos personales escribiéndonos a support@getcellpay.com."] },
          {
            p: [
              "Puede pedirnos en cualquier momento que dejemos de usar su correo electrónico o número de teléfono para anuncios. Escriba a ",
              { href: `mailto:${EMAIL}?subject=No%20anuncios`, text: EMAIL },
              ' con el asunto "No anuncios" y lo eliminaremos en un plazo de 30 días. También puede controlar los anuncios de Google en ',
              { href: AD_CENTER, text: "myadcenter.google.com" },
              ".",
            ],
          },
        ],
      },
      {
        h: "7. Contacto",
        blocks: [{ p: ["Si tiene preguntas sobre privacidad, escríbanos a ", { strong: EMAIL }, "."] }],
      },
    ],
  },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isExternal = (href: string) => href.startsWith("http");
const inlineHtml = (x: PpInline): string =>
  typeof x === "string"
    ? esc(x)
    : "strong" in x
    ? `<strong>${esc(x.strong)}</strong>`
    : `<a href="${esc(x.href)}" class="underline"${isExternal(x.href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(x.text)}</a>`;

// Static <main> for the raw HTML (crawlers / before the app code runs). Same tags and classes as PrivacyPolicy.tsx,
// so the text sits in the same place when React mounts.
export const privacyMainHtml = (pg: PpPage): string =>
  `<main class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">` +
  `<h1 class="text-3xl font-extrabold text-foreground mb-6">${esc(pg.h1)}</h1>` +
  `<div class="space-y-5 text-muted-foreground leading-relaxed text-sm">` +
  `<p><strong class="text-foreground">${esc(pg.effectiveLabel)}</strong> ${esc(pg.effectiveDate)}</p>` +
  pg.sections
    .map(
      (s) =>
        `<h2 class="text-lg font-bold text-foreground pt-3">${esc(s.h)}</h2>` +
        s.blocks
          .map((b) =>
            "p" in b
              ? `<p>${b.p.map(inlineHtml).join("")}</p>`
              : `<ul class="list-disc list-inside space-y-1">${b.ul.map((li) => `<li>${li.map(inlineHtml).join("")}</li>`).join("")}</ul>`,
          )
          .join(""),
    )
    .join("") +
  `</div></main>`;
