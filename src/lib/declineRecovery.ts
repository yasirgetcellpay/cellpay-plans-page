// GROWTH-1007-A: card-decline recovery (display only). Classifies the processor message so the error dialog can offer
// the right next step. It NEVER retries or re-submits by itself: every retry is a new tap by the customer on a decline
// that had NO transaction id (= nothing was charged). Card retries are capped per order in this tab (anti card-testing).
export type DeclineClass = "details" | "funds" | "risk" | "blocked" | "system" | "invalid" | "plan"; // DECLINE-RECOVERY-1014: + invalid, plan // DECLINE-REJECTED-1018

const DETAILS = /(cvv|cvc|cvv2|security code|avs|address|zip|postal|expir|exp(\.|iration)? date|invalid card|card number|incorrect|invalid account|invalid number)/i;
const FUNDS = /(insufficient|nsf|not sufficient|limit|exceed|over.?limit|withdrawal|do not honou?r)/i; // DECLINE-REJECTED-1018
// Fraud & QA: blocked = ONLY stolen, lost, pick-up, fraud, velocity. Do-not-honor -> funds; transaction rejected -> risk. // DECLINE-REJECTED-1018
const RISK = /transaction (was )?rejected/i; // DECLINE-REJECTED-1018
const BLOCKED = /(stolen|\blost\b|pick[\s-]?up|fraud|velocity)/i;
const INVALID = /(invalid data|missing one or more fields|validation failed)/i; // DECLINE-RECOVERY-1014
const SYSTEM = /(timeout|timed out|network|unavailable|try again later|system|gateway|failed to fetch|load failed|typeerror|internal)/i;

export function classifyDecline(msg: string, carrierSlug?: string): DeclineClass { // DECLINE-RECOVERY-1014: + carrierSlug
  const m = String(msg || "");
  if (BLOCKED.test(m)) return "blocked"; // checked first: never invite a card retry on a risk/fraud block
  if (RISK.test(m)) return "risk"; // DECLINE-REJECTED-1018
  if (INVALID.test(m)) return "invalid"; // DECLINE-RECOVERY-1014
  if (String(carrierSlug || "").includes("ultra") && /paypal declined/i.test(m)) return "plan"; // DECLINE-RECOVERY-1014
  if (DETAILS.test(m)) return "details";
  if (FUNDS.test(m)) return "funds";
  if (SYSTEM.test(m)) return "system";
  return "funds"; // generic "declined" / unknown: treat like a bank decline (offer wallets, one retry)
}

// DECLINE-RECOVERY-1014B: Fraud & QA: bank declines (and Google Pay "rejected") get no same-method retry.
export function noSameRetry(msg: string, method: string): boolean {
  const m = String(msg || "");
  return /general decline|insufficient|not sufficient|nsf|transaction (was )?rejected|do not honou?r/i.test(m)
    || (method === "googlepay" && /reject/i.test(m))
    || /problem with the card|soft decline/i.test(m) || /^declined?\.?$/i.test(m.trim()); // DECLINE-RECOVERY-1014C
}

// DECLINE-RECOVERY-1014C: wallets declined in this tab (never cleared on success; lasts the tab session).
const WALLET_KEY = "cp_wallet_declined_v1";
export function walletDeclined(): string[] {
  try { const v = JSON.parse(sessionStorage.getItem(WALLET_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function markWalletDeclined(m: string) {
  try { const v = walletDeclined(); if (!v.includes(m)) sessionStorage.setItem(WALLET_KEY, JSON.stringify([...v, m])); } catch { /* ignore */ }
}

export const MAX_CARD_RETRIES = 2; // after 2 declined card tries on this order, only other methods are offered
const KEY = "cp_card_declines_v1";

export function bumpCardDeclines(orderKey: string): number {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || "{}") as { k?: string; n?: number; ts?: number };
    const fresh = raw.k === orderKey && raw.ts && Date.now() - raw.ts < 30 * 60_000;
    const n = (fresh ? raw.n || 0 : 0) + 1;
    sessionStorage.setItem(KEY, JSON.stringify({ k: orderKey, n, ts: Date.now() }));
    return n;
  } catch { return 1; }
}
export function clearCardDeclines() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }

// DECLINE-RECOVERY-1014: every declined card / Apple Pay / Google Pay attempt in this tab (60 min window), card-testing guard.
const SESS_KEY = "cp_sess_declines_v1";
export function bumpSessionDeclines(): number {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESS_KEY) || "{}") as { n?: number; ts?: number };
    const fresh = raw.ts && Date.now() - raw.ts < 60 * 60_000;
    const n = (fresh ? raw.n || 0 : 0) + 1;
    sessionStorage.setItem(SESS_KEY, JSON.stringify({ n, ts: fresh ? raw.ts : Date.now() }));
    return n;
  } catch { return 1; }
}
export function clearSessionDeclines() { try { sessionStorage.removeItem(SESS_KEY); } catch { /* ignore */ } } // DECLINE-RECOVERY-1014

