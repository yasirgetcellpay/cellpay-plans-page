// REFUNDED-STATE-1017: refunded-order lookups for the receipt page and order history. 1500 ms cap; any error = not refunded.
import { supabase } from "@/integrations/supabase/client";

export type RefundState = { total: number; carrierSlug: string };

const cap = <T,>(p: PromiseLike<T>): Promise<T | null> =>
  Promise.race([Promise.resolve(p), new Promise<null>((res) => setTimeout(() => res(null), 1500))]).catch(() => null);

export async function fetchRefundState(hashid: string): Promise<RefundState | null> {
  try {
    if (!hashid) return null;
    const r = await cap(supabase.rpc("order_refund_state", { _hashid: hashid }));
    const d = r && !r.error ? (r.data as Record<string, unknown> | null) : null;
    if (!d || typeof d !== "object" || d.refunded !== true) return null;
    return { total: Number(d.total) || 0, carrierSlug: String(d.carrier_slug ?? "") };
  } catch {
    return null;
  }
}

export async function fetchRefundedHashids(hashids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const list = Array.from(new Set(hashids.map((h) => String(h || "").trim()).filter(Boolean))).slice(0, 50);
    if (!list.length) return out;
    const r = await cap(supabase.rpc("order_refund_states", { _hashids: list }));
    if (r && !r.error && Array.isArray(r.data)) for (const row of r.data as Array<{ hashid?: string }>) if (row?.hashid) out.add(row.hashid);
  } catch { /* ignore */ }
  return out;
}

export const isPayWord = (s: string): boolean => /metro|boost|cricket/i.test(s);

export function refundedPanelText(lang: string, payWord: boolean, total: number): { title: string; text: string } {
  const amt = `$${Number(total || 0).toFixed(2)}`;
  if (lang === "es") {
    return payWord
      ? { title: "Pago no completado", text: `Su pago no se completó, así que le reembolsamos sus ${amt}. Según su banco, puede tardar unos días hábiles en reflejarse. Revise el número y el plan e inténtelo de nuevo.` }
      : { title: "Recarga no completada", text: `Su recarga no se completó, así que le reembolsamos su pago de ${amt}. Según su banco, puede tardar unos días hábiles en reflejarse. Revise el número y el plan e inténtelo de nuevo.` };
  }
  return payWord
    ? { title: "Payment not completed", text: `Your payment didn't go through, so we refunded your ${amt}. Depending on your bank, it can take a few business days to show. Please check the number and plan and try again.` }
    : { title: "Refill not completed", text: `Your refill didn't go through, so we refunded your payment of ${amt}. Depending on your bank, it can take a few business days to show. Please check the number and plan and try again.` };
}
