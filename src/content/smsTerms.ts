export type SmsInline = string | { href: string; text: string }; // SMS-34332-1020
export const SMS_TERMS = { // SMS-34332-1020
  lang: "en", // SMS-34332-1020
  path: "/sms-terms", // SMS-34332-1020
  title: "SMS Terms — CellPay", // SMS-34332-1020
  description: "CellPay SMS program terms: refill reminders and Text-to-Pay links, message frequency, rates, STOP and HELP.", // SMS-34332-1020
  h1: "CellPay SMS Terms", // SMS-34332-1020
  sections: [ // SMS-34332-1020
    { h: "Program", p: ["The Cell Pay text program sends refill reminders and Text-to-Pay payment links for your prepaid phone. Texts come from short code 34332. You only get texts if you check the SMS box at checkout. Consent is not a condition of purchase."] }, // SMS-34332-1020
    { h: "How often", p: ["Msg frequency varies."] }, // SMS-34332-1020
    { h: "Cost", p: ["Message and data rates may apply."] }, // SMS-34332-1020
    { h: "Stop texts", p: ["Reply STOP to cancel at any time. You will get one confirmation text, then no more texts."] }, // SMS-34332-1020
    { h: "Help", p: ["Reply HELP for help, or email ", { href: "mailto:support@getcellpay.com", text: "support@getcellpay.com" }] }, // SMS-34332-1020
    { h: "Carriers", p: ["Carriers are not liable for delayed or undelivered messages."] }, // SMS-34332-1020
    { h: "Privacy", p: ["We do not share, sell, or rent mobile phone numbers or personal information collected through our SMS program to third parties or affiliates for marketing or promotional purposes. Read our ", { href: "/privacy-policy", text: "Privacy Policy" }] }, // SMS-34332-1020
  ] as { h: string; p: SmsInline[] }[], // SMS-34332-1020
}; // SMS-34332-1020
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); // SMS-34332-1020
const inlineHtml = (x: SmsInline): string => typeof x === "string" ? esc(x) : `<a href="${esc(x.href)}" class="underline">${esc(x.text)}</a>`; // SMS-34332-1020
export const smsMainHtml = (): string => // SMS-34332-1020
  `<main class="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">` + // SMS-34332-1020
  `<h1 class="text-3xl font-extrabold text-foreground mb-6">${esc(SMS_TERMS.h1)}</h1>` + // SMS-34332-1020
  `<div class="space-y-5 text-muted-foreground leading-relaxed text-sm">` + // SMS-34332-1020
  SMS_TERMS.sections.map((s) => `<h2 class="text-lg font-bold text-foreground pt-3">${esc(s.h)}</h2><p>${s.p.map(inlineHtml).join("")}</p>`).join("") + // SMS-34332-1020
  `</div></main>`; // SMS-34332-1020