import { methodsLong } from "./paymentMethods"; // ST-ORGANIC-1119
export const ST_ORG_TITLE = "Straight Talk Refill & Bill Pay as Guest, No Login | CellPay"; // ST-ORGANIC-1119
export const ST_ORG_DESC = "Pay your Straight Talk bill or refill online as a guest with only the phone number. No login or account. Pay for others too. Fee shown before you pay."; // ST-ORGANIC-1119
export const ST_ORG_H1 = "Pay or Refill Straight Talk Online as a Guest"; // ST-ORGANIC-1119
export const ST_ORG_INTRO = "Pay your Straight Talk bill or refill your Straight Talk plan online as a guest. Enter the 10-digit Straight Talk phone number, choose a plan, and pay with a card, Apple Pay, Google Pay, PayPal, Klarna, Cash App or Pay by Bank. No login or account is needed. You see the total, including the service fee, before you pay. CellPay is an independent payment service and is not Straight Talk."; // ST-ORGANIC-1119
export const ST_ORG_UPDATED = "Last updated: November 19, 2026"; // ST-ORGANIC-1119
export const ST_ORG_FAQ_TITLE = "Straight Talk payment questions"; // ST-ORGANIC-1119
export const ST_ORG_FAQS: Array<{ q: string; a: string }> = [ // ST-ORGANIC-1119
  { q: "How do I pay my Straight Talk bill online?", a: "Enter the Straight Talk phone number, pick your plan, and pay. No account needed." }, // ST-ORGANIC-1119
  { q: "Can I refill Straight Talk as a guest?", a: "Yes. You do not need to log in or create an account. You only need the 10-digit Straight Talk phone number and a payment method." }, // ST-ORGANIC-1119
  { q: "Can I pay my Straight Talk bill without logging in?", a: "Yes. You only need the phone number." }, // ST-ORGANIC-1119
  { q: "Can I pay someone else's Straight Talk line?", a: "Yes. Enter their Straight Talk number and double-check it before you pay. The charge goes on your payment method, not their account, and all CellPay payments are final." }, // ST-ORGANIC-1119
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // ST-ORGANIC-1119
  { q: "When does my payment post?", a: "Most payments post within a few minutes, but it can take up to 30 minutes to show on your account. You get a confirmation on screen and by email." }, // ST-ORGANIC-1119
  { q: "Does it work for Straight Talk 30-day plans?", a: "Yes. Choose a plan from the list on this page. You will see the amount before you pay." }, // ST-ORGANIC-1119
  { q: "Is CellPay the same as Straight Talk?", a: "No. CellPay is an independent payment service. You can also pay Straight Talk directly on its official website or app." }, // ST-ORGANIC-1119
]; // ST-ORGANIC-1119
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); // ST-ORGANIC-1119
export const stOrgHtml = (): string => // ST-ORGANIC-1119
  `<section class="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-left" data-st-organic="1"><p class="text-sm text-foreground leading-relaxed">${esc(ST_ORG_INTRO)}</p><p class="text-xs text-muted-foreground mt-2">${esc(ST_ORG_UPDATED)}</p><h2 class="text-xl font-extrabold text-foreground mt-8 mb-4">${esc(ST_ORG_FAQ_TITLE)}</h2>` + // ST-ORGANIC-1119
  ST_ORG_FAQS.map(({ q, a }) => `<div class="mb-4"><h3 class="font-bold">${esc(q)}</h3><p class="text-sm text-muted-foreground mt-1">${esc(a)}</p></div>`).join("") + `</section>`; // ST-ORGANIC-1119