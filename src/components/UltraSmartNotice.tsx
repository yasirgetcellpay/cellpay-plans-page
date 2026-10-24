import { Button } from "@/components/ui/button"; // ULTRA-SMART-PREVENT-1024
import { ultraHealthText } from "@/lib/ultraSmart"; // ULTRA-SMART-PREVENT-1024
import type { useUltraSmart } from "@/hooks/useUltraSmart"; // ULTRA-SMART-PREVENT-1024
export function UltraSmartNotice({ smart, lang, onContinue, onUsual }: { smart: ReturnType<typeof useUltraSmart>; lang: string; onContinue?: () => void; onUsual?: () => void }) { // ULTRA-SMART-PREVENT-1024
  const es = lang === "es", last = smart.last; // ULTRA-SMART-PREVENT-1024
  return <div className="space-y-3 text-sm text-foreground" data-testid="ultra-smart-notice">{/* // ULTRA-SMART-PREVENT-1024 */}
    {smart.health && smart.health.tier !== "off" && <p role="status" className="border border-border bg-muted rounded-lg p-3">{ultraHealthText(smart.paused ? "pause" : "warn", lang)}</p>}{/* // ULTRA-SMART-PREVENT-1024 */}
    {last && <p role="status">{es ? `Su línea recibió por última vez una recarga de Ultra de $${last.amount} el ${new Date(last.date).toLocaleDateString("es-US", { timeZone: "America/Chicago" })}.` : `Your line last refilled with Ultra $${last.amount} on ${new Date(last.date).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}.`}</p>}{/* // ULTRA-SMART-PREVENT-1024 */}
    {smart.usual && onContinue && <Button type="button" className="w-full whitespace-normal" disabled={smart.paused || (smart.noHistory && !smart.acknowledged)} onClick={onContinue}>{es ? `Continuar con $${smart.usual.amount}` : `Continue with $${smart.usual.amount}`}</Button>}{/* // ULTRA-SMART-PREVENT-1024 */}
    {smart.noHistory && <label className="flex gap-2 items-start text-left"><input type="checkbox" checked={smart.acknowledged} onChange={(e) => smart.acknowledge(e.target.checked)} className="mt-1" /><span>{es ? "Este es un número de Ultra Mobile. Los números transferidos recientemente a Ultra podrían no funcionar todavía." : "This is an Ultra Mobile number. Numbers recently ported to Ultra may not work yet."}</span></label>}{/* // ULTRA-SMART-PREVENT-1024 */}
    {last && smart.pending !== null && <div role="alert" className="space-y-2 text-left">{/* // ULTRA-SMART-PREVENT-1024 */}
      <p>{es ? `El plan de su línea suele ser de $${last.amount}. Ultra solo acepta el monto del plan de su línea. Cambie de plan solo si cambió de plan este mes.` : `Your line's plan is usually $${last.amount}. Ultra only accepts the amount of the plan on your line. Change plans only if you switched plans this month.`}</p>{/* // ULTRA-SMART-PREVENT-1024 */}
      {smart.usual && <Button type="button" className="w-full" onClick={() => { smart.accept(); onUsual?.(); }}>{es ? `Usar $${last.amount}` : `Use $${last.amount}`}</Button>}{/* // ULTRA-SMART-PREVENT-1024 */}
      <Button type="button" variant="outline" className="w-full whitespace-normal" onClick={smart.override}>{es ? "Sí, cambié mi plan" : "Yes, I changed my plan"}</Button>{/* // ULTRA-SMART-PREVENT-1024 */}
    </div>}{/* // ULTRA-SMART-PREVENT-1024 */}
  </div>; // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024