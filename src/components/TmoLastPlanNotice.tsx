import { Button } from "@/components/ui/button"; // REFILL-PREVENT-TMO-1026
import { tmoText } from "@/lib/tmoLastPlan"; // REFILL-PREVENT-TMO-1026
import type { useTmoLastPlan } from "@/hooks/useTmoLastPlan"; // REFILL-PREVENT-TMO-1026
export function TmoLastPlanNotice({ smart, lang, onUseLast, onContinue }: { smart: ReturnType<typeof useTmoLastPlan>; lang: string; onUseLast?: () => void; onContinue?: () => void }) { // REFILL-PREVENT-TMO-1026
  if (smart.pending === null || !smart.match) return null;
  const s = tmoText(lang);
  return <div role="alert" className="space-y-2 text-left text-sm text-foreground border border-border bg-muted rounded-lg p-3" data-testid="tmo-last-plan-confirm">
    <p>{s.confirm}</p>
    <Button type="button" className="w-full" onClick={() => { smart.useLast(); onUseLast?.(); }}>{s.use}</Button>
    <Button type="button" variant="outline" className="w-full" onClick={() => { smart.proceed(); onContinue?.(); }}>{s.cont}</Button>
  </div>;
} // REFILL-PREVENT-TMO-1026
