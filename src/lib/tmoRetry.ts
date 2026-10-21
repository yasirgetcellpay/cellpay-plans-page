// TMO-LOOKUP-1020: customer-only wording, matching the pure server guard.
export function tmoRetryText(lang: unknown, retryAfterSec: number): string {
  const h = Math.max(1, Math.ceil(retryAfterSec / 3600));
  return lang === "es"
    ? `Este número de T-Mobile no se puede recargar ahora. Una recarga reciente de T-Mobile para este número no se completó. Por favor espere unas ${h} ${h === 1 ? "hora" : "horas"} antes de intentarlo de nuevo. No se le hizo ningún cargo por este intento. Para revisar su plan T-Mobile Prepago, llame a T-Mobile al 1-877-778-2106 o marque 611 desde su teléfono T-Mobile.`
    : `This T-Mobile number can't be refilled right now. A recent T-Mobile refill for this number didn't go through, so please wait about ${h} ${h === 1 ? "hour" : "hours"} before you try again. You were not charged for this attempt. To check your T-Mobile Prepaid plan, call T-Mobile at 1-877-778-2106 or dial 611 from your T-Mobile phone.`;
}