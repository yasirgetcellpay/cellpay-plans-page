// SPA-SHELLS-1011: static first screen (the page's <main>) in the raw HTML of the info pages that were an empty #root:
// /about-us, /faq, /how-to-use, /es/how-to-use, /terms-and-conditions (same pattern as the privacy policy, PRIVACY-1007).
// vite.config.ts puts it under the same Navbar look as the privacy shell; React replaces it with the real page (same <main> markup, same
// classes), so nothing above the fold moves. Used ONLY by vite.config.ts; the pages themselves are unchanged.
// KEEP IN SYNC with src/pages/AboutUs.tsx, FAQ.tsx (questions), TermsAndConditions.tsx. /how-to-use renders from src/content/howToUse.ts, so it cannot drift.
// Relative imports only (vite.config.ts loads this file).
import { HOW_TO_USE } from "./howToUse";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MAIN = `<main class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">`;
const H1 = (t: string) => `<h1 class="text-3xl font-extrabold text-foreground mb-6">${esc(t)}</h1>`;

const ABOUT_P1 = "CellPay is an independent payment service for US prepaid phone plans. CellPay is a fast, reliable online platform for prepaid wireless top-ups and refills. We make it easy to recharge your phone from the comfort of your home — no store visits, no hassle.";
const ABOUT_P2 = "We support all major U.S. prepaid carriers including AT&T, T-Mobile, Verizon, Cricket, Metro, Boost Mobile, Straight Talk, TracFone, and many more. Whether you need a monthly plan refill or a quick data add-on, CellPay has you covered.";
const ABOUT_LIST = [
  "Online recharge — pay from your phone or computer",
  "Secure payments via credit/debit card and Apple Pay",
  "Customer support: Monday – Friday: 9:00 AM – 6:00 PM (EST); Saturday – Sunday: 10:00 AM – 4:00 PM (EST); support@getcellpay.com",
  "Low service fee shown before you pay",
  "Support for 15+ major prepaid carriers",
];
const ABOUT_P3 = "Our mission is to simplify the prepaid wireless experience. We believe staying connected should be easy, affordable, and accessible to everyone. CellPay bridges the gap between carriers and customers by providing a seamless digital refill experience.";
const ABOUT_P4 = "Founded with a customer-first approach, we're committed to delivering a smooth, trustworthy service that keeps you connected without interruption.";
const aboutMain = (): string =>
  MAIN + H1("About CellPay") + `<div class="space-y-5 text-muted-foreground leading-relaxed">` +
  `<p>${esc(ABOUT_P1)}</p><p>${esc(ABOUT_P2)}</p>` +
  `<h2 class="text-xl font-bold text-foreground pt-4">Why Choose CellPay?</h2>` +
  `<ul class="list-disc list-inside space-y-2">${ABOUT_LIST.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` +
  `<h2 class="text-xl font-bold text-foreground pt-4">Our Mission</h2><p>${esc(ABOUT_P3)}</p><p>${esc(ABOUT_P4)}</p></div></main>`;

const TERMS: Array<[string, string]> = [
  ["1. Acceptance of Terms", "By using CellPay, you agree to these Terms & Conditions. If you do not agree, please do not use our services."],
  ["2. Services", "CellPay provides an online platform for purchasing prepaid wireless refills and top-ups for supported U.S. carriers. We act as an authorized payment processor and are not affiliated with any wireless carrier."],
  ["3. Pricing & Fees", "All prices are displayed at the time of purchase. A service fee may be applied and will be shown before you confirm payment. Taxes and carrier-specific fees may vary by location."],
  ["4. Payment", "We accept Visa, Mastercard, American Express, Discover, Apple Pay, Google Pay, PayPal, Klarna, and Cash App. Payment is processed at the time of purchase. You are responsible for ensuring your payment method is valid and has sufficient funds."],
  ["5. Refills & Delivery", "Refills are processed promptly upon successful payment. You are responsible for entering the correct phone number. CellPay is not liable for refills sent to incorrect numbers."],
  ["6. No Refunds", "All prepaid refill purchases are final and non-refundable once processed. Please verify your phone number and plan selection before completing your purchase. If you have a problem with a payment, such as a duplicate charge, see our Returns & Refunds Policy for how to contact support."],
  ["7. Account Responsibility", "If you create an account, you are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized use."],
  ["8. Limitation of Liability", "CellPay is not liable for any carrier service outages, delays in refill processing by the carrier, or issues arising from incorrect information provided by the user."],
  ["9. Changes to Terms", "We reserve the right to update these terms at any time. Continued use of CellPay after changes constitutes acceptance of the updated terms."],
];
const termsMain = (): string =>
  MAIN + H1("Terms & Conditions") + `<div class="space-y-5 text-muted-foreground leading-relaxed text-sm">` +
  `<p><strong class="text-foreground">Effective Date:</strong> January 1, 2026</p>` +
  TERMS.map(([h, p]) => `<h2 class="text-lg font-bold text-foreground pt-3">${esc(h)}</h2><p>${esc(p)}</p>`).join("") +
  `<h2 class="text-lg font-bold text-foreground pt-3">10. Contact</h2><p>Questions about these terms? Email us at <strong>support@getcellpay.com</strong>.</p></div></main>`;

const howToUseMain = (lang: "en" | "es"): string => {
  const pg = HOW_TO_USE[lang];
  return (
    MAIN + H1(pg.h1) + `<p class="text-muted-foreground mb-8">${esc(pg.intro)}</p><div class="space-y-6">` +
    pg.steps.map((s) => `<div class="flex gap-4 items-start"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">${esc(s.num)}</div><div><h2 class="font-bold text-foreground text-lg">${esc(s.title)}</h2><p class="text-muted-foreground">${esc(s.desc)}</p></div></div>`).join("") +
    `</div><div class="mt-10 bg-card border border-border rounded-lg p-6"><h2 class="text-xl font-bold text-foreground mb-3">${esc(pg.tipsTitle)}</h2><ul class="list-disc list-inside space-y-2 text-muted-foreground">` +
    pg.tips.map((t) => `<li>${esc(t)}</li>`).join("") +
    `<li>${esc(pg.guidesLabel)}${pg.guides.map(([href, text], i) => `<span>${i > 0 ? " · " : ""}<a href="${href}" class="underline">${esc(text)}</a></span>`).join("")}</li></ul></div></main>`
  );
};

// FAQ: the accordion as React first renders it (every item closed: question rows only). Questions mirror src/pages/FAQ.tsx.
const FAQ_QS = [
  "What is CellPay?", "How does CellPay work?", "Which carriers does CellPay support?", "Is CellPay safe and secure?", "How long does a refill take?",
  "What payment methods do you accept?", "Do I need to create an account?", "Can I get a refund or cancel a payment?",
  "I didn't receive my refill. What should I do?", "Is CellPay affiliated with any carrier?",
];
const CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0 transition-transform duration-200"><path d="m6 9 6 6 6-6"></path></svg>`;
const faqMain = (): string =>
  MAIN + H1("Frequently Asked Questions") + `<div class="w-full" data-orientation="vertical">` +
  FAQ_QS.map((q) => `<div data-state="closed" data-orientation="vertical" class="border-b"><h3 data-orientation="vertical" data-state="closed" class="flex"><button type="button" aria-expanded="false" data-state="closed" data-orientation="vertical" class="flex flex-1 items-center justify-between py-4 transition-all hover:underline text-left font-bold text-foreground">${esc(q)}${CHEVRON}</button></h3></div>`).join("") +
  `</div></main>`;

/** route (dist file) -> the page's <main> HTML, or null when the route has no shell. */
export const infoMainHtml = (route: string): string | null => {
  switch (route) {
    case "about-us/index.html": return aboutMain();
    case "faq/index.html": return faqMain();
    case "how-to-use/index.html": return howToUseMain("en");
    case "es/how-to-use/index.html": return howToUseMain("es");
    case "terms-and-conditions/index.html": return termsMain();
    default: return null;
  }
};
