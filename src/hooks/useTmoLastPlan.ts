import { useEffect, useRef, useState } from "react"; // REFILL-PREVENT-TMO-1026
import { matchTmoPlan, readTmoLastPlan, tmoEvent, tmoNeedsConfirm, TMO_SLUG, type TmoLastPlan, type TmoPlan } from "@/lib/tmoLastPlan"; // REFILL-PREVENT-TMO-1026
import { rpVariant } from "@/lib/refillPrevent"; // REFILL-PREVENT-TMO-1026
export function useTmoLastPlan(slug: string, phone: string, ready: boolean, plans: TmoPlan[], onSelect?: (plan: TmoPlan) => void, canPreselect?: () => boolean) { // REFILL-PREVENT-TMO-1026 // TMO-AMOUNT-FORCE-1031
  const [lookup, setLookup] = useState<{ phone: string; last: TmoLastPlan | null } | null>(null);
  const [pending, setPending] = useState<{ phone: string; amount: number } | null>(null);
  const [continuedFor, setContinuedFor] = useState<string | null>(null);
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const canPreselectRef = useRef(canPreselect); canPreselectRef.current = canPreselect; // TMO-AMOUNT-FORCE-1031
  const shownRef = useRef<string | null>(null);
  const on = slug === TMO_SLUG;
  const last = on && lookup?.phone === phone ? lookup.last : null;
  const match = matchTmoPlan(last, plans);
  useEffect(() => {
    if (!on || !ready || !/^\d{10}$/.test(phone)) return;
    let cancelled = false;
    void readTmoLastPlan(phone).then((r) => { if (!cancelled) setLookup({ phone, last: r && "plan_id" in r ? (r as TmoLastPlan) : null }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [on, phone, ready]);
  useEffect(() => {
    if (!match || shownRef.current === phone) return;
    shownRef.current = phone;
    try { if (!canPreselectRef.current || canPreselectRef.current()) selectRef.current?.(match); } catch { /* fail open: preserve amount */ } // TMO-AMOUNT-FORCE-1031
    tmoEvent("last_plan_shown", slug, rpVariant());
  }, [match, phone, slug]);
  const gate = (amount: number): boolean => {
    try {
      if (!tmoNeedsConfirm(slug, match ? last : null, amount, phone, continuedFor)) return true;
      setPending({ phone, amount }); tmoEvent("last_plan_mismatch_confirm", slug, rpVariant()); return false;
    } catch { return true; }
  };
  return {
    last, match, gate,
    pending: pending?.phone === phone ? pending.amount : null,
    useLast: () => { setPending(null); if (match) { try { selectRef.current?.(match); } catch { /* ignore */ } } },
    proceed: () => { setContinuedFor(phone); setPending(null); },
  };
} // REFILL-PREVENT-TMO-1026
