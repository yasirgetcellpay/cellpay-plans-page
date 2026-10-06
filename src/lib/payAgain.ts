// RT-3 (Oct 6, 2026): "Pay again" link. The last confirmed order's carrier, number and amount are kept on THIS device only
// (localStorage), so a bookmarked /pay-again opens that carrier page with the number and amount filled in. No login and no
// server call. Inputs only: never a fee, total, card or Auto Pay choice. Checkout re-validates everything as usual.
import type { Language } from "@/lib/i18n";

const KEY = "cp_pay_again_v1";
const OFF_KEY = "cp_pay_again_off_v1"; // the customer tapped "Don't save my number" on this device
const TTL_MS = 180 * 24 * 60 * 60 * 1000;

export interface PayAgainInfo {
  slug: string;
  carrierName: string;
  phone: string;
  amount: string;
  color: string;
  ts: number;
}

const digits10 = (input: string): string => {
  let d = (input || "").replace(/\D/g, "");
  while (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 && !/^[01]/.test(d) ? d : "";
};
const safeColor = (c: unknown): string =>
  typeof c === "string" && /^(#[0-9a-f]{3,8}|hsla?\([0-9.,%\s]+\)|rgba?\([0-9.,%\s]+\))$/i.test(c.trim()) ? c.trim() : "";

/** Save this order for next time (this device only). Returns false when the order is missing a number, carrier or amount. */
export function savePayAgain(i: { slug?: string; carrierName?: string; phone?: string; amount?: number | string; color?: string }): boolean {
  const phone = digits10(String(i.phone || ""));
  const slug = String(i.slug || "").trim().toLowerCase();
  const amount = Number(i.amount);
  if (!phone || !slug || !(amount > 0)) return false;
  try {
    if (localStorage.getItem(OFF_KEY)) return false;
    localStorage.setItem(KEY, JSON.stringify({
      v: 1, ts: Date.now(), slug, carrierName: String(i.carrierName || ""), phone, amount: String(amount), color: safeColor(i.color),
    }));
    return true;
  } catch {
    return false;
  }
}

export function readPayAgain(): PayAgainInfo | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!v || v.v !== 1 || typeof v.ts !== "number" || Date.now() - v.ts > TTL_MS) return null;
    const phone = digits10(String(v.phone || ""));
    const amount = Number(v.amount);
    if (!phone || typeof v.slug !== "string" || !v.slug || !(amount > 0)) return null;
    return { slug: v.slug, carrierName: String(v.carrierName || ""), phone, amount: String(amount), color: safeColor(v.color), ts: v.ts };
  } catch {
    return null;
  }
}

/** Remove the saved number. optOut = also stop saving numbers on this device. */
export function clearPayAgain(optOut = false): void {
  try {
    localStorage.removeItem(KEY);
    if (optOut) localStorage.setItem(OFF_KEY, "1");
  } catch { /* ignore */ }
}

export const payAgainPath = (lang: Language): string => `${lang === "es" ? "/es" : ""}/pay-again`;
export const lastFour = (phone: string): string => digits10(phone).slice(-4);
