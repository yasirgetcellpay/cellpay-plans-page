// retention-1006 (Oct 6, 2026): optional refill-reminder opt-in on the confirmation page. UNCHECKED by default; nothing is saved
// until the customer ticks the box (and, only if checkout captured no email, types one and taps Save). The server takes the phone,
// carrier and amount from the paid order (hashid), not from this page. No effect on payment, fees, Auto Pay or purchase tracking.
import { useState } from "react";
import type { Language } from "@/lib/i18n";

const CONSENT_VERSION = "v1";
const PLACEHOLDER = "customer@cellpay.us";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type State = "idle" | "saving" | "saved" | "error" | "need_email";

export function ReminderOptIn({ lang, hashid, email, brandColor }: { lang: Language; hashid: string; email?: string; brandColor: string }) {
  const es = lang === "es";
  const hasEmail = !!email && email.trim().toLowerCase() !== PLACEHOLDER && EMAIL_RE.test(email.trim());
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<State>("idle");
  if (!hashid) return null;

  const save = async (emailArg: string | null) => {
    const su = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const sk = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!su || !sk) { setState("error"); return; }
    setState("saving");
    try {
      const r = await fetch(su + "/rest/v1/rpc/reminder_optin_create", {
        method: "POST",
        headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" },
        body: JSON.stringify({ _hashid: hashid, _lang: es ? "es" : "en", _consent_version: CONSENT_VERSION, _email: emailArg, _source: "order_confirmation" }),
      });
      const out = r.ok ? await r.json() : "error";
      setState(out === "ok" ? "saved" : out === "need_email" ? "need_email" : "error");
    } catch {
      setState("error");
    }
  };

  const onToggle = (v: boolean) => {
    setChecked(v);
    if (v && hasEmail && state !== "saved") void save(null);
  };

  if (state === "saved") {
    return (
      <div className="bg-card rounded-xl border border-border p-5" role="status">
        <p className="text-sm font-bold text-foreground">
          {es ? "Listo. Le enviaremos un correo antes de su próxima recarga." : "Done. We'll email you before your next refill."}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {es ? "Cada correo trae un enlace para darse de baja." : "Every email has a link to unsubscribe."}
        </p>
      </div>
    );
  }

  const showEmailField = checked && (!hasEmail || state === "need_email");
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 flex-shrink-0"
          style={{ accentColor: brandColor }}
          checked={checked}
          disabled={state === "saving"}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-bold text-foreground">
            {es ? "Envíenme un correo antes de mi próxima recarga" : "Email me a reminder before my next refill"}
          </span>
          <span className="block text-xs text-muted-foreground mt-1">
            {es
              ? "Unas 4 semanas después de este pago, y otra vez a principios del próximo mes si no ha recargado. Hasta 2 correos al mes. Puede darse de baja cuando quiera."
              : "About 4 weeks after this payment, and once more early next month if you haven't refilled. Up to 2 emails a month. Unsubscribe anytime."}
          </span>
        </span>
      </label>
      {showEmailField && (
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={es ? "Su correo electrónico" : "Your email"}
            className="flex-1 h-11 rounded-lg border border-border px-3 text-sm bg-background"
            aria-label={es ? "Correo electrónico" : "Email"}
          />
          <button
            type="button"
            disabled={!EMAIL_RE.test(typed.trim()) || state === "saving"}
            onClick={() => void save(typed.trim())}
            className="h-11 px-4 rounded-lg text-primary-foreground font-bold text-sm disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {es ? "Guardar" : "Save"}
          </button>
        </div>
      )}
      {state === "error" && (
        <p className="text-xs text-destructive mt-2">
          {es ? "No pudimos guardar esto ahora. Su pago no cambia." : "We couldn't save this right now. Your payment is not affected."}
        </p>
      )}
    </div>
  );
}
