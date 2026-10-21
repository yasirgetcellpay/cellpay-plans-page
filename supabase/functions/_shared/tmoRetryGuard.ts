// TMO-LOOKUP-1020: pure fail-open guard; never handles payment credentials or transaction logging.
import { normalizePhone10 } from "./vzPrepaidGuard.ts";
type Payload = Record<string, unknown>;
type Lookup = (phone10: string) => Promise<{ blocked: boolean; retry_after: number }>;
type Why = "not_tmo" | "bad_phone" | "hit" | "allow" | "failopen_error" | "failopen_timeout";
type Decision = { block: boolean; why: Why; retry_after?: number };
export const tmoGuardApplies = (payload: Payload): boolean => String(payload.carrier_slug ?? "").trim().toLowerCase() === "tmobile";
export async function runTmoGuard(payload: Payload, lookup: Lookup, timeoutMs = 1200): Promise<Decision> {
  if (!tmoGuardApplies(payload)) return { block: false, why: "not_tmo" };
  const phone = normalizePhone10(payload.phone_number ?? payload.phone);
  if (!phone) return { block: false, why: "bad_phone" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => lookup(phone)).then((answer): Decision => {
        if (!answer || typeof answer.blocked !== "boolean" || typeof answer.retry_after !== "number" || !Number.isFinite(answer.retry_after)) {
          return { block: false, why: "failopen_error" };
        }
        return answer.blocked === true ? { block: true, why: "hit", retry_after: answer.retry_after } : { block: false, why: "allow" };
      }),
      new Promise<Decision>((resolve) => { timer = setTimeout(() => resolve({ block: false, why: "failopen_timeout" }), timeoutMs); }),
    ]);
  } catch { return { block: false, why: "failopen_error" }; }
  finally { clearTimeout(timer); }
}
export function tmoRetryMessage(lang: unknown, retryAfterSec: number): string {
  const h = Math.max(1, Math.ceil(retryAfterSec / 3600));
  return lang === "es"
    ? `Este número de T-Mobile no se puede recargar ahora. Una recarga reciente de T-Mobile para este número no se completó. Por favor espere unas ${h} ${h === 1 ? "hora" : "horas"} antes de intentarlo de nuevo. No se le hizo ningún cargo por este intento. Para revisar su plan T-Mobile Prepago, llame a T-Mobile al 1-877-778-2106 o marque 611 desde su teléfono T-Mobile.`
    : `This T-Mobile number can't be refilled right now. A recent T-Mobile refill for this number didn't go through, so please wait about ${h} ${h === 1 ? "hour" : "hours"} before you try again. You were not charged for this attempt. To check your T-Mobile Prepaid plan, call T-Mobile at 1-877-778-2106 or dial 611 from your T-Mobile phone.`;
}
export async function tmoGuardGate(payload: Payload, lang: unknown, deps: { lookup: Lookup; event: (code: string) => unknown }): Promise<Record<string, unknown> | null> {
  const result = await runTmoGuard(payload, deps.lookup);
  const event = (code: string) => { try { void Promise.resolve(deps.event(code)).catch(() => {}); } catch { /* ignore */ } };
  if (result.why.startsWith("failopen_")) { event("tmo_retry_failopen:" + result.why); return null; }
  if (!result.block || result.retry_after === undefined) return null;
  event("tmo_retry_24h");
  return { success: false, blocked: true, code: "TMO_RETRY_24H", retry_after: result.retry_after, message: tmoRetryMessage(lang, result.retry_after) };
}