// CARRIER-ASSIST-1011: client side of the carrier hint. Fail-open: any error, timeout or odd answer = no hint.
import { supabase } from "@/integrations/supabase/client";

export const CARRIER_LABELS: Record<string, string> = {
  "s1": "Simple Mobile", "boost": "Boost Mobile", "metropcs": "Metro PCS", "topup-crc": "Cricket Wireless",
  "ultra-mobile": "Ultra Mobile", "straight-talk": "Straight Talk", "total-wireless": "Total Wireless", "h2o": "H2O Wireless",
  "topup-at": "AT&T Prepaid", "tmobile": "T-Mobile", "verizon": "Verizon", "lyca": "Lyca Mobile", "net10": "NET10",
  "pageplus": "Page Plus", "tracfone": "Tracfone",
};
export const carrierLabel = (slug: string): string => CARRIER_LABELS[slug] || slug;

const SID_KEY = "cp_ch_sid_v1";
const CACHE_KEY = "cp_ch_cache_v1";
const KEEP_KEY = "cp_ch_keep_v1";

function sessionId(): string {
  try {
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) {
      s = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
      sessionStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch { return ""; }
}

/** One call per phone+picked carrier per tab session (the answer, including "none", is cached). Only runs on a full 10-digit phone. */
export async function fetchCarrierHint(phone10: string, picked: string): Promise<string | null> {
  if (!/^\d{10}$/.test(phone10) || !picked) return null;
  const ck = `${phone10}|${picked}`;
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (c && c.k === ck) return typeof c.v === "string" ? c.v : null;
  } catch { /* ignore */ }
  const sid = sessionId();
  if (sid.length < 8) return null;
  try {
    const { data, error } = await supabase.functions.invoke("carrier-hint", { body: { phone: phone10, picked, sid } });
    if (error) return null;
    const v = data && typeof (data as { carrier?: unknown }).carrier === "string" ? String((data as { carrier: string }).carrier) : null;
    const out = v && v !== picked && CARRIER_LABELS[v] ? v : null;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ k: ck, v: out })); } catch { /* ignore */ }
    return out;
  } catch { return null; }
}

export function carrierHintKept(phone10: string, picked: string): boolean {
  try { return sessionStorage.getItem(KEEP_KEY) === `${phone10}|${picked}`; } catch { return false; }
}
export function keepCarrierHint(phone10: string, picked: string): void {
  try { sessionStorage.setItem(KEEP_KEY, `${phone10}|${picked}`); } catch { /* ignore */ }
}
