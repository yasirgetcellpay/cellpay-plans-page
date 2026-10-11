// CARRIER-ASSIST-1011: "You paid with X last time. Use X?" (never auto-switches) + "Not sure of your carrier?" help link.
// Loaded lazily by Checkout when the browser is idle. In shadow mode the server answers no hint, so only the help link shows.
import { useEffect, useState, lazy, Suspense } from "react";
import { fetchCarrierHint, carrierLabel, carrierHintKept, keepCarrierHint } from "@/lib/carrierHint";

const CarrierHelpSheet = lazy(() => import("@/components/CarrierHelpSheet"));

export interface CarrierAssistProps {
  lang: "en" | "es";
  phone: string;
  carrierSlug: string;
  brandColor: string;
  onUse: (slug: string) => void;
}

export default function CarrierAssist({ lang, phone, carrierSlug, brandColor, onUse }: CarrierAssistProps) {
  const es = lang === "es";
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  const [hint, setHint] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setHint(null);
    setDismissed(carrierHintKept(digits, carrierSlug));
    if (digits.length === 10 && carrierSlug) {
      fetchCarrierHint(digits, carrierSlug).then((c) => { if (live) setHint(c); }).catch(() => undefined);
    }
    return () => { live = false; };
  }, [digits, carrierSlug]);

  useEffect(() => {
    const f = () => setOpen(true);
    window.addEventListener("cp-carrier-help", f);
    return () => window.removeEventListener("cp-carrier-help", f);
  }, []);

  const name = hint ? carrierLabel(hint) : "";
  const mine = carrierLabel(carrierSlug);
  return (
    <>
      {hint && !dismissed && (
        <div className="bg-card rounded-xl border-2 p-4" style={{ borderColor: brandColor }} role="region" aria-label={es ? "Sugerencia de compañía" : "Carrier suggestion"} data-testid="carrier-hint">
          <p className="text-sm text-foreground mb-3">
            {es ? <>La última vez pagó con <b>{name}</b>. ¿Usar {name}?</> : <>You paid with <b>{name}</b> last time. Use {name}?</>}
          </p>
          <div className="space-y-2">
            <button type="button" data-testid="carrier-hint-use" onClick={() => onUse(hint)} className="w-full px-4 py-2.5 rounded-lg font-bold text-sm text-primary-foreground" style={{ backgroundColor: brandColor }}>
              {es ? `Usar ${name}` : `Use ${name}`}
            </button>
            <button type="button" data-testid="carrier-hint-keep" onClick={() => { keepCarrierHint(digits, carrierSlug); setDismissed(true); }} className="w-full px-4 py-2.5 rounded-lg font-bold text-sm border-2 border-border text-foreground bg-background">
              {es ? `Mantener ${mine}` : `Keep ${mine}`}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {es ? "Solo comparamos este número con sus propios pagos anteriores. Nada cambia a menos que usted lo toque." : "We only compare this number with your own past payments. Nothing changes unless you tap."}
          </p>
        </div>
      )}
      <div className="text-center -my-2">
        <button type="button" data-testid="carrier-help-link" onClick={() => setOpen(true)} className="text-sm underline text-muted-foreground">
          {es ? "¿No está seguro de su compañía?" : "Not sure of your carrier?"}
        </button>
      </div>
      {open && (
        <Suspense fallback={null}>
          <CarrierHelpSheet lang={lang} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
