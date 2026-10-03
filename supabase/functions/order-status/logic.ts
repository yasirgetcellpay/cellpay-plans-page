// order-status: phone + ONE verifier (last 4 of the Order ID, or the checkout email) -> ONLY {status}.
// - Never returns a PIN, name, email, amount, carrier, date or card data. raw_response (PINs) is never read or selected (deviation c).
// - A last-4 match and an email match give byte-identical responses, and the same work is done either way
//   (same rate-limit calls, same query, both comparisons over every row, same minimum response time).
// - "No order", "wrong last 4" and "wrong email" all give the identical {"status":"not_found"}.
// - Calls no proxy and no CellPay API: it reads public.transaction_logs server-side with the service role.
import {
  bucketKey, corsFor, errorClass, isAllowedOrigin, json, normalizeEmail, normalizeLast4, normalizeUsPhone, rateLimitIp, readJsonBody,
  type HelpSettings, type LogEventFn, type RateLimitFn,
} from "../_shared/help-guard.ts";

export type PublicStatus = "success" | "failed" | "pending" | "unconfirmed" | "not_found";

/** Columns selected from public.transaction_logs (server-side only; never returned to the client). */
export interface OrderRow {
  status: string | null;
  transaction_id: string | null;
  hashid: string | null;
  payment_method: string | null;
  created_at: string | null;
  email: string | null;
  /** Used only to spot an upstream reply with no CellPay message (504/HTML timeout or gateway error). Never returned. */
  error_message?: string | null;
}

/** "last4_or_email" (Lead-approved default) or "last4" (last 4 only, as on the partner site). */
export type VerifierMode = "last4_or_email" | "last4";
export const VERIFIER_MODE: VerifierMode = "last4_or_email";

export const LIMIT_PER_HOUR = 5;
export const WINDOW_SECONDS = 3600;
export const UNCONFIRMED_AFTER_MS = 60 * 60_000;
/** Every answer (200, 400, 429, 503) takes at least this long, so match / no-match / email / last-4 look the same. */
export const MIN_RESPONSE_MS = 400;
export const LOOKBACK_DAYS = 180;

export function mapStatus(raw: string | null | undefined): "success" | "failed" | "pending" {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "success") return "success";
  if (s === "failed") return "failed";
  return "pending";
}

/**
 * A "failed" row is only a real decline when CellPay itself answered with a message. A 504/timeout (the proxy cannot parse
 * the HTML body, so finishTransactionLog stores its wrapper text "Request failed") or any reply with no CellPay message may
 * still have charged the card, so it is AMBIGUOUS -> "unconfirmed" (never "failed"/"try again": avoids double charges).
 * Decided from error_message alone, so raw_response is never read (deviation c). Lesson from the partner-site launch.
 */
export function isAmbiguousFailure(r: OrderRow): boolean {
  const m = String(r.error_message ?? "").trim().toLowerCase();
  return m === "" || m === "request failed";
}

export function idEndsWith(id: string | null | undefined, last4: string): boolean {
  if (!id || !last4) return false;
  const v = String(id).trim().toLowerCase();
  return v.length >= 4 && v.endsWith(last4);
}

export function isStalePending(createdAt: string | null | undefined, now: number): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return now - t > UNCONFIRMED_AFTER_MS;
}

export interface Verifier { last4: string; email: string; }

/** One field from the form: contains "@" -> email, else last 4. Returns null when invalid (or email in last4 mode). */
export function parseVerifier(input: unknown, mode: VerifierMode = VERIFIER_MODE): Verifier | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const raw = String(input);
  if (raw.length > 254) return null;
  if (raw.includes("@")) {
    if (mode !== "last4_or_email") return null;
    const email = normalizeEmail(raw);
    return email ? { last4: "", email } : null;
  }
  const last4 = normalizeLast4(raw);
  return last4 ? { last4, email: "" } : null;
}

/**
 * Rows must be newest first. Both comparisons run on every row (no early exit), and the newest matching row wins.
 * Pockyt (Cash App) rows -> "unconfirmed" (their "success" can mean "session created", not "paid"; until Fix B).
 * A row still pending more than 60 minutes after creation -> "unconfirmed". A fresh pending row stays "pending"
 * (UI: "still confirming, don't pay again"). An ambiguous "failed" (504/timeout/no CellPay message) -> "unconfirmed".
 * Last 4 matches the 6-char hashid (transaction_logs.transaction_id == hashid; no numeric CellPay id is stored).
 */
