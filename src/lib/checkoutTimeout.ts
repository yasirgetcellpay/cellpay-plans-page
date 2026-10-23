// CHECKOUT-TIMEOUT-1023: client timeout, outcome classification and PII-free attempt logging for POST checkout/transaction only.
export const CHECKOUT_TIMEOUT_MS = 120000;

export type AttemptOutcome = number | "timeout" | "network";

export function newAttemptId(): string {
  try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID(); } catch { /* fallback */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Outcome of a thrown call: HTTP status when the server answered, else "timeout" (our abort) or "network". */
export function outcomeOfError(error: unknown, timedOut: boolean): AttemptOutcome {
  if (timedOut) return "timeout";
  const e = error && typeof error === "object" ? error as { status?: unknown; cpStatus?: unknown; name?: unknown } : {};
  const s = typeof e.status === "number" ? e.status : typeof e.cpStatus === "number" ? e.cpStatus : undefined;
  if (s !== undefined) return s;
  return e.name === "AbortError" ? "timeout" : "network";
}

/** Timeout, network failure after send, 502 and 504 mean the charge may have happened. */
export function isOutcomeUnknown(outcome: AttemptOutcome): boolean {
  return outcome === "timeout" || outcome === "network" || outcome === 502 || outcome === 504;
}

export function confirmingMessage(lang: "en" | "es"): string {
  return lang === "es" ? "Estamos confirmando su pago, por favor no vuelva a pagar." : "We're confirming your payment, please don't pay again.";
}

/** Only attemptId, outcome and duration; never the body, card data, names, emails, phones or tokens. */
export function logAttempt(attemptId: string, outcome: AttemptOutcome, durationMs: number): void {
  try { console.info(`[checkout-attempt] ${JSON.stringify({ attemptId, outcome, durationMs: Math.round(durationMs) })}`); } catch { /* ignore */ }
}