// DECLINE-RECOVERY-1014: email cleanup + strict check (CellPay rejects malformed billing emails).
const COM_FIX = [".con", ".come", ".comm", ".coml", ".comj", ".comn", ".comt", ".comg", ".cpm", ".vom"];
const GMAIL_FIX = new Set(["gmal.com", "gmaill.com", "gmial.com", "gnail.com", "gamil.com"]);
export function cleanEmail(s: string): string {
  let v = String(s || "").replace(/\s+/g, "");
  while (v.includes("..")) v = v.replace(/\.\./g, ".");
  v = v.replace(/^\.+|\.+$/g, "");
  const at = v.lastIndexOf("@");
  if (at < 0) return v;
  const local = v.slice(0, at);
  let dom = v.slice(at + 1).toLowerCase();
  const end = COM_FIX.find((e) => dom.endsWith(e));
  if (end) dom = dom.slice(0, -end.length) + ".com";
  if (GMAIL_FIX.has(dom)) dom = "gmail.com";
  return `${local}@${dom}`;
}
export function isValidEmail(s: string): boolean {
  return /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(String(s || ""));
}

export const DECLINE_COPY = {
  en: {
    risk: "A security check stopped this card, so the payment didn't go through. Trying the same card again won't work. Please use a different card or another way to pay.", // DECLINE-REJECTED-1018
    riskAp: "A security check stopped this card, so the payment didn't go through. Trying the same card again won't work. Please pay with Apple Pay or a different card.", // DECLINE-REJECTED-1018
    riskGp: "A security check stopped this card, so the payment didn't go through. Trying the same card again won't work. Please pay with Google Pay or a different card.", // DECLINE-REJECTED-1018
    details: "The card details didn't match what your bank has. Check the card number, expiry date, CVV (3 digits on the back) and the billing ZIP code, then try again.", // DECLINE-RECOVERY-1014
    invalid: "Some payment details couldn't be read. Check your name, email and billing ZIP code, then try again or use another card.", // DECLINE-RECOVERY-1014
    plan: "This payment didn't go through. Please check that you picked the right plan and amount for this number, then try again.", // DECLINE-RECOVERY-1014
    capSession: "For your security, we paused more tries with this card. Please use another card, Apple Pay or PayPal, or contact support.", // APPLEPAY-PP-AB-1023
    capBlocked: "For your security, we've paused more tries on this order. Please pay with PayPal or contact support.", // APPLEPAY-PP-AB-1023
    tryAgain: "Try again", // DECLINE-RECOVERY-1014
    useAnotherCard: "Use another card", // DECLINE-RECOVERY-1014
    usePayPal: "Pay with PayPal", // DECLINE-RECOVERY-1014
    funds: "Your bank declined this payment, often because of available funds or a daily limit. Please use another card or a different way to pay.", // DECLINE-RECOVERY-1014B
    blocked: "Your bank declined this card. Please use another payment method.",
    system: "We couldn't reach the payment network. Please try again in a moment, or use another payment method.",
    checkDetails: "Check card details",
    retryCard: "Try card again",
    useApplePay: "Pay with Apple Pay",
    useGooglePay: "Pay with Google Pay",
    useCashApp: "Pay with Cash App",
    usePayByBank: "Pay by Bank (link your bank)",
    otherMethod: "Choose another payment method",
    capReached: "This card was declined more than once, so we've paused card tries for this order. Please use another method.",
    help: "Need help? support@getcellpay.com",
    close: "Close",
    walletFirst: "Faster ways to pay:", // DECLINE-LEVERS-1015-D1
    orCard: "Or use a card:", // DECLINE-LEVERS-1015-D1
    abPrimaryAp: "Card declined? Pay with Apple Pay in one tap.", // DECLINE-AB-1016
    abPrimaryGp: "Card declined? Pay with Google Pay in one tap.", // DECLINE-AB-1016
    abKlarna: "Or pay with Klarna.", // DECLINE-AB-1016 // FUNDS-DECLINE-1016
    abTryCard: "Try card again", // DECLINE-AB-1016
  },
  es: {
    risk: "Un control de seguridad detuvo esta tarjeta y el pago no se completó. Volver a usar la misma tarjeta no va a funcionar. Use otra tarjeta u otra forma de pago.", // DECLINE-REJECTED-1018
    riskAp: "Un control de seguridad detuvo esta tarjeta y el pago no se completó. Volver a usar la misma tarjeta no va a funcionar. Pague con Apple Pay o con otra tarjeta.", // DECLINE-REJECTED-1018
    riskGp: "Un control de seguridad detuvo esta tarjeta y el pago no se completó. Volver a usar la misma tarjeta no va a funcionar. Pague con Google Pay o con otra tarjeta.", // DECLINE-REJECTED-1018
    details: "Los datos de la tarjeta no coinciden con los de su banco. Revise el número, la fecha de vencimiento, el CVV (3 dígitos al reverso) y el código postal de facturación, y vuelva a intentar.", // DECLINE-RECOVERY-1014
    invalid: "No pudimos leer algunos datos del pago. Revise su nombre, correo y código postal de facturación, y vuelva a intentar o use otra tarjeta.", // DECLINE-RECOVERY-1014
    plan: "Este pago no se completó. Verifique que eligió el plan y el monto correctos para este número, y vuelva a intentar.", // DECLINE-RECOVERY-1014
    capSession: "Por su seguridad, pausamos más intentos con esta tarjeta. Use otra tarjeta, Apple Pay o PayPal, o comuníquese con soporte.", // APPLEPAY-PP-AB-1023
    capBlocked: "Por su seguridad, pausamos más intentos en este pedido. Pague con PayPal o comuníquese con soporte.", // APPLEPAY-PP-AB-1023
    tryAgain: "Intentar de nuevo", // DECLINE-RECOVERY-1014
    useAnotherCard: "Usar otra tarjeta", // DECLINE-RECOVERY-1014
    usePayPal: "Pagar con PayPal", // DECLINE-RECOVERY-1014
    funds: "Su banco rechazó este pago, muchas veces por fondos disponibles o un límite diario. Use otra tarjeta u otra forma de pago.", // DECLINE-RECOVERY-1014B
    blocked: "Su banco rechazó esta tarjeta. Use otro método de pago.",
    system: "No pudimos conectar con la red de pagos. Intente de nuevo en un momento o use otro método de pago.",
    checkDetails: "Revisar datos de la tarjeta",
    retryCard: "Intentar con la tarjeta otra vez",
    useApplePay: "Pagar con Apple Pay",
    useGooglePay: "Pagar con Google Pay",
    useCashApp: "Pagar con Cash App",
    usePayByBank: "Pagar con su banco (vincule su banco)",
    otherMethod: "Elegir otro método de pago",
    capReached: "Esta tarjeta fue rechazada más de una vez, así que pausamos los intentos con tarjeta para este pedido. Use otro método.",
    help: "¿Necesita ayuda? support@getcellpay.com",
    close: "Cerrar",
    walletFirst: "Formas más rápidas de pagar:", // DECLINE-LEVERS-1015-D1
    orCard: "O use una tarjeta:", // DECLINE-LEVERS-1015-D1
    abPrimaryAp: "¿Tarjeta rechazada? Pague con Apple Pay en un toque.", // DECLINE-AB-1016
    abPrimaryGp: "¿Tarjeta rechazada? Pague con Google Pay en un toque.", // DECLINE-AB-1016
    abKlarna: "O pague con Klarna.", // DECLINE-AB-1016 // FUNDS-DECLINE-1016
    abTryCard: "Intentar con la tarjeta otra vez", // DECLINE-AB-1016
  },
} as const;

