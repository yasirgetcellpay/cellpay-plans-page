// Client-side checks for the help chat forms (the edge functions re-validate everything).

/** Same rules as Checkout's normalizePhone + order-status: 10 digits, US leading 1 dropped. "" if invalid. */
export function cleanPhone(input: string): string {
  let d = (input || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return /^[2-9]\d{9}$/.test(d) ? d : "";
}

/** Pretty (XXX) XXX-XXXX while typing. */
export function formatPhoneInput(input: string): string {
  const d = (input || "").replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function cleanLast4(input: string): string {
  const s = (input || "").trim();
  return /^[A-Za-z0-9]{4}$/.test(s) ? s : "";
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Checkout email: trim + lower-case (same as order-status). "" if not a plausible address. */
export function cleanEmail(input: string): string {
  const s = (input || "").trim().toLowerCase();
  return s.length <= 254 && EMAIL.test(s) ? s : "";
}

/** The one status-form verifier: checkout email (contains "@") or last 4 of the Order ID. "" if invalid. */
export function cleanVerifier(input: string): string {
  const s = (input || "").trim();
  return s.includes("@") ? cleanEmail(s) : cleanLast4(s);
}

export function isValidContact(input: string): boolean {
  const s = (input || "").trim();
  if (s.includes("@")) return s.length <= 254 && EMAIL.test(s);
  return !!cleanPhone(s);
}

export const MAX_MESSAGE = 1000;
export const MAX_NAME = 80;

/** How a failed edge-function call is shown: 429 rate limited, 400 bad input, 503 temporarily down, else generic. */
export type HelpErrorKind = "rate_limited" | "invalid" | "unavailable" | "error";
export function errorKindFor(httpStatus: number): HelpErrorKind {
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 400) return "invalid";
  if (httpStatus === 503) return "unavailable";
  return "error";
}

/** Statuses order-status may return in a 200 body; anything else is shown as a generic error. */
export const ORDER_STATUSES = ["success", "pending", "unconfirmed", "failed", "not_found"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
export function parseOrderStatus(data: unknown): OrderStatusValue | null {
  const st = (data && typeof data === "object") ? (data as { status?: unknown }).status : undefined;
  return typeof st === "string" && (ORDER_STATUSES as readonly string[]).includes(st) ? (st as OrderStatusValue) : null;
}

/** HC-ORDER-PHONE: optional recent-order cards (status + amount + carrier + time CT). */
export interface OrderCard { status: OrderStatusValue; amount: string; carrier: string; time_ct: string; }
export function parseOrderCards(data: unknown): OrderCard[] {
  const raw = (data && typeof data === "object") ? (data as { orders?: unknown }).orders : undefined;
  if (!Array.isArray(raw)) return [];
  const out: OrderCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const st = typeof o.status === "string" && (ORDER_STATUSES as readonly string[]).includes(o.status) ? (o.status as OrderStatusValue) : null;
    if (!st || st === "not_found") continue;
    out.push({
      status: st,
      amount: typeof o.amount === "string" ? o.amount : "",
      carrier: typeof o.carrier === "string" ? o.carrier : "",
      time_ct: typeof o.time_ct === "string" ? o.time_ct : "",
    });
  }
  return out;
}

/** Statuses that must never invite a second payment (pending / ambiguous). */
export function isDoNotPayAgain(s: OrderStatusValue | HelpErrorKind | null): boolean {
  return s === "pending" || s === "unconfirmed";
}
