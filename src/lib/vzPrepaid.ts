// VZ-PREPAID-GUARD-1017: shared customer-only Verizon prepaid wording.
export const isVerizonSlug = (slug: unknown): boolean => slug === "verizon" || slug === "verizon-wireless-flexi";
export const VZ_NOTE = {
  en: "For Verizon Prepaid numbers only. Monthly Verizon bills can't be paid here.",
  es: "Solo para números Verizon Prepago. No se pueden pagar facturas mensuales de Verizon aquí.",
} as const;
export const VZ_NOTICE_MIN = 90;
export function vzBlockText(lang: string, method: string): string {
  const card = method.toLowerCase() === "card";
  return lang === "es"
    ? "Este número no se puede pagar como Verizon Prepago. Puede ser una cuenta mensual de Verizon u otra compañía." + (card ? " No se le hizo ningún cargo a su tarjeta." : " No se le hizo ningún cargo.")
    : "This number can't be paid as Verizon Prepaid. It may be a Verizon monthly account or another carrier." + (card ? " Your card was not charged." : " You were not charged.");
}