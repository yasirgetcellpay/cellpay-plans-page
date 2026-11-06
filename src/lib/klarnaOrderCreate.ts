import { outcomeOfError } from "./checkoutTimeout"; // KLARNA-ORDER-CREATE-HARDEN-1105
import { isCcRefund } from "./loadTextPick"; // KLARNA-ORDER-CREATE-HARDEN-1105
const codes = new Set(["BAD_PHONE", "CHARGE_UNCONFIRMED", "DUPLICATE", "DUP_CONFIRM", "IN_FLIGHT", "KLARNA_MIN_TOTAL", "MAYBE_PAID", "MAYBE_PAID_LOCK", "NAME_INVALID", "PLAN_GUARD", "REFILL_COOLDOWN", "RETRY_BLOCK", "RETRY_CAP", "RETRY_LATER", "RETRY_WAIT", "SESSION_PAID", "TMO_RETRY_24H", "ULTRA_CONFIRM", "ULTRA_PAUSED", "VZ_NOT_PREPAID"]); // KLARNA-ORDER-CREATE-HARDEN-1105
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; // KLARNA-ORDER-CREATE-HARDEN-1105
const refunded = (v: unknown, depth = 0): boolean => depth <= 8 && !!v && typeof v === "object" && (record(v).refund_signal === true || Object.values(v).some(x => refunded(x, depth + 1))); // KLARNA-ORDER-CREATE-HARDEN-1105
export function klarnaOrderResponseReason(value: unknown): string | null { // KLARNA-ORDER-CREATE-HARDEN-1105
  const raw = record(value); const inner = record(raw.data); const result = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? inner.data && typeof inner.data === "object" && !Array.isArray(inner.data) ? record(inner.data) : inner : raw; // KLARNA-ORDER-CREATE-HARDEN-1105
  if (refunded(raw) || isCcRefund(raw) || /error during refill|auto[\s-]?refund/i.test(String(result.msg || result.message || ""))) return null; // KLARNA-ORDER-CREATE-HARDEN-1105
  if (raw.code === "SESSION_PAID" && typeof raw.hashid === "string" && raw.hashid) return null; // KLARNA-ORDER-CREATE-HARDEN-1105
  if (result.status === true || result.status === "true" || ["success", "completed"].includes(String(result.status || "").toLowerCase())) return null; // KLARNA-ORDER-CREATE-HARDEN-1105
  return typeof raw.code === "string" && codes.has(raw.code) ? `response:${raw.code}` : "response:no_success"; // KLARNA-ORDER-CREATE-HARDEN-1105
} // KLARNA-ORDER-CREATE-HARDEN-1105
export function klarnaOrderExceptionReason(error: unknown): string { // KLARNA-ORDER-CREATE-HARDEN-1105
  const outcome = outcomeOfError(error, false); // KLARNA-ORDER-CREATE-HARDEN-1105
  return typeof outcome === "number" ? Number.isInteger(outcome) && outcome >= 100 && outcome <= 599 ? `exception:http:${outcome}` : "exception:network" : `exception:${outcome}`; // KLARNA-ORDER-CREATE-HARDEN-1105
} // KLARNA-ORDER-CREATE-HARDEN-1105
export function klarnaOrderFailureOnce(emit: (reason: string) => void): (reason: string | null) => void { // KLARNA-ORDER-CREATE-HARDEN-1105
  let sent = false; // KLARNA-ORDER-CREATE-HARDEN-1105
  return reason => { try { if (!reason || sent) return; sent = true; emit(reason); } catch { /* Logging never changes order handling. */ } }; // KLARNA-ORDER-CREATE-HARDEN-1105
} // KLARNA-ORDER-CREATE-HARDEN-1105