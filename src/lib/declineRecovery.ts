// GROWTH-1007-A: card-decline recovery (display only). Classifies the processor message so the error dialog can offer
// the right next step. It NEVER retries or re-submits by itself: every retry is a new tap by the customer on a decline
// that had NO transaction id (= nothing was charged). Card retries are capped per order in this tab (anti card-testing).
export type DeclineClass = "details" | "funds" | "blocked" | "system" | "invalid" | "plan"; // DECLINE-RECOVERY-1014: + invalid, plan

const DETAILS = /(cvv|cvc|cvv2|security code|avs|address|zip|postal|expir|exp(\.|iration)? date|invalid card|card number|incorrect|invalid account|invalid number)/i;
const FUNDS = /(insufficient|nsf|not sufficient|limit|exceed|over.?limit|withdrawal|do not honou?r|rejected)/i;
// Fraud & QA 10:41: blocked = ONLY stolen, lost, pick-up, fraud, velocity. Do-not-honor / "Transaction rejected" -> funds.
const BLOCKED = /(stolen|\blost\b|pick[\s-]?up|fraud|velocity)/i;
const INVALID = /(invalid data|missing one or more fields|validation failed)/i; // DECLINE-RECOVERY-1014
const SYSTEM = /(timeout|timed out|network|unavailable|try again later|system|gateway|failed to fetch|load failed|typeerror|internal)/i;

export function classifyDecline(msg: string, carrierSlug?: string): DeclineClass { // DECLINE-RECOVERY-1014: + carrierSlug
  const m = String(msg || "");
  if (BLOCKED.test(m)) return "blocked"; // checked first: never invite a card retry on a risk/fraud block
  if (INVALID.test(m)) return "invalid"; // DECLINE-RECOVERY-1014
  if (String(carrierSlug || "").includes("ultra") && /paypal declined/i.test(m)) return "plan"; // DECLINE-RECOVERY-1014
  if (DETAILS.test(m)) return "details";
  if (FUNDS.test(m)) return "funds";
  if (SYSTEM.test(m)) return "system";
  return "funds"; // generic "declined" / unknown: treat like a bank decline (offer wallets, one retry)
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
    details: "The card details didn't match what your bank has. Check the card number, expiry date, CVV (3 digits on the back) and the billing ZIP code, then try again.", // DECLINE-RECOVERY-1014
    invalid: "Some payment details couldn't be read. Check your name, email and billing ZIP code, then try again or use another card.", // DECLINE-RECOVERY-1014
    plan: "This payment didn't go through. Please check that you picked the right plan and amount for this number, then try again.", // DECLINE-RECOVERY-1014
    capSession: "For your security, we've paused more tries on this order. Please pay with PayPal or contact support.", // DECLINE-RECOVERY-1014
    tryAgain: "Try again", // DECLINE-RECOVERY-1014
    useAnotherCard: "Use another card", // DECLINE-RECOVERY-1014
    usePayPal: "Pay with PayPal", // DECLINE-RECOVERY-1014
    funds: "Your bank declined this payment, often because of available funds or a daily limit. You can try again, use another card, or pay another way.", // DECLINE-RECOVERY-1014
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
  },
  es: {
    details: "Los datos de la tarjeta no coinciden con los de su banco. Revise el número, la fecha de vencimiento, el CVV (3 dígitos al reverso) y el código postal de facturación, y vuelva a intentar.", // DECLINE-RECOVERY-1014
    invalid: "No pudimos leer algunos datos del pago. Revise su nombre, correo y código postal de facturación, y vuelva a intentar o use otra tarjeta.", // DECLINE-RECOVERY-1014
    plan: "Este pago no se completó. Verifique que eligió el plan y el monto correctos para este número, y vuelva a intentar.", // DECLINE-RECOVERY-1014
    capSession: "Por su seguridad, pausamos más intentos en este pedido. Pague con PayPal o comuníquese con soporte.", // DECLINE-RECOVERY-1014
    tryAgain: "Intentar de nuevo", // DECLINE-RECOVERY-1014
    useAnotherCard: "Usar otra tarjeta", // DECLINE-RECOVERY-1014
    usePayPal: "Pagar con PayPal", // DECLINE-RECOVERY-1014
    funds: "Su banco rechazó este pago, muchas veces por fondos disponibles o un límite diario. Puede intentar de nuevo, usar otra tarjeta o pagar de otra forma.", // DECLINE-RECOVERY-1014
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
  },
} as const;
