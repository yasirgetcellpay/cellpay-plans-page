// TMO-FORMAT-1121: T-Mobile + Flexi only. True when a 10-digit number's exchange (digit 4) starts with 0 or 1.
// Area code 0/1 is already refused for every carrier by phoneOk. Pure, never throws; any error -> false (fail open).
export const TMO_FORMAT_SLUGS = new Set(["tmobile", "tmobile-flexi"]);
export function tmoExchangeBad(slug: unknown, phone10: unknown): boolean {
  try {
    if (!TMO_FORMAT_SLUGS.has(String(slug ?? "").trim().toLowerCase())) return false;
    return /^[2-9]\d{2}[01]\d{6}$/.test(String(phone10 ?? ""));
  } catch { return false; }
}
export const tmoCheckNumberText = (lang: string) =>
  lang === "es" ? "Por favor, verifique su número de teléfono." : "Please check your phone number.";
