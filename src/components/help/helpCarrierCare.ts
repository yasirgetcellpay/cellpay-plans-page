// KB-1 (Oct 4 2026): carrier care numbers + balance checks for the help chat, appended to the not_working / balance /
// not_received / carrier_issue answers when exactly one carrier is named. Keys = HELP_CARRIERS names (helpRoutes.ts).
// Only details verified on the carrier's own site (sources: CellPay kb-carriers/CARRIER-KB.md). Missing = generic line.
// Re-verify every 6 months.
import type { HelpCarrier } from "./helpRoutes";
import { STRINGS, type HelpIntent, type HelpLang } from "./helpFaq";

type Text = { en: string; es: string };
export interface CareInfo { call?: Text; balance?: Text; }

export const CARRIER_CARE: Record<string, CareInfo> = {
  "Metro PCS": { call: { en: "*611 or 1-888-863-8768", es: "*611 o al 1-888-863-8768" } },
  "T-Mobile": {
    call: { en: "611 or 1-800-937-8997", es: "611 o al 1-800-937-8997" },
    balance: { en: "dial #999# (balance) or #225# (service cycle)", es: "marque #999# (saldo) o #225# (ciclo de servicio)" },
  },
  "AT&T Prepaid": { call: { en: "611 or 800-901-9878", es: "611 o al 800-901-9878" }, balance: { en: "dial *777#", es: "marque *777#" } },
  "Verizon Wireless Prepaid": {
    call: { en: "*611 or 888-294-6804", es: "*611 o al 888-294-6804" },
    balance: { en: "dial #225 (balance and expiration date)", es: "marque #225 (saldo y fecha de vencimiento)" },
  },
  "Cricket Wireless": {
    call: { en: "611 or 1-800-274-2538", es: "611 o al 1-800-274-2538" },
    balance: { en: "use the myCricket app (amount due and due date)", es: "use la app myCricket (monto a pagar y fecha de pago)" },
  },
  "Boost Mobile": { call: { en: "(833) 502-6678", es: "(833) 502-6678" } },
  "Straight Talk": {
    call: { en: "1-877-430-2355", es: "1-877-430-2355" },
    balance: { en: "text Balance to 611611", es: "envíe Balance por mensaje de texto al 611611" },
  },
  "TracFone": {
    call: { en: "1-800-867-7183", es: "1-800-867-7183" },
    balance: { en: "use the 611611 text helpline", es: "use la línea de mensajes de texto 611611" },
  },
  "Total Wireless": {
    call: { en: "1-866-663-3633", es: "1-866-663-3633" },
    balance: { en: "text 611611", es: "envíe un mensaje de texto al 611611" },
  },
  "Simple Mobile": { balance: { en: "text DUE DATE to 611611", es: "envíe DUE DATE por mensaje de texto al 611611" } },
  "Net10 Wireless": { balance: { en: "text DUE DATE to 611611", es: "envíe DUE DATE por mensaje de texto al 611611" } },
  "Page Plus": { call: { en: "#CCARE or (800) 550-2436", es: "#CCARE o al (800) 550-2436" } },
  "H2O Wireless": { call: { en: "1-800-643-4926", es: "1-800-643-4926" } },
};

/** Balance + customer-care lines for one carrier (generic care line when nothing is verified). */
export function careLines(carrier: string, lang: HelpLang): string[] {
  const c = CARRIER_CARE[carrier] ?? {};
  const out: string[] = [];
  if (c.balance) out.push(lang === "es" ? `${carrier}, consultar saldo: ${c.balance.es}.` : `${carrier} balance: ${c.balance.en}.`);
  out.push(c.call
    ? (lang === "es" ? `${carrier}, servicio al cliente: llame al ${c.call.es}.` : `${carrier} customer care: call ${c.call.en}.`)
    : (lang === "es" ? `${carrier}: llame al número de servicio al cliente que aparece en el sitio web de su operador.`
      : `${carrier}: call the customer care number on your carrier's website.`));
  return out;
}

const CARE_INTENTS: ReadonlyArray<HelpIntent> = ["not_working", "balance", "not_received", "carrier_issue"];

/** Extra lines after a self-help answer: the named carrier's details, or a prompt to name the carrier. */
export function careFor(intent: HelpIntent | null, carriers: HelpCarrier[], lang: HelpLang): string[] {
  if (!intent || !CARE_INTENTS.includes(intent)) return [];
  return carriers.length === 1 ? careLines(carriers[0].name, lang) : [STRINGS[lang].ui.carrierAsk];
}
