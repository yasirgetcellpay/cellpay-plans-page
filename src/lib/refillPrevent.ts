// REFILL-PREVENT-1024: pure-ish helpers. Every function fails open (returns "today's behavior") on any error.
// Never stores or logs a full phone number: storage keys are SHA-256 hashes, analytics carry carrier + variant only.
import { RP_AB_END } from "./refillPreventFlags";

export type RpVariant = "rp" | "control";
const COOKIE = "cp_rp";

/** 50/50 session split (session cookie). Any error -> control. */
export function rpVariant(now: number = Date.now(), rnd: () => number = Math.random): RpVariant {
  try {
    const m = document.cookie.match(/(?:^|;\s*)cp_rp=(rp|control)\b/);
    if (m) return m[1] as RpVariant;
    if (now >= Date.parse(RP_AB_END)) return "control";
    const v: RpVariant = rnd() < 0.5 ? "rp" : "control";
    document.cookie = `${COOKIE}=${v}; path=/; SameSite=Lax`;
    return v;
  } catch { return "control"; }
}

export function rpEvent(event: "rp_format_error" | "rp_confirm_mismatch" | "rp_retry_blocked" | "rp_dead_amount_shown", carrier: string, variant: string): void {
  try { const w = window as unknown as { dataLayer?: unknown[] }; (w.dataLayer = w.dataLayer || []).push({ event, carrier, variant }); } catch { /* ignore */ }
}

/** P1: true when the number is clearly not a valid US number. */
export function phoneFormatBad(input: unknown): boolean {
  try {
    const d = String(input ?? "").replace(/\D/g, "");
    if (d.length !== 10) return true;
    if (d[0] === "0" || d[0] === "1") return true;
    if (d.slice(3, 6) === "555" && d.slice(6, 8) === "01") return true;
    if (/^(\d)\1{9}$/.test(d)) return true;
    return false;
  } catch { return false; }
}
export const formatErrorText = (lang: string) => lang === "es" ? "Ingrese un número de teléfono válido de 10 dígitos." : "Please enter a valid 10-digit phone number.";
export const confirmLabel = (lang: string) => lang === "es" ? "Confirme el número de teléfono" : "Confirm phone number";

/** P2: LoadText that means "this plan won't load on this line". */
export const isPlanMismatchLoadText = (t: unknown): boolean => /1065|invalid amount|plan does not match|not eligible|past\s*due/i.test(String(t ?? ""));
export const retryBlockText = (lang: string) => lang === "es" ? "Este plan no coincide con su línea. Elija otro plan." : "This plan doesn't match your line. Pick a different plan.";
export const RP_BLOCK_MS = 30 * 60 * 1000;
const STORE = "cp_rp_block_v1";
type Entry = { pc: string; until: number };

export async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const keys = async (phone: unknown, carrier: unknown, plan: unknown) => {
  const d = String(phone ?? "").replace(/\D/g, "").slice(-10);
  if (d.length !== 10 || !carrier) return null;
  const h = await sha256(d);
  return { k: `${h}|${carrier}|${String(plan ?? "")}`, pc: `${h}|${carrier}` };
};
const read = (now: number): Record<string, Entry> => {
  const raw = JSON.parse(localStorage.getItem(STORE) || "{}");
  const out: Record<string, Entry> = {};
  for (const [k, e] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    const v = e as Entry; if (v && typeof v.until === "number" && v.until > now && typeof v.pc === "string") out[k] = v;
  }
  return out;
};

export async function recordRetryBlock(phone: unknown, carrier: unknown, plan: unknown, now: number = Date.now()): Promise<void> {
  try { const x = await keys(phone, carrier, plan); if (!x) return; const q = read(now); q[x.k] = { pc: x.pc, until: now + RP_BLOCK_MS }; localStorage.setItem(STORE, JSON.stringify(q)); } catch { /* fail open */ }
}

/** True only for the identical number + carrier + plan within 30 min. A different plan on the same line clears the block. */
export async function checkRetryBlock(phone: unknown, carrier: unknown, plan: unknown, now: number = Date.now()): Promise<boolean> {
  try {
    const x = await keys(phone, carrier, plan); if (!x) return false;
    const q = read(now);
    if (q[x.k]) return true;
    let changed = false;
    for (const [k, e] of Object.entries(q)) if (e.pc === x.pc) { delete q[k]; changed = true; }
    if (changed) localStorage.setItem(STORE, JSON.stringify(q));
    return false;
  } catch { return false; }
}

