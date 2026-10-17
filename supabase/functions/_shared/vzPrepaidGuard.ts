// VZ-PREPAID-GUARD-1017: pure, fail-open history guard; never handles payment credentials.
type Payload = Record<string, unknown>;
type Lookup = (phone10: string) => Promise<{ refunded: boolean; success: boolean }>;
type Why = "not_vz" | "bad_phone" | "hit" | "no_refund" | "prior_success" | "failopen_error" | "failopen_timeout";
export function normalizePhone10(v: unknown): string | null {
  let digits = String(v ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}
export const vzGuardApplies = (payload: Payload): boolean => String(payload.plan_id ?? payload.planId).trim() === "291945";
export async function runVzGuard(payload: Payload, lookup: Lookup, timeoutMs = 1500): Promise<{ block: boolean; why: Why }> {
  if (!vzGuardApplies(payload)) return { block: false, why: "not_vz" };
  const phone = normalizePhone10(payload.phone_number ?? payload.phone);
  if (!phone) return { block: false, why: "bad_phone" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => lookup(phone)).then((answer) => {
        if (!answer || typeof answer.refunded !== "boolean" || typeof answer.success !== "boolean") {
          return { block: false, why: "failopen_error" as const };
        }
        if (answer.success) return { block: false, why: "prior_success" as const };
        return answer.refunded ? { block: true, why: "hit" as const } : { block: false, why: "no_refund" as const };
      }),
      new Promise<{ block: boolean; why: Why }>((resolve) => {
        timer = setTimeout(() => resolve({ block: false, why: "failopen_timeout" }), timeoutMs);
      }),
    ]);
    return result;
  } catch {
    return { block: false, why: "failopen_error" };
  } finally {
    clearTimeout(timer);
  }
}
export function vzNotPrepaidMessage(lang: unknown, paymentMethod: string): string {
  const card = /^(cardpayment|card)$/i.test(paymentMethod);
  return lang === "es"
    ? "Este número no se puede pagar como Verizon Prepago. Puede ser una cuenta mensual de Verizon u otra compañía." + (card ? " No se le hizo ningún cargo a su tarjeta." : " No se le hizo ningún cargo.")
    : "This number can't be paid as Verizon Prepaid. It may be a Verizon monthly account or another carrier." + (card ? " Your card was not charged." : " You were not charged.");
}
export async function vzGuardGate(payload: Payload, lang: unknown, paymentMethod: string, deps: {
  lookup: Lookup;
  logFailedRow: (meta: { vz_guard: true }, errorMessage: string) => Promise<unknown>;
  event: (code: string) => unknown;
}): Promise<Record<string, unknown> | null> {
  if (!vzGuardApplies(payload)) return null;
  const result = await runVzGuard(payload, deps.lookup);
  const event = (code: string) => { try { void Promise.resolve(deps.event(code)).catch(() => {}); } catch { /* fail-open */ } };
  if (result.why.startsWith("failopen_")) {
    event("vz_guard_failopen:" + result.why);
    return null;
  }
  if (!result.block) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => deps.logFailedRow({ vz_guard: true }, "vz_prepaid_guard")),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, 3000); }),
    ]);
  } catch { /* a failed audit write must not change the block */ }
  finally { clearTimeout(timer); }
  event("vz_prepaid_guard");
  return { success: false, blocked: true, code: "VZ_NOT_PREPAID", message: vzNotPrepaidMessage(lang, paymentMethod) };
}