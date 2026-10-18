// DB-OUTAGE-TRACK-1017: pure per-isolate best-effort duplicate protection, never persisted or logged.
export type MemdupEntry = { s: "inflight" | "success" | "unknown"; hashid?: string; exp: number };
export const MEMDUP_MS = 180000;
export const MEMDUP_UNKNOWN_MS = 600000;
function record(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function cardFactJson(v: unknown): Record<string, unknown> { if (typeof v !== "string") return record(v); try { return record(JSON.parse(v)); } catch { return {}; } }
export function memdupKey(payload: Record<string, unknown>, paymentMethod: string | null): string | null {
  const phone = String(payload.phone_number ?? "").replace(/\D/g, "").slice(-10);
  const amount = Number(payload.amount);
  if (phone.length !== 10 || !Number.isFinite(amount) || amount <= 0) return null;
  const method = String(paymentMethod || "").toLowerCase();
  let last4 = "";
  if (method.startsWith("card")) last4 = String(record(payload.payment).cc_number ?? "").replace(/\D/g, "").slice(-4);
  else if (method === "applepay") last4 = /(\d{4})\s*$/.exec(String(record(cardFactJson(payload.apple_pay_token).paymentMethod).displayName ?? ""))?.[1] || "";
  return `${phone}|${amount.toFixed(2)}|${method}|${last4}`;
}
function prune(map: Map<string, MemdupEntry>, now: number): void {
  for (const [k, e] of map) if (e.exp <= now) map.delete(k);
  while (map.size > 2000) { const oldest = map.keys().next().value; if (oldest === undefined) break; map.delete(oldest); }
}
export function memdupCheck(map: Map<string, MemdupEntry>, key: string | null, dupConfirmed: boolean, now = Date.now()): { code: "IN_FLIGHT" | "SESSION_PAID"; hashid?: string } | null {
  prune(map, now);
  if (!key) return null;
  const e = map.get(key);
  if (e && !(e.s === "success" && dupConfirmed)) {
    e.exp = Math.max(e.exp, now + MEMDUP_MS);
    return e.s === "success" ? { code: "SESSION_PAID", hashid: e.hashid } : { code: "IN_FLIGHT" };
  }
  map.set(key, { s: "inflight", exp: now + MEMDUP_MS });
  prune(map, now);
  return null;
}
export function memdupUpdate(map: Map<string, MemdupEntry>, key: string | null, state: "success" | "unknown" | "decline", hashid?: string, now = Date.now()): void {
  prune(map, now);
  if (!key) return;
  if (state === "decline" || (state === "success" && !hashid)) map.delete(key);
  else map.set(key, state === "success" ? { s: "success", hashid, exp: now + MEMDUP_MS } : { s: "unknown", exp: Math.max(map.get(key)?.exp || 0, now + MEMDUP_UNKNOWN_MS) });
  prune(map, now);
}