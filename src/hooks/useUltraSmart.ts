import { useEffect, useRef, useState } from "react"; // ULTRA-SMART-PREVENT-1024
import { currentUltraPlan, readUltraLastPlan, ultraRead, ultraEvent, type UltraLastPlan, type UltraPlan, type UltraHealth } from "@/lib/ultraSmart"; // ULTRA-SMART-PREVENT-1024
import { ULTRA_SOFT_CONFIRM, ULTRA_NOHISTORY_CONFIRM } from "@/lib/ultraSmartFlags"; // ULTRA-SMART-PREVENT-1024
export function useUltraSmart(slug: string, phone: string, ready: boolean, plans: UltraPlan[], onSelect?: (plan: UltraPlan) => void) { // ULTRA-SMART-PREVENT-1024
  const [lookup, setLookup] = useState<{ phone: string; last: UltraLastPlan | null; empty: boolean } | null>(null); // ULTRA-SMART-PREVENT-1024
  const [health, setHealth] = useState<UltraHealth | null>(null); // ULTRA-SMART-PREVENT-1024
  const [ack, setAck] = useState<string | null>(null); // ULTRA-SMART-PREVENT-1024
  const [pending, setPending] = useState<{ phone: string; amount: number } | null>(null); // ULTRA-SMART-PREVENT-1024
  const [approved, setApproved] = useState<{ phone: string; amount: number } | null>(null); // ULTRA-SMART-PREVENT-1024
  const selectRef = useRef(onSelect); selectRef.current = onSelect; // ULTRA-SMART-PREVENT-1024
  const selectedRef = useRef<string | null>(null); // ULTRA-SMART-PREVENT-1024
  const last = lookup?.phone === phone ? lookup.last : null; // ULTRA-SMART-PREVENT-1024
  const usual = currentUltraPlan(last, plans); // ULTRA-SMART-PREVENT-1024
  const noHistory = Boolean(ULTRA_NOHISTORY_CONFIRM && lookup?.phone === phone && lookup.empty); // ULTRA-SMART-PREVENT-1024
  useEffect(() => { // ULTRA-SMART-PREVENT-1024
    if (slug !== "ultra-mobile" || !ready || !/^\d{10}$/.test(phone)) return; // ULTRA-SMART-PREVENT-1024
    let cancelled = false; // ULTRA-SMART-PREVENT-1024
    void readUltraLastPlan(phone).then((result) => { // ULTRA-SMART-PREVENT-1024
      if (cancelled) return; // ULTRA-SMART-PREVENT-1024
      const hit = result && "plan_id" in result ? result as UltraLastPlan : null; // ULTRA-SMART-PREVENT-1024
      setLookup(result ? { phone, last: hit, empty: !hit } : null); // ULTRA-SMART-PREVENT-1024
    }); // ULTRA-SMART-PREVENT-1024
    return () => { cancelled = true; }; // ULTRA-SMART-PREVENT-1024
  }, [slug, phone, ready]); // ULTRA-SMART-PREVENT-1024
  useEffect(() => { // ULTRA-SMART-PREVENT-1024
    if (!usual || selectedRef.current === phone) return; // ULTRA-SMART-PREVENT-1024
    selectedRef.current = phone; selectRef.current?.(usual); // ULTRA-SMART-PREVENT-1024
  }, [usual, phone]); // ULTRA-SMART-PREVENT-1024
  useEffect(() => { // ULTRA-SMART-PREVENT-1024
    if (slug !== "ultra-mobile") return; // ULTRA-SMART-PREVENT-1024
    let cancelled = false; // ULTRA-SMART-PREVENT-1024
    const refresh = async () => { const result = await ultraRead("ultra-health"); if (!cancelled) setHealth(result && typeof result === "object" && "tier" in result ? result as UltraHealth : null); }; // ULTRA-SMART-PREVENT-1024
    void refresh(); const interval = setInterval(() => void refresh(), 60000); // ULTRA-SMART-PREVENT-1024
    return () => { cancelled = true; clearInterval(interval); }; // ULTRA-SMART-PREVENT-1024
  }, [slug]); // ULTRA-SMART-PREVENT-1024
  const paused = slug === "ultra-mobile" && health?.tier === "pause" && !health.probe_available; // ULTRA-SMART-PREVENT-1024
  const gate = (amount: number): boolean => { // ULTRA-SMART-PREVENT-1024
    try { // ULTRA-SMART-PREVENT-1024
      if (slug !== "ultra-mobile") return true; // ULTRA-SMART-PREVENT-1024
      if (paused || (noHistory && ack !== phone)) return false; // ULTRA-SMART-PREVENT-1024
      if (ULTRA_SOFT_CONFIRM && last && amount !== last.amount && !(approved?.phone === phone && approved.amount === amount)) { // ULTRA-SMART-PREVENT-1024
        setPending({ phone, amount }); ultraEvent("ultra_plan_mismatch_shown"); return false; // ULTRA-SMART-PREVENT-1024
      } // ULTRA-SMART-PREVENT-1024
      return true; // ULTRA-SMART-PREVENT-1024
    } catch { return true; } // ULTRA-SMART-PREVENT-1024
  }; // ULTRA-SMART-PREVENT-1024
  return { last, usual, noHistory, acknowledged: ack === phone, acknowledge: (checked: boolean) => setAck(checked ? phone : null), health, paused, gate, pending: pending?.phone === phone ? pending.amount : null, accept: () => { if (usual) { selectRef.current?.(usual); ultraEvent("ultra_plan_mismatch_accepted"); setPending(null); } }, override: () => { if (pending) { setApproved(pending); setPending(null); ultraEvent("ultra_plan_mismatch_overridden"); } } }; // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024