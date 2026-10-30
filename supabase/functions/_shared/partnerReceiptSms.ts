import { postpayMdn } from "./postpaySms.ts"; // CM-PZ-34332-HOST-1030
export { postpayMdn }; // CM-PZ-34332-HOST-1030
export type PartnerBrand = "callingmart" | "pinzoo"; // CM-PZ-34332-HOST-1030
export function partnerReceiptBody({ brand, amount, carrier, last4, lang }: { brand: PartnerBrand; amount?: number; carrier?: string; last4: string; lang: "en" | "es" }): string { // CM-PZ-34332-HOST-1030
  const display = brand === "callingmart" ? "CallingMart" : "PinZoo"; // CM-PZ-34332-HOST-1030
  if (amount === undefined || !carrier) return lang === "es" ? `${display}: Su pago para ***${last4} está confirmado. Responda STOP para cancelar, HELP para ayuda. Pueden aplicar tarifas.` : `${display}: Your payment for ***${last4} is confirmed. Reply STOP to opt out, HELP for help. Msg&data rates may apply.`; // CM-PZ-34332-HOST-1030
  return lang === "es" ? `${display}: Su recarga ${carrier} de $${amount.toFixed(2)} para ***${last4} está pagada. Responda STOP para cancelar, HELP para ayuda. Pueden aplicar tarifas.` : `${display}: Your $${amount.toFixed(2)} ${carrier} refill for ***${last4} is paid. Reply STOP to opt out, HELP for help. Msg&data rates may apply.`; // CM-PZ-34332-HOST-1030
} // CM-PZ-34332-HOST-1030