// FUNDS-DECLINE-1016: display-only low-funds recovery, shared by both A/B arms.
export function isNsfDecline(msg: string): boolean { return /insufficient|not sufficient|\bnsf\b/i.test(String(msg || "")); }
export const KLARNA_MIN_TOTAL = 25;
export function klarnaQuarter(total: number): string { return (Math.ceil(Math.round(total * 100) / 4) / 100).toFixed(2); }
export const FUNDS_COPY = {
  en: { title: "Your card was declined for low funds. You can still pay today.", klarna: "Pay in 4 with Klarna: about ${x} today*", approval: "Subject to approval.", disclosure: "*See payment terms. A higher initial payment may be required for some consumers. CA resident loans made or arranged pursuant to a California Financing Law license. NMLS # 1353190.", terms: "See payment terms", otherWays: "Other ways to pay:", sameCard: "Try the same card again" },
  es: { title: "Su tarjeta fue rechazada por fondos insuficientes. Aún puede pagar hoy.", klarna: "Pague en 4 con Klarna: unos ${x} hoy*", approval: "Sujeto a aprobación.", disclosure: "*Vea los términos de pago. Es posible que a algunos clientes se les pida un primer pago más alto. Préstamos a residentes de CA hechos o gestionados conforme a una licencia de la California Financing Law. NMLS # 1353190.", terms: "Ver términos de pago", otherWays: "Otras formas de pagar:", sameCard: "Intentar con la misma tarjeta" },
} as const;

