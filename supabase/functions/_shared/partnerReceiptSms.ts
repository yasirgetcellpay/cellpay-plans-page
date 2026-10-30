import { postpayBody, postpayMdn } from "./postpaySms.ts"; // CM-PZ-34332-HOST-1030
export { postpayMdn }; // CM-PZ-34332-HOST-1030
export type PartnerBrand = "callingmart" | "pinzoo"; // CM-PZ-34332-HOST-1030
export function partnerReceiptBody({ amount, carrier, last4, lang }: { brand: PartnerBrand; amount?: number; carrier?: string; last4: string; lang: "en" | "es" }): string { // CM-PZ-34332-HOST-1030
  if (amount === undefined || !carrier) return lang === "es" ? `CellPay: Su pago para ***${last4} está confirmado. Responda STOP para cancelar, HELP para ayuda. Pueden aplicar tarifas.` : `CellPay: Your payment for ***${last4} is confirmed. Reply STOP to opt out, HELP for help. Msg&data rates may apply.`; // CM-PZ-34332-HOST-1030
  return postpayBody(amount, carrier, last4, lang); // CM-PZ-34332-HOST-1030
} // CM-PZ-34332-HOST-1030