// DB-OUTAGE-TRACK-1017: phone + refill amount only; no credentials or card data.
export const PAYLOCK_MS = 180000;
export const PAYLOCK_UNKNOWN_MS = 600000;
export const SOFT_TIMEOUT_MS = 45000;
type State = "pending" | "paid" | "unknown";
export type PayLock = { s: State; until: number };
const STORE = "cp_paylock_v1";
export function lockKey(phone: unknown, amount: unknown): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "").slice(-10);
  const value = Number(amount);
  return digits.length === 10 && Number.isFinite(value) && value > 0 ? `${digits}|${value.toFixed(2)}` : null;
}
function read(): Record<string, PayLock> {
  const raw: unknown = JSON.parse(localStorage.getItem(STORE) || "{}");
  return Object.fromEntries(Object.entries(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}).filter(([, e]) => e && ["pending", "paid", "unknown"].includes(e.s) && Number.isFinite(e.until) && e.until > Date.now()));
}
export function activeLock(key: string | null): PayLock | null {
  try { const q = read(); localStorage.setItem(STORE, JSON.stringify(q)); return key ? q[key] || null : null; } catch { return null; }
}
export function setLock(key: string | null, s: State, minMs: number): void {
  if (!key) return;
  try { const q = read(); q[key] = { s, until: Math.max(q[key]?.until || 0, Date.now() + minMs) }; localStorage.setItem(STORE, JSON.stringify(q)); } catch { /* fail open */ }
}
export function clearLock(key: string | null): void {
  if (!key) return;
  try { const q = read(); delete q[key]; localStorage.setItem(STORE, JSON.stringify(q)); } catch { /* fail open */ }
}
export function refusedBeforeCharge(error: unknown): boolean {
  const e = error && typeof error === "object" ? error as { name?: string; cpStatus?: number } : {};
  return e.name === "PlanGuardError" || (typeof e.cpStatus === "number" && e.cpStatus >= 400 && e.cpStatus < 500);
}
// Shared execution lets tests exercise exactly the wrapper's timing and locking, without aborting the payment.
export async function runPayLocked(key: string | null, skip: boolean, call: () => Promise<unknown>, paid: (raw: unknown) => boolean, onSoftTimeout: (until: number) => void, onSettled: () => void): Promise<unknown> {
  if (!key || skip) return call();
  const existing = activeLock(key);
  if (existing) { setLock(key, existing.s, PAYLOCK_MS); return { success: false, code: "MAYBE_PAID_LOCK" }; }
  setLock(key, "pending", PAYLOCK_MS);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = call();
    const soft = new Promise<{ soft: true }>((resolve) => { timer = setTimeout(() => {
      setLock(key, "unknown", PAYLOCK_UNKNOWN_MS);
      onSoftTimeout(activeLock(key)?.until ?? Date.now() + PAYLOCK_UNKNOWN_MS);
      resolve({ soft: true });
    }, SOFT_TIMEOUT_MS); });
    const first = await Promise.race([request.then((raw) => ({ raw })), soft]);
    const raw = "soft" in first ? await request : first.raw;
    const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    if (paid(raw)) setLock(key, "paid", PAYLOCK_MS);
    else if (r.code === "IN_FLIGHT" || r.code === "CHARGE_UNCONFIRMED") setLock(key, "unknown", PAYLOCK_UNKNOWN_MS);
    else clearLock(key);
    onSettled();
    return raw;
  } catch (error) {
    if (refusedBeforeCharge(error)) { clearLock(key); onSettled(); throw error; }
    setLock(key, "unknown", PAYLOCK_UNKNOWN_MS);
    return { success: false, code: "MAYBE_PAID" };
  } finally { if (timer) clearTimeout(timer); }
}