// DECLINE-MSGS-1016: specific hint text for security-code, billing-ZIP and bank-verification declines. Display only:
// the decline class (and so every button, and both DECLINE-AB-1016 arms) stays exactly the same; only the hint sentence changes.
export const DECLINE_HINTS = {
  en: {
    cvv: "The security code (CVV) didn't match. It's the 3 digits on the back of your card (4 on the front for Amex). Type it again, or use another way to pay.",
    avs: "The billing ZIP code didn't match your bank's records. Use the ZIP code where your bank sends your card statements, then try again, or use another way to pay.",
    verify: "Your bank couldn't confirm it's you, so this payment didn't go through. Try again and finish your bank's check (a text code or your bank app), or use another way to pay.",
    hold: "If you see a pending amount, your bank removes it in 1-2 days.",
  },
  es: {
    cvv: "El código de seguridad (CVV) no coincide. Son los 3 dígitos al reverso de su tarjeta (4 al frente en Amex). Escríbalo otra vez o use otra forma de pago.",
    avs: "El código postal de facturación no coincide con el de su banco. Use el código postal donde su banco le envía los estados de cuenta y vuelva a intentar, o use otra forma de pago.",
    verify: "Su banco no pudo confirmar que es usted, así que este pago no se completó. Intente de nuevo y complete la verificación de su banco (código por mensaje de texto o en la app de su banco), o use otra forma de pago.",
    hold: "Si ve un cargo pendiente, su banco lo quita en 1 a 2 días.",
  },
} as const;
const HINT_CVV = /(\bcvn\b|\bcvv2?\b|\bcvc2?\b|card verification|security code)/i;
const HINT_AVS = /(\bavs\b|address verification)/i;
const HINT_VERIFY = /(3-?d ?secure|\b3ds\b|payer authentication|cardholder authentication|authentication (failed|rejected|declined|unavailable|was not|could not)|verification (failed|was not completed))/i;
export function declineHint(msg: string, lang: string): string | null {
  try {
    const m = String(msg || "");
    const h = DECLINE_HINTS[lang === "es" ? "es" : "en"];
    let t: string | null = null;
    if (HINT_CVV.test(m)) t = h.cvv;
    else if (HINT_AVS.test(m)) t = h.avs;
    else if (HINT_VERIFY.test(m)) t = h.verify;
    if (t && /soft decline/i.test(m)) t = `${t} ${h.hold}`;
    return t;
  } catch { return null; }
}

// DECLINE-AB-1016: sticky 50/50 decline-dialog assignment (per-phone localStorage first, then session). Never re-rolls in a session. // APPLEPAY-PP-AB-1023
export type DeclineAb = "control" | "variant";
export const DECLINE_AB_SESSION_KEY = "cp_decline_ab_v1";
export const DECLINE_AB_PHONE_PREFIX = "cp_decline_ab_phone_v1:";
const isAb = (v: unknown): v is DeclineAb => v === "control" || v === "variant";
export function declineAbPhoneKey(phone?: string): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 10 ? DECLINE_AB_PHONE_PREFIX + d : null;
}
export function readDeclineAb(phone?: string): DeclineAb | null {
  try { const k = declineAbPhoneKey(phone); if (k) { const p = localStorage.getItem(k); if (isAb(p)) return p; } } catch { /* ignore */ } // APPLEPAY-PP-AB-1023
  try { const s = sessionStorage.getItem(DECLINE_AB_SESSION_KEY); if (isAb(s)) return s; } catch { /* ignore */ } // APPLEPAY-PP-AB-1023
  return null;
}
function evenAb(): DeclineAb { // APPLEPAY-PP-AB-1023
  try { if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") { const b = new Uint8Array(1); crypto.getRandomValues(b); return b[0] < 128 ? "control" : "variant"; } } catch { /* ignore */ } // APPLEPAY-PP-AB-1023
  return Math.random() < 0.5 ? "control" : "variant"; // APPLEPAY-PP-AB-1023
} // APPLEPAY-PP-AB-1023
export function getDeclineAb(phoneDigits?: string): DeclineAb {
  const k = declineAbPhoneKey(phoneDigits);
  let p: string | null = null; // APPLEPAY-PP-AB-1023
  try { p = k ? localStorage.getItem(k) : null; } catch { /* ignore */ } // APPLEPAY-PP-AB-1023
  if (isAb(p)) { try { sessionStorage.setItem(DECLINE_AB_SESSION_KEY, p); } catch { /* ignore */ } return p; } // APPLEPAY-PP-AB-1023
  let s: string | null = null;
  try { s = sessionStorage.getItem(DECLINE_AB_SESSION_KEY); } catch { /* ignore */ }
  if (isAb(s)) { try { if (k) localStorage.setItem(k, s); } catch { /* ignore */ } return s; } // APPLEPAY-PP-AB-1023
  const v: DeclineAb = evenAb(); // APPLEPAY-PP-AB-1023
  try { sessionStorage.setItem(DECLINE_AB_SESSION_KEY, v); } catch { /* ignore */ }
  try { if (k) localStorage.setItem(k, v); } catch { /* ignore */ } // APPLEPAY-PP-AB-1023
  return v;
}

// KLARNA-FUNNEL-1017: logging-only flags, session primary with a per-phone mirror; never included in events.
export type KlarnaSrc = "decline_nsf" | "decline_other" | "method_list";
export type FundsFlags = { ts: number; decline_cls?: string; klarna_offered?: boolean; klarna_clicked?: boolean; klarna_auth_declined?: boolean };
const FLAGS_TTL = 30 * 60_000;
const flagsPhoneKey = (prefix: string, phone: string) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? prefix + digits : null;
};
function readFreshFlags(sessionKey: string, prefix: string, phone: string): Record<string, unknown> | null {
  const fresh = (raw: string | null): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(raw || "null");
      return v && typeof v === "object" && !Array.isArray(v) && typeof v.ts === "number" && Date.now() - v.ts >= 0 && Date.now() - v.ts < FLAGS_TTL ? v : null;
    } catch { return null; }
  };
  try { const v = fresh(sessionStorage.getItem(sessionKey)); if (v) return v; } catch { /* ignore */ }
  try { const key = flagsPhoneKey(prefix, phone); return key ? fresh(localStorage.getItem(key)) : null; } catch { return null; }
}
function writeFlags(sessionKey: string, prefix: string, phone: string, obj: unknown): void {
  try { sessionStorage.setItem(sessionKey, JSON.stringify(obj)); } catch { /* ignore */ }
  try { const key = flagsPhoneKey(prefix, phone); if (key) localStorage.setItem(key, JSON.stringify(obj)); } catch { /* ignore */ }
}
function clearFlags(sessionKey: string, prefix: string, phone: string): void {
  try { sessionStorage.removeItem(sessionKey); } catch { /* ignore */ }
  try { const key = flagsPhoneKey(prefix, phone); if (key) localStorage.removeItem(key); } catch { /* ignore */ }
}
export function writeFunds(phone: string, obj: FundsFlags): void { writeFlags("cp_funds_v1", "cp_funds_phone_v1:", phone, obj); }
export function readFunds(phone: string): FundsFlags | null { return readFreshFlags("cp_funds_v1", "cp_funds_phone_v1:", phone) as FundsFlags | null; }
export function patchFunds(phone: string, patch: Partial<FundsFlags>): void {
  try { const v = readFunds(phone); if (v) writeFunds(phone, { ...v, ...patch }); } catch { /* ignore */ }
}
export function clearFunds(phone: string): void { clearFlags("cp_funds_v1", "cp_funds_phone_v1:", phone); }
export function setKlarnaSrc(phone: string, src: KlarnaSrc): void { writeFlags("cp_klarna_src_v1", "cp_klarna_src_phone_v1:", phone, { src, ts: Date.now() }); }
export function readKlarnaSrc(phone: string): KlarnaSrc {
  try {
    const v = readFreshFlags("cp_klarna_src_v1", "cp_klarna_src_phone_v1:", phone);
    return v?.src === "decline_nsf" || v?.src === "decline_other" ? v.src : "method_list";
  } catch { return "method_list"; }
}
export function clearKlarnaSrc(phone: string): void { clearFlags("cp_klarna_src_v1", "cp_klarna_src_phone_v1:", phone); }

export function declineBtnCode(testid: string, wallet?: string): string | null { // DECLINE-REJECTED-1018
  try { // DECLINE-REJECTED-1018
    if (testid === "decline-ab-primary-wallet" || testid === "decline-risk-wallet") return wallet === "applepay" ? "ap" : wallet === "googlepay" ? "gp" : null; // DECLINE-REJECTED-1018
    const codes: Record<string, string> = { "decline-applepay": "ap", "decline-googlepay": "gp", "decline-paypal": "pp", "decline-cashapp": "cash", "decline-paybybank": "bank", "decline-another-card": "card", "decline-retry-card": "retry", "funds-same-card": "retry", "decline-klarna": "klarna", "funds-klarna": "klarna", "funds-applepay-again": "ap_again", "decline-other": "close" }; // DECLINE-REJECTED-1018
    return Object.prototype.hasOwnProperty.call(codes, testid) ? codes[testid] : null; // DECLINE-REJECTED-1018
  } catch { return null; } // DECLINE-REJECTED-1018
} // DECLINE-REJECTED-1018
export function declineActionFor(code: string | null): string | null { // DECLINE-REJECTED-1018
  try { // DECLINE-REJECTED-1018
    const actions: Record<string, string> = { ap: "applepay", gp: "googlepay", pp: "paypal", cash: "cashapp", bank: "bank", card: "another_card", retry: "retry_same", klarna: "klarna", ap_again: "applepay_again", close: "close" }; // DECLINE-REJECTED-1018
    return code !== null && Object.prototype.hasOwnProperty.call(actions, code) ? actions[code] : null; // DECLINE-REJECTED-1018
  } catch { return null; } // DECLINE-REJECTED-1018
} // DECLINE-REJECTED-1018
