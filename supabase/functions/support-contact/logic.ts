// support-contact: validate + sanitize a help chat contact message, then insert it into public.support_requests
// (service role). No Telegram, email or third-party calls. Calls no proxy and no CellPay API.
import {
  bucketKey, corsFor, errorClass, isAllowedOrigin, json, normalizeEmail, normalizeLast4, normalizeUsPhone, rateLimitIp, readJsonBody,
  type HelpSettings, type LogEventFn, type RateLimitFn,
} from "../_shared/help-guard.ts";

export const LIMIT_PER_HOUR = 3;
export const WINDOW_SECONDS = 3600;
export const MAX_NAME = 80;
export const MAX_MESSAGE = 1000;
export const MAX_PATH = 200;
// No "autopay_cancel": Auto Pay is cancelled only through the live AP-1 self-serve flow (Lead, Oct 3); email is the fallback.
export const CATEGORIES = ["order", "payment", "site_problem", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 13+ digits (covers 13-19-digit card numbers), optionally separated by single spaces or dashes. */
const CARD_LIKE = /(?<!\d)(?:\d[ -]?){12,}\d(?!\d)/g;
export const CARD_PLACEHOLDER = "[removed]";

export function stripCardNumbers(text: string): string {
  return text.replace(CARD_LIKE, CARD_PLACEHOLDER);
}

function clean(s: string, keepNewlines: boolean): string {
  const noCtrl = s.replace(keepNewlines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, keepNewlines ? "" : " ");
  return noCtrl.trim();
}

export interface SupportRow {
  lang: "en" | "es";
  name: string;
  contact: string;
  message: string;
  order_last4: string | null;
  page_path: string | null;
  category: Category | null;
}

export type ValidationResult = { ok: true; row: SupportRow } | { ok: false; errors: string[] };

export function validateSupportInput(input: unknown): ValidationResult {
  const o = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  const errors: string[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  const lang: "en" | "es" = o.lang === "es" ? "es" : "en";

  const name = stripCardNumbers(clean(str(o.name), false));
  if (!name || name.length > MAX_NAME) errors.push("name");

  const rawContact = clean(str(o.contact), false);
  const contact = rawContact.includes("@") ? normalizeEmail(rawContact) : normalizeUsPhone(rawContact);
  if (!contact) errors.push("contact");

  const rawMessage = clean(str(o.message), true);
  if (!rawMessage || rawMessage.length > MAX_MESSAGE) errors.push("message");
  const message = stripCardNumbers(rawMessage);

  let order_last4: string | null = null;
  const rawLast4 = str(o.order_last4).trim();
  if (rawLast4) {
    order_last4 = normalizeLast4(rawLast4) || null;
    if (!order_last4) errors.push("order_last4");
  }

  let category: Category | null = null;
  const rawCat = str(o.category).trim();
  if (rawCat) {
    if ((CATEGORIES as readonly string[]).includes(rawCat)) category = rawCat as Category;
    else errors.push("category");
  }

  // Path only (drop query/hash so no tokens or PII in URLs are stored).
  let page_path: string | null = null;
  const p = str(o.page_path).split(/[?#]/)[0].trim();
  if (p.startsWith("/") && !p.startsWith("//")) page_path = p.slice(0, MAX_PATH);

  if (errors.length) return { ok: false, errors };
  return { ok: true, row: { lang, name, contact, message, order_last4, page_path, category } };
}

export interface SupportDeps {
  rateLimit: RateLimitFn;
  insert: (row: SupportRow) => Promise<void>;
  settings: () => Promise<HelpSettings>;
  logEvent: LogEventFn;
  secret: string;
}

export interface HandlerResult { status: number; body: Record<string, unknown>; }

export async function handleSupportContact(input: unknown, ip: string, deps: SupportDeps): Promise<HandlerResult> {
  const settings = await deps.settings();
  if (!settings.contact_enabled) return { status: 503, body: { error: "unavailable" } };

  const o = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  // Honeypot: real users never see or fill "website". Pretend success, store nothing.
  if (typeof o.website === "string" && o.website.trim() !== "") return { status: 200, body: { ok: true } };

  const v = validateSupportInput(input);
  if (!v.ok) return { status: 400, body: { error: "invalid_input", fields: v.errors } };

  const allowed = await deps.rateLimit(await bucketKey(deps.secret, "sc:ip", ip), LIMIT_PER_HOUR, WINDOW_SECONDS);
  if (!allowed) return { status: 429, body: { error: "rate_limited" } };

  await deps.insert(v.row);
  return { status: 200, body: { ok: true } };
}

function outcomeOf(r: HandlerResult, input: unknown): string {
  if (r.status === 200) {
    const o = (input && typeof input === "object") ? input as Record<string, unknown> : {};
    if (typeof o.website === "string" && o.website.trim() !== "") return "honeypot";
    return "sent";
  }
  if (r.status === 429) return "rate_limited";
  if (r.status === 400) return "invalid";
  return "unavailable";
}

/** HTTP handler: origin check (1b+D list), POST only, body cap, Fix D IP. */
export function makeSupportContactHandler(deps: SupportDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const origin = req.headers.get("origin");
    const cors = corsFor(origin);
    if (!isAllowedOrigin(origin)) return json({ error: "not_allowed" }, 403, cors);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    const body = await readJsonBody(req);
    let r: HandlerResult;
    try {
      r = body === undefined
        ? { status: 400, body: { error: "invalid_input", fields: ["body"] } }
        : await handleSupportContact(body, rateLimitIp(req), deps);
    } catch (e) {
      // Never log the message, name or contact.
      console.error("support-contact error", errorClass(e));
      r = { status: 503, body: { error: "unavailable" } };
    }
    const lang = (body && typeof body === "object" && (body as Record<string, unknown>).lang === "es") ? "es" : "en";
    await deps.logEvent("support-contact", outcomeOf(r, body), lang);
    return json(r.body, r.status, cors);
  };
}