export function resolveStatus(rows: OrderRow[], v: Verifier, now: number = Date.now()): PublicStatus {
  let hit: OrderRow | null = null;
  for (const r of rows) {
    const byLast4 = idEndsWith(r.transaction_id, v.last4) || idEndsWith(r.hashid, v.last4);
    const rowEmail = (r.email ?? "").trim().toLowerCase();
    const byEmail = v.email !== "" && rowEmail !== "" && rowEmail === v.email;
    if ((byLast4 || byEmail) && hit === null) hit = r;
  }
  if (!hit) return "not_found";
  if ((hit.payment_method ?? "").trim().toLowerCase() === "pockyt") return "unconfirmed";
  const s = mapStatus(hit.status);
  if (s === "failed" && isAmbiguousFailure(hit)) return "unconfirmed";
  return s === "pending" && isStalePending(hit.created_at, now) ? "unconfirmed" : s;
}

export interface OrderStatusDeps {
  rateLimit: RateLimitFn;
  findOrders: (phone10: string) => Promise<OrderRow[]>;
  settings: () => Promise<HelpSettings>;
  logEvent: LogEventFn;
  secret: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface HandlerResult { status: number; body: Record<string, unknown>; }

/** Core logic (no HTTP). The caller has already checked the origin and the method. */
export async function handleOrderStatus(input: unknown, ip: string, deps: OrderStatusDeps): Promise<HandlerResult> {
  const settings = await deps.settings();
  if (!settings.status_enabled) return { status: 503, body: { error: "unavailable" } };

  // Per-IP limit counts every attempt (valid or not), keyed on the Fix D edge IP.
  const ipOk = await deps.rateLimit(await bucketKey(deps.secret, "os:ip", ip), LIMIT_PER_HOUR, WINDOW_SECONDS);
  if (!ipOk) return { status: 429, body: { error: "rate_limited" } };

  const o = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  const phone = normalizeUsPhone(o.phone);
  const v = parseVerifier(o.verifier);
  if (!phone || !v) return { status: 400, body: { error: "invalid_input" } };

  // Same two calls for both verifier types: the phone bucket and one verifier bucket ("os:vf").
  const phoneOk = await deps.rateLimit(await bucketKey(deps.secret, "os:ph", phone), LIMIT_PER_HOUR, WINDOW_SECONDS);
  const vfOk = await deps.rateLimit(await bucketKey(deps.secret, "os:vf", v.email || v.last4), LIMIT_PER_HOUR, WINDOW_SECONDS);
  if (!phoneOk || !vfOk) return { status: 429, body: { error: "rate_limited" } };

  const rows = await deps.findOrders(phone);
  return { status: 200, body: { status: resolveStatus(rows, v, (deps.now ?? Date.now)()) } };
}

/** Outcome label for help_events (no PII). */
function outcomeOf(r: HandlerResult): string {
  if (r.status === 200) return String(r.body.status);
  if (r.status === 429) return "rate_limited";
  if (r.status === 400) return "invalid";
  return "unavailable";
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HTTP handler: origin check (1b+D list), POST only, body cap, Fix D IP, minimum response time. */
export function makeOrderStatusHandler(deps: OrderStatusDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const origin = req.headers.get("origin");
    const cors = corsFor(origin);
    if (!isAllowedOrigin(origin)) return json({ error: "not_allowed" }, 403, cors);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    const now = deps.now ?? Date.now;
    const started = now();
    const body = await readJsonBody(req);
    let r: HandlerResult;
    try {
      r = body === undefined
        ? { status: 400, body: { error: "invalid_input" } }
        : await handleOrderStatus(body, rateLimitIp(req), deps);
    } catch (e) {
      // Error class only: never the phone, verifier or IP.
      console.error("order-status error", errorClass(e));
      r = { status: 503, body: { error: "unavailable" } };
    }
    const lang = (body && typeof body === "object" && (body as Record<string, unknown>).lang === "es") ? "es" : "en";
    await deps.logEvent("order-status", outcomeOf(r), lang);
    const wait = MIN_RESPONSE_MS - (now() - started);
    if (wait > 0) await (deps.sleep ?? defaultSleep)(wait);
    return json(r.body, r.status, cors);
  };
}

/** PostgREST query (service role, server-side only). Only the columns needed for matching + staleness. */
export function ordersQueryUrl(supabaseUrl: string, phone10: string, nowMs: number = Date.now()): string {
  const params = new URLSearchParams({
    select: "status,transaction_id,hashid,payment_method,created_at,email,error_message",
    phone_number: `eq.${phone10}`,
    created_at: `gte.${new Date(nowMs - LOOKBACK_DAYS * 86400_000).toISOString()}`,
    order: "created_at.desc",
    limit: "50",
  });
  return `${supabaseUrl}/rest/v1/transaction_logs?${params.toString()}`;
}
