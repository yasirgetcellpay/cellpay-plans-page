// Shared helpers for the CellPay help chat edge functions (order-status, support-contact).
// No checkout or proxy code is imported here, and these functions never call cellpay-proxy or api.cellpay.us.
//
// The three blocks between the "1b+D COPY" markers are BYTE-IDENTICAL copies of the same lines in
// supabase/functions/cellpay-proxy/index.ts (deploy 1b+D): the origin list, the origin/CORS check and the
// Fix D client-IP helper. Comments inside them are the proxy's own. Do not edit them here: rebuild with
// deploy9/build/build.py and check with deploy9/checks/verify-1b-blocks.py (it fails if they drift).

// ----- >>> 1b+D COPY: ORIGINS -----
// Production origins (final list from CellPay Fraud). Preview and localhost are for testing only.
// securepayusa.com is deliberately NOT allowed.
const ALLOWED_ORIGINS = new Set<string>([
  "https://cellpay.us",
  "https://www.cellpay.us",
  "https://refill.cellpay.us",
  // testing only
  "https://id-preview--570d1df0-fd6b-4a23-a70a-aa337f1f02ef.lovable.app",
  "https://570d1df0-fd6b-4a23-a70a-aa337f1f02ef.lovableproject.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
// ----- <<< 1b+D COPY: ORIGINS -----

// ----- >>> 1b+D COPY: CORS -----
const BASE_CORS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsFor(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { ...BASE_CORS, "Vary": "Origin" };
  if (origin !== null && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

/**
 * Requests with no Origin are refused: CellPay has no server-side callers of this function
 * (it is the only edge function, with no cron or other function invoking it). If one is ever
 * needed, give it a separate shared-secret header path instead of relaxing this check.
 * NOTE: Origin is a browser control only. A script can send any Origin, so this is not auth.
 */
function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}
// ----- <<< 1b+D COPY: CORS -----

// ----- >>> 1b+D COPY: IP -----
const TRUSTED_XFF_HOPS = Number(Deno.env.get("TRUSTED_XFF_HOPS") ?? "1");
const IPV4_RE = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Strict (CellPay Fraud review, Oct 3): IPv4 = exactly 4 decimal octets 0-255, no leading zeros; IPv6 = must contain ":",
// only hex/":"/"." characters, and must survive a real parse (WHATWG URL host parser). No zone ids, ports or brackets.
function isIp(v: string): boolean {
  if (typeof v !== "string" || v.length === 0 || v.length > 45) return false;
  if (IPV4_RE.test(v)) return true;
  if (!v.includes(":") || !/^[0-9a-fA-F:.]+$/.test(v)) return false;
  try {
    return new URL(`http://[${v}]/`).hostname.startsWith("[");
  } catch {
    return false;
  }
}
function clientIp(req: Request): { ip: string | null; src: "cf" | "xff" | "none" } {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (isIp(cf)) return { ip: cf, src: "cf" };
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const i = xff.length - TRUSTED_XFF_HOPS;
  if (i >= 0 && isIp(xff[i])) return { ip: xff[i], src: "xff" };
  return { ip: null, src: "none" };
}
// ----- <<< 1b+D COPY: IP -----

export { ALLOWED_ORIGINS, clientIp, corsFor, isAllowedOrigin, isIp };

/** JSON response with the per-request CORS headers from corsFor(origin). Never cached. */
export function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Rate-limit key for a request: the Fix D edge IP, or "unknown" (one shared, strictly limited bucket). */
export function rateLimitIp(req: Request): string {
  return clientIp(req).ip ?? "unknown";
}

/** Log-safe error class: only our own fixed codes (e.g. "orders_query_500", "settings_missing") pass; anything else
 *  (which could carry a phone, email or IP from a thrown message) is logged as "unclassified". */
export function errorClass(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return /^[a-z][a-z_]{0,40}(?:_\d{3})?$/.test(m) ? m : "unclassified";
}

/** Max request body we read (bytes). Larger bodies are refused with 400 before parsing. */
export const MAX_BODY_BYTES = 2048;

/** Read a small JSON body. Returns undefined when it is too large or not JSON. */
export async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

/** Same rules as Checkout's normalizePhone: digits only, drop US leading 1. Returns "" unless 10 digits. */
export function normalizeUsPhone(input: unknown): string {
  if (typeof input !== "string" && typeof input !== "number") return "";
  const raw = String(input);
  if (raw.length > 32) return "";
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return /^[2-9]\d{9}$/.test(d) ? d : "";
}

/** Last 4 of an order/transaction ID: exactly 4 letters/digits (no wildcards). Lower-cased. */
export function normalizeLast4(input: unknown): string {
  if (typeof input !== "string" && typeof input !== "number") return "";
  const s = String(input).trim();
  return /^[A-Za-z0-9]{4}$/.test(s) ? s.toLowerCase() : "";
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Checkout email: trim + lower-case only (no dot/plus stripping). "" if not a plausible address. */
export function normalizeEmail(input: unknown): string {
  if (typeof input !== "string") return "";
  const s = input.trim().toLowerCase();
  return s.length <= 254 && EMAIL.test(s) ? s : "";
}

/** HMAC-SHA256 hex of `kind:value`, prefixed with the FULL kind (e.g. "os:ip:"), so rows never hold a raw IP/phone/email. */
export async function bucketKey(secret: string, kind: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${kind}:${value}`));
  return `${kind}:` + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type RateLimitFn = (bucket: string, max: number, windowSeconds: number) => Promise<boolean>;

function serviceHeaders(serviceKey: string): Record<string, string> {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
}

/** PostgREST-backed rate limiter using public.help_rate_limit_hit (service role). Fails closed (throws). */
export function restRateLimiter(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch = fetch): RateLimitFn {
  return async (bucket, max, windowSeconds) => {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/help_rate_limit_hit`, {
      method: "POST",
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({ _bucket: bucket, _max: max, _window_seconds: windowSeconds }),
    });
    if (!res.ok) throw new Error(`rate_limit_rpc_${res.status}`);
    return (await res.json()) === true;
  };
}

export interface HelpSettings { chat_enabled: boolean; status_enabled: boolean; contact_enabled: boolean; }

/** Server-side read of the runtime switch row (id = 1). Throws on any error, so callers fail closed (503). */
export function restSettings(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch = fetch): () => Promise<HelpSettings> {
  return async () => {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/help_settings?select=chat_enabled,status_enabled,contact_enabled&id=eq.1`, {
      headers: serviceHeaders(serviceKey),
    });
    if (!res.ok) throw new Error(`settings_${res.status}`);
    const rows = (await res.json()) as HelpSettings[];
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("settings_missing");
    return rows[0];
  };
}

export type HelpEventFn = "order-status" | "support-contact";
export type LogEventFn = (fn: HelpEventFn, outcome: string, lang: "en" | "es") => Promise<void>;

/** Insert one PII-free help_events row. Never throws (watch metrics must not break the answer). */
export function restEventLogger(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch = fetch): LogEventFn {
  return async (fn, outcome, lang) => {
    try {
      await fetchFn(`${supabaseUrl}/rest/v1/help_events`, {
        method: "POST",
        headers: { ...serviceHeaders(serviceKey), Prefer: "return=minimal" },
        body: JSON.stringify({ fn, outcome, lang }),
      });
    } catch { /* ignore */ }
  };
}
