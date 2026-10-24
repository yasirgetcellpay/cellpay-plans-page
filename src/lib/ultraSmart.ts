import { ULTRA_LAST_PLAN } from "./ultraSmartFlags"; // ULTRA-SMART-PREVENT-1024
import { fetchCarrierView } from "@/services/apiWrapper"; // ULTRA-SMART-PREVENT-1024
export type UltraLastPlan = { amount: number; plan_id: string; date: string }; // ULTRA-SMART-PREVENT-1024
export type UltraHealth = { tier: "off" | "warn" | "pause"; retry_after?: number; probe_available?: boolean }; // ULTRA-SMART-PREVENT-1024
export type UltraPlan = { plan_id: string; amount: number; name?: string; carrierId?: number }; // ULTRA-SMART-PREVENT-1024
export async function ultraRead(name: string, query = "", fetcher: typeof fetch = fetch): Promise<unknown | null> { // ULTRA-SMART-PREVENT-1024
  const controller = new AbortController(); // ULTRA-SMART-PREVENT-1024
  let timer: ReturnType<typeof setTimeout> | undefined; // ULTRA-SMART-PREVENT-1024
  try { // ULTRA-SMART-PREVENT-1024
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; // ULTRA-SMART-PREVENT-1024
    const work = (async () => { // ULTRA-SMART-PREVENT-1024
      const response = await fetcher(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${name}${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal, cache: "no-store" }); // ULTRA-SMART-PREVENT-1024
      return response.ok ? await response.json() : null; // ULTRA-SMART-PREVENT-1024
    })(); // ULTRA-SMART-PREVENT-1024
    return await Promise.race([work.catch(() => null), new Promise<null>((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(null); }, 2000); })]); // ULTRA-SMART-PREVENT-1024
  } catch { return null; } finally { if (timer) clearTimeout(timer); } // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024
export async function readUltraLastPlan(phone: string, fetcher: typeof fetch = fetch): Promise<UltraLastPlan | Record<string, never> | null> { // ULTRA-SMART-PREVENT-1024
  if (!ULTRA_LAST_PLAN || !/^\d{10}$/.test(phone)) return null; // ULTRA-SMART-PREVENT-1024
  const value = await ultraRead("ultra-last-plan", `?phone=${encodeURIComponent(phone)}`, fetcher); // ULTRA-SMART-PREVENT-1024
  if (!value || typeof value !== "object" || Array.isArray(value)) return null; // ULTRA-SMART-PREVENT-1024
  if (Object.keys(value).length === 0) return {}; // ULTRA-SMART-PREVENT-1024
  const v = value as Record<string, unknown>; // ULTRA-SMART-PREVENT-1024
  return typeof v.amount === "number" && v.amount > 0 && typeof v.plan_id === "string" && typeof v.date === "string" && Number.isFinite(Date.parse(v.date)) ? { amount: v.amount, plan_id: v.plan_id, date: v.date } : null; // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024
export function currentUltraPlan(last: UltraLastPlan | null, plans: UltraPlan[]): UltraPlan | null { // ULTRA-SMART-PREVENT-1024
  return last ? plans.find((p) => String(p.plan_id) === last.plan_id && Number(p.amount) === last.amount) ?? null : null; // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024
export async function readUltraPlans(): Promise<UltraPlan[]> { // ULTRA-SMART-PREVENT-1024
  let timer: ReturnType<typeof setTimeout> | undefined; // ULTRA-SMART-PREVENT-1024
  try { // ULTRA-SMART-PREVENT-1024
    const data = await Promise.race([fetchCarrierView("ultra-mobile").catch(() => null), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 2000); })]); // ULTRA-SMART-PREVENT-1024
    if (!data) return []; // ULTRA-SMART-PREVENT-1024
    const cp = data.carrier_plans as unknown; const record = cp && typeof cp === "object" && !Array.isArray(cp) ? cp as Record<string, unknown> : {}; // ULTRA-SMART-PREVENT-1024
    const fixed = (data as Record<string, unknown>).fixed_plans ?? record.fixed_plans; // ULTRA-SMART-PREVENT-1024
    const rows = Array.isArray(fixed) ? fixed : fixed && typeof fixed === "object" && Array.isArray((fixed as Record<string, unknown>).plans) ? (fixed as { plans: unknown[] }).plans : Array.isArray(cp) ? cp : Array.isArray(record.plans) ? record.plans : []; // ULTRA-SMART-PREVENT-1024
    return rows.flatMap((item) => { // ULTRA-SMART-PREVENT-1024
      if (!item || typeof item !== "object") return []; const p = item as Record<string, unknown>; // ULTRA-SMART-PREVENT-1024
      const id = String(p.plan_id || p.planId || p.id || p.ID || ""), amount = Number(p.amount || p.price || p.Amount || 0), carrierId = Number(p.carrier); // ULTRA-SMART-PREVENT-1024
      return id && id !== "32993000" && Number.isFinite(amount) && amount > 0 ? [{ plan_id: id, amount, name: String(p.name || p.Name || p.description || ""), ...(Number.isFinite(carrierId) && carrierId > 0 ? { carrierId } : {}) }] : []; // ULTRA-SMART-PREVENT-1024
    }); // ULTRA-SMART-PREVENT-1024
  } catch { return []; } finally { if (timer) clearTimeout(timer); } // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024
export const ultra1065 = (slug: string, text: unknown) => slug === "ultra-mobile" && /1065|invalid\s+amount/i.test(String(text ?? "")); // ULTRA-SMART-PREVENT-1024
export function ultraEvent(event: "ultra_plan_mismatch_shown" | "ultra_plan_mismatch_accepted" | "ultra_plan_mismatch_overridden"): void { // ULTRA-SMART-PREVENT-1024
  try { const w = window as unknown as { dataLayer?: unknown[] }; (w.dataLayer = w.dataLayer || []).push({ event, carrier: "ultra-mobile" }); } catch { /* fail open */ } // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024
export function ultraHealthText(tier: string, lang: string): string { // ULTRA-SMART-PREVENT-1024
  return tier === "pause" ? (lang === "es" ? "Las recargas de Ultra no están disponibles temporalmente. Volverán pronto. Inténtelo de nuevo en unos 20 minutos." : "Ultra refills are temporarily unavailable — back shortly. Please try again in about 20 minutes.") : (lang === "es" ? "Las recargas de Ultra están tardando más ahora. Si falla, se le reembolsa automáticamente, o inténtelo de nuevo en unos 30 minutos." : "Ultra refills are running slow right now. If it fails you're refunded automatically, or try again in ~30 min."); // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024