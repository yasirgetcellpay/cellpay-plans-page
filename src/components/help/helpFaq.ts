// Deterministic FAQ matcher for the help chat (keywords + quick replies, no LLM).
// Answer text lives in strings-en.json / strings-es.json (CellPay copy; claims-guarded in tests/).
import en from "./strings-en.json";
import es from "./strings-es.json";
import { HELP_CARRIERS, type HelpCarrier } from "./helpRoutes";

export type HelpLang = "en" | "es";
export type FaqTopic = "not_received" | "declined" | "fee" | "no_account" | "carriers" | "refill_how";
export type HelpIntent = FaqTopic | "order_status" | "autopay" | "contact";
export type HelpStrings = typeof en;

export const STRINGS: Record<HelpLang, HelpStrings> = { en, es };

/** Quick-reply order shown in the panel. */
export const QUICK_REPLIES: HelpIntent[] = [
  "refill_how", "carriers", "fee", "declined", "not_received", "no_account", "order_status", "autopay", "contact",
];

/** Lower-case, strip accents and apostrophes, collapse everything else to single spaces. */
export function normalize(text: string): string {
  return ` ${(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/**
 * Keyword phrases per intent (EN + ES are matched on every page; the answer uses the page language).
 * Score = number of words in each matched phrase, so specific multi-word phrases beat generic words.
 * Ties go to the intent listed first (most specific first).
 */
const KEYWORDS: Array<[HelpIntent, string[]]> = [
  // Auto Pay first (most specific): the answer reuses the live AP-1 self-serve cancel (HelpQuickActions).
  ["autopay", [
    "cancel auto pay", "cancel autopay", "auto pay", "autopay", "auto recharge", "auto refill", "automatic payment",
    "automatic refill", "recurring", "stop recurring", "recurring payment", "unsubscribe", "stop auto pay",
    "cancelar pago automatico", "pago automatico", "autopago", "recarga automatica", "cancelar autopago",
    "pagos recurrentes", "cancelar suscripcion", "darme de baja",
  ]],
  ["not_received", [
    "not received", "didnt receive", "did not receive", "havent received", "never received", "didnt get", "did not get",
    "never got", "not arrived", "hasnt arrived", "has not arrived", "didnt arrive", "did not arrive", "not showing",
    "not credited", "no minutes", "still waiting", "where is my refill", "where is my recharge", "refill missing",
    "didnt go to my phone", "not applied", "no balance",
    "no llego", "no ha llegado", "no recibi", "no me llego", "no se aplico", "no se ha aplicado", "todavia no",
    "aun no", "donde esta mi recarga", "no veo mi recarga", "no tengo saldo", "no se acredito",
  ]],
  ["declined", [
    "declined", "decline", "denied", "rejected", "card not working", "card doesnt work", "card didnt work",
    "payment failed", "payment error", "didnt go through", "did not go through", "wont go through", "not going through",
    "transaction failed", "card error", "failed payment",
    "rechazada", "rechazado", "rechazo", "rechazan", "declinada", "declinado", "no paso", "no pasa",
    "pago fallido", "fallo el pago", "error de pago", "tarjeta no funciona", "no acepta mi tarjeta",
  ]],
  ["fee", [
    "fee", "fees", "service fee", "service charge", "extra charge", "convenience fee", "how much is the fee",
    "why was i charged more", "charged more", "additional charge", "cost extra", "processing fee",
    "cargo", "cargos", "cargo por servicio", "tarifa", "comision", "cobran", "cobro extra", "cuanto cobran",
  ]],
  ["no_account", [
    "account", "need an account", "create an account", "sign up", "signup", "register", "log in", "login",
    "sign in", "guest", "password",
    "cuenta", "necesito una cuenta", "crear una cuenta", "iniciar sesion", "registrarme", "registrarse",
    "invitado", "contrasena",
  ]],
  ["order_status", [
    "order status", "status", "track", "tracking", "check my order", "my order", "order id", "transaction status",
    "did my order go through", "did it go through", "was i charged",
    "estado", "estado del pedido", "estado de mi pedido", "mi pedido", "mi orden", "rastrear", "id del pedido",
    "se completo mi pedido",
  ]],
  ["contact", [
    "contact", "contact support", "customer service", "support", "human", "agent", "real person", "talk to",
    "speak to", "speak with", "email you", "call you", "phone number for support", "refund", "complaint",
    "contacto", "contactar", "soporte", "servicio al cliente", "atencion al cliente", "hablar con", "agente",
    "persona", "reembolso", "queja", "llamar",
  ]],
  ["carriers", [
    "carrier", "carriers", "which carriers", "what carriers", "provider", "providers", "network", "amount", "amounts",
    "plan", "plans", "price", "prices", "how much", "international",
    "operador", "operadores", "compania", "companias", "monto", "montos", "planes", "precio", "precios",
    "cuanto cuesta", "internacional",
  ]],
  ["refill_how", [
    "how to refill", "how do i refill", "how to recharge", "how do i recharge", "how to top up", "how do i top up",
    "how does it work", "how it works", "refill", "recharge", "top up", "topup", "reload", "add minutes",
    "pay my phone", "pay my bill", "add money", "buy minutes",
    "como recargo", "como recargar", "como funciona", "recargar", "recarga", "recargo", "poner saldo",
    "pagar mi telefono", "agregar saldo", "comprar minutos",
  ]],
];

const COMPILED: Array<[HelpIntent, Array<[string, number]>]> = KEYWORDS.map(([intent, phrases]) => [
  intent,
  Array.from(new Set(phrases.map(normalize))).map((p) => [p, p.trim().split(" ").length] as [string, number]),
]);

export interface MatchResult { intent: HelpIntent | null; score: number; carriers: HelpCarrier[]; }

/** Carriers explicitly named in the text (e.g. "verizon"). "verizon flexi" lists only Verizon Flexi. */
export function detectCarriers(text: string): HelpCarrier[] {
  const n = normalize(text);
  const hits = HELP_CARRIERS
    .map((c) => ({ c, matched: c.aliases.map(normalize).filter((a) => n.includes(a)) }))
    .filter((h) => h.matched.length);
  const longer = (a: string) => hits.some((h) => h.matched.some((m) => m.length > a.length && m.includes(a.trim())));
  return hits.filter((h) => !h.matched.every(longer)).map((h) => h.c);
}

export function matchIntent(text: string): MatchResult {
  const n = normalize(text);
  const carriers = detectCarriers(text);
  let best: HelpIntent | null = null;
  let bestScore = 0;
  for (const [intent, phrases] of COMPILED) {
    let score = 0;
    for (const [p, words] of phrases) if (n.includes(p)) score += words;
    if (score > bestScore) { best = intent; bestScore = score; }
  }
  // A bare carrier name ("cricket?") is a carriers question.
  if (!best && carriers.length) return { intent: "carriers", score: 1, carriers };
  return { intent: best, score: bestScore, carriers };
}

export function answerFor(intent: FaqTopic, lang: HelpLang): string[] {
  return STRINGS[lang].answers[intent];
}

export function isFaqTopic(i: HelpIntent | null): i is FaqTopic {
  return !!i && i !== "order_status" && i !== "autopay" && i !== "contact";
}
