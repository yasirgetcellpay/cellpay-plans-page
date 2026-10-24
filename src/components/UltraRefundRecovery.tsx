import { Button } from "@/components/ui/button"; // ULTRA-SMART-PREVENT-1024
import { currentUltraPlan, type UltraLastPlan, type UltraPlan } from "@/lib/ultraSmart"; // ULTRA-SMART-PREVENT-1024
export function UltraRefundRecovery({ amount, total, last, plans, lang, onPlan, onList }: { amount: number; total: number; last: UltraLastPlan | null; plans: UltraPlan[]; lang: string; onPlan: (plan: UltraPlan) => void; onList: () => void }) { // ULTRA-SMART-PREVENT-1024
  const es = lang === "es", usual = currentUltraPlan(last, plans); // ULTRA-SMART-PREVENT-1024
  return <div className="space-y-3" data-testid="ultra-refund-recovery">{/* // ULTRA-SMART-PREVENT-1024 */}
    <p className="text-sm text-muted-foreground">{es ? `Ultra rechazó $${amount} para esta línea. Eso suele significar que su línea tiene un plan diferente. Se le reembolsaron $${total.toFixed(2)}.` : `Ultra rejected $${amount} for this line. That usually means your line is on a different plan. You were refunded $${total.toFixed(2)}.`}</p>{/* // ULTRA-SMART-PREVENT-1024 */}
    {usual && usual.amount !== amount ? <Button type="button" className="w-full whitespace-normal" onClick={() => onPlan(usual)}>{es ? `Recargue $${usual.amount} (su plan habitual)` : `Refill $${usual.amount} (your usual plan)`}</Button> : <>{/* // ULTRA-SMART-PREVENT-1024 */}
      <p className="text-sm text-foreground">{es ? "Revise su plan en la app My Ultra" : "Check your plan in the My Ultra app"}</p>{/* // ULTRA-SMART-PREVENT-1024 */}
      <div className="grid grid-cols-2 gap-2">{plans.map((p) => <Button type="button" key={p.plan_id} variant="outline" disabled={p.amount === amount} className="disabled:opacity-40" onClick={() => onPlan(p)}>${p.amount}</Button>)}</div>{/* // ULTRA-SMART-PREVENT-1024 */}
      {!plans.length && <Button type="button" variant="outline" className="w-full" onClick={onList}>{es ? "Elegir otro monto" : "Choose another amount"}</Button>}{/* // ULTRA-SMART-PREVENT-1024 */}
    </>}{/* // ULTRA-SMART-PREVENT-1024 */}
  </div>; // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024