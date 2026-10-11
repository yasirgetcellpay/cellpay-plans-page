// METHODS-VISIBILITY-1011: presentation only. First method (wallet on iPhone/Android, card elsewhere) as a full-width tile, then
// "or pay with" and every other offered method as a compact tile (Pay by Bank last). The method list, order logic, selection and
// handlers all stay in Checkout.tsx; this component only draws them.
import type { ComponentType, CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";

export interface PickerMethod { key: string; label: string; Brand: ComponentType<{ className?: string }> }
interface Props {
  methods: PickerMethod[];
  selected: string;
  onSelect: (key: string) => void;
  brandColor: string;
  lang: "en" | "es";
}

export function PaymentMethodPicker({ methods, selected, onSelect, brandColor, lang }: Props) {
  const es = lang === "es";
  const primary = methods[0];
  const rest = [...methods.slice(1).filter((m) => m.key !== "plaid"), ...methods.slice(1).filter((m) => m.key === "plaid")]; // Pay by Bank last (display order only)
  const on = (k: string): CSSProperties | undefined => selected === k
    ? { borderColor: brandColor, backgroundColor: /^#[0-9a-f]{6}$/i.test(brandColor || "") ? `${brandColor}14` : undefined, boxShadow: `0 0 0 1px ${brandColor}` }
    : undefined;
  const cls = (k: string, base: string) => `${base} relative rounded-lg border-2 font-bold transition-all flex items-center justify-center ${selected === k ? "text-foreground shadow-sm" : "border-border text-muted-foreground hover:border-current bg-card"}`;
  if (!primary) return null;
  return (
    <div className="bg-card rounded-xl border border-border p-5" role="group" aria-label={es ? "Elija cómo pagar" : "Choose how to pay"} data-testid="method-picker">
      <h2 className="font-bold text-foreground mb-3 text-sm">{es ? "Elija cómo pagar" : "Choose how to pay"}</h2>
      <button type="button" data-testid="method-primary" data-method={primary.key} onClick={() => onSelect(primary.key)} aria-pressed={selected === primary.key}
        className={cls(primary.key, "w-full min-h-[60px] px-3 gap-3 text-sm flex-row")} style={on(primary.key)}>
        {selected === primary.key && <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5" style={{ color: brandColor }} aria-hidden="true" />}
        <span className="h-7 flex items-center justify-center"><primary.Brand className="h-6 w-auto max-w-[72px] object-contain" /></span>
        <span>{primary.label}</span>
      </button>
      {rest.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-3 text-xs text-muted-foreground" aria-hidden="true">
            <span className="flex-1 h-px bg-border" /><span>{es ? "o pague con" : "or pay with"}</span><span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {rest.map((m) => (
              <button key={m.key} type="button" data-testid={`method-chip-${m.key}`} data-method={m.key} onClick={() => onSelect(m.key)} aria-pressed={selected === m.key}
                className={cls(m.key, "min-h-[56px] py-2 px-1 text-xs flex-col gap-1")} style={on(m.key)}>
                {selected === m.key && <CheckCircle2 className="absolute top-1 right-1 h-3.5 w-3.5" style={{ color: brandColor }} aria-hidden="true" />}
                <span className="h-5 w-full flex items-center justify-center"><m.Brand className="h-5 w-auto max-w-[64px] object-contain" /></span>
                <span className="text-[11px] leading-tight text-center">{m.label}</span>
                {m.key === "plaid" && <span className="text-[10px] leading-none font-medium text-muted-foreground">{es ? "Vincule su banco" : "Link your bank"}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
