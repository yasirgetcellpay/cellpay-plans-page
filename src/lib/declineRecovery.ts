// GROWTH-1007-A: card-decline recovery (display only). Classifies the processor message so the error dialog can offer
// the right next step. It NEVER retries or re-submits by itself: every retry is a new tap by the customer on a decline
// that had NO transaction id (= nothing was charged). Card retries are capped per order in this tab (anti card-testing).
export type DeclineClass = "details" | "funds" | "blocked" | "system";

const DETAILS = /(cvv|cvc|cvv2|security code|avs|address|zip|postal|expir|exp(\.|iration)? date|invalid card|card number|incorrect|invalid account|invalid number)/i;
const FUNDS = /(insufficient|nsf|not sufficient|limit|exceed|over.?limit|withdrawal|do not honou?r|rejected)/i;
// Fraud & QA 10:41: blocked = ONLY stolen, lost, pick-up, fraud, velocity. Do-not-honor / "Transaction rejected" -> funds.
const BLOCKED = /(stolen|\blost\b|pick[\s-]?up|fraud|velocity)/i;
const SYSTEM = /(timeout|timed out|network|unavailable|try again later|system|gateway|failed to fetch|load failed|typeerror|internal)/i;

export function classifyDecline(msg: string): DeclineClass {
  const m = String(msg || "");
  if (BLOCKED.test(m)) return "blocked"; // checked first: never invite a card retry on a risk/fraud block
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

export const DECLINE_COPY = {
  en: {
    details: "Your bank couldn't match the card details. Check the card number, expiry date, CVV and billing ZIP, then try again.",
    funds: "Your bank declined this card. A wallet like Apple Pay or Google Pay often goes through when a card doesn't.",
    blocked: "Your bank declined this card. Please use another payment method.",
    system: "We couldn't reach the payment network. Please try again in a moment, or use another payment method.",
    checkDetails: "Check card details",
    retryCard: "Try card again",
    useApplePay: "Pay with Apple Pay",
    useGooglePay: "Pay with Google Pay",
    otherMethod: "Choose another payment method",
    capReached: "This card was declined more than once, so we've paused card tries for this order. Please use another method.",
    help: "Need help? support@getcellpay.com",
    close: "Close",
  },
  es: {
    details: "Su banco no pudo verificar los datos de la tarjeta. Revise el número, la fecha de vencimiento, el CVV y el código postal, y vuelva a intentar.",
    funds: "Su banco rechazó esta tarjeta. Una billetera como Apple Pay o Google Pay muchas veces funciona cuando la tarjeta no.",
    blocked: "Su banco rechazó esta tarjeta. Use otro método de pago.",
    system: "No pudimos conectar con la red de pagos. Intente de nuevo en un momento o use otro método de pago.",
    checkDetails: "Revisar datos de la tarjeta",
    retryCard: "Intentar con la tarjeta otra vez",
    useApplePay: "Pagar con Apple Pay",
    useGooglePay: "Pagar con Google Pay",
    otherMethod: "Elegir otro método de pago",
    capReached: "Esta tarjeta fue rechazada más de una vez, así que pausamos los intentos con tarjeta para este pedido. Use otro método.",
    help: "¿Necesita ayuda? support@getcellpay.com",
    close: "Cerrar",
  },
} as const;