export const isDiscontinuedLoadText = (t: unknown): boolean => { try { return /discontinued|product not found|does not exist|product not sold|sku not (found|mapped)/i.test(String(t ?? "")); } catch { return false; } }; // LYCA-SKU-FIX-1024
export const RP_DISC_MS = 24 * 60 * 60 * 1000; // LYCA-SKU-FIX-1024
const DISC_STORE = "cp_rp_disc_v1"; // LYCA-SKU-FIX-1024
export const discBlockText = (lang: string) => lang === "es" ? "Este plan no se puede cargar en este número por ahora. Elija otro plan." : "This plan can't be loaded on this number right now. Pick a different plan."; // LYCA-SKU-FIX-1024
export async function recordDiscBlock(phone: unknown, carrier: unknown, plan: unknown, now: number = Date.now()): Promise<void> { // LYCA-SKU-FIX-1024
  try { // LYCA-SKU-FIX-1024
    if (carrier === "ultra-mobile" || !plan) return; // LYCA-SKU-FIX-1024
    const x = await keys(phone, carrier, plan); if (!x) return; // LYCA-SKU-FIX-1024
    const raw = JSON.parse(localStorage.getItem(DISC_STORE) || "{}"); // LYCA-SKU-FIX-1024
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return; // LYCA-SKU-FIX-1024
    localStorage.setItem(DISC_STORE, JSON.stringify({ ...raw, [x.k]: now + RP_DISC_MS })); // LYCA-SKU-FIX-1024
  } catch { /* fail open */ } // LYCA-SKU-FIX-1024
} // LYCA-SKU-FIX-1024
export async function checkDiscBlock(phone: unknown, carrier: unknown, plan: unknown, now: number = Date.now()): Promise<boolean> { // LYCA-SKU-FIX-1024
  try { // LYCA-SKU-FIX-1024
    if (carrier === "ultra-mobile" || !plan) return false; // LYCA-SKU-FIX-1024
    const x = await keys(phone, carrier, plan); if (!x) return false; // LYCA-SKU-FIX-1024
    const raw = JSON.parse(localStorage.getItem(DISC_STORE) || "{}"); // LYCA-SKU-FIX-1024
    const until = raw?.[x.k]; return typeof until === "number" && Number.isFinite(until) && until > now; // LYCA-SKU-FIX-1024
  } catch { return false; } // LYCA-SKU-FIX-1024
} // LYCA-SKU-FIX-1024

/** Resolve within `ms`; on timeout or error resolve `fallback`. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => { const t = setTimeout(() => resolve(fallback), ms); p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); }); });
}

/** P2b guidance lines. */
export function guidanceText(slug: string, lang: string): string | null {
  const es = lang === "es";
  if (slug === "ultra-mobile") return es ? "Elija el plan que tiene su línea ahora. Para cambiar de plan, use primero la app de Ultra." : "Pick the plan your line is on now. To change plans, use the Ultra app first.";
  if (slug === "tmobile") return es ? "Elija el monto de su plan mensual actual. El monto debe coincidir exactamente con su plan." : "Pick your current monthly plan amount. The amount must match your plan exactly.";
  return null;
}

/** P4 */
export type DeadAmount = { carrier_slug: string; plan_id: string; amount: number };
export const deadLabel = (lang: string) => lang === "es" ? "No disponible por ahora" : "Temporarily unavailable";
export function isDeadAmount(list: DeadAmount[], slug: string, planId: unknown, amount: unknown): boolean {
  try {
    if (slug === "ultra-mobile") return false; // hard guard
    return list.some((d) => d.carrier_slug === slug && d.carrier_slug !== "ultra-mobile" && String(d.plan_id) === String(planId ?? "") && Number(d.amount) === Number(amount));
  } catch { return false; }
}
let memo: { at: number; items: DeadAmount[] } | null = null;
export async function fetchDeadAmounts(fetcher: typeof fetch = fetch, now: number = Date.now()): Promise<DeadAmount[]> {
  try {
    if (memo && now - memo.at < 600000) return memo.items;
    const id = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetcher(`https://${id}.supabase.co/functions/v1/dead-amounts`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const j = await r.json();
    const items = Array.isArray(j?.items) ? (j.items as DeadAmount[]).filter((d) => d && d.carrier_slug !== "ultra-mobile") : [];
    memo = { at: now, items };
    return items;
  } catch { return []; }
}
export const _resetDeadMemo = () => { memo = null; };

/** P6 */
export const isStPastDue = (slug: unknown, loadText: unknown): boolean => slug === "straight-talk" && /past\s*due|no eligible plan/i.test(String(loadText ?? ""));
export const stPastDueText = (lang: string) => lang === "es" ? "Su línea está vencida. Elija la tarjeta de plan de servicio que la reactiva." : "Your line is past due. Choose the Service Plan Card that reactivates it.";
