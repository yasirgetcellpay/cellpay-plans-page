// retention-1006 (Oct 6, 2026): pages behind the links in our emails (noindex). Opening a page never changes anything; only a button does.
//  /unsubscribe, /es/unsubscribe  -> "Unsubscribe" button -> email-links {a:"unsub"}
//  /r, /es/r                      -> refill link: carrier page with the number + amount filled in (same hand-off as /pay-again)
//  /ap/cancel, /es/ap/cancel      -> "Cancel Auto Pay for {Carrier} ••1234?" button -> token check, then the EXISTING AP-1
//                                    autopay/unsubscribe call (same call as the Help "Unsubscribe From Autopay" form)
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { useLang } from "@/lib/i18n";
import { applySeoHead } from "@/lib/seo";
import { carrierPageTarget } from "@/lib/checkoutResume";
import { callProxy } from "@/services/apiWrapper";

const GREEN = "hsl(142,70%,40%)";
async function links(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const su = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const sk = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!su || !sk) return { ok: false };
  try {
    const r = await fetch(su + "/functions/v1/email-links", { method: "POST", headers: { apikey: sk, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json()) as Record<string, unknown>;
  } catch { return { ok: false }; }
}
function useNoindex(title: string) {
  useEffect(() => {
    applySeoHead({ title, description: title });
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const original = robots?.getAttribute("content") ?? null;
    if (!robots) { robots = document.createElement("meta"); robots.setAttribute("name", "robots"); document.head.appendChild(robots); }
    robots.setAttribute("content", "noindex,nofollow");
    return () => { if (original !== null) robots!.setAttribute("content", original); };
  }, [title]);
}
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col bg-background">
    <main className="flex-1 max-w-md mx-auto w-full px-4 py-8 sm:py-12">
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 sm:p-6 text-center">{children}</div>
    </main>
    <PaymentBar lang={useLang()} />
    <Footer />
    <LegalBar />
  </div>
);
const Btn = ({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="mt-5 w-full h-12 rounded-lg text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: GREEN }}>
    {children}
  </button>
);
const token = (search: string) => new URLSearchParams(search).get("t") || "";

export const EmailUnsubscribe = () => {
  const es = useLang() === "es"; const { search } = useLocation(); const t = token(search);
  const [st, setSt] = useState<"idle" | "busy" | "done" | "bad">("idle");
  useNoindex(es ? "Darse de baja | CellPay" : "Unsubscribe | CellPay");
  const go = async () => { setSt("busy"); const r = await links({ a: "unsub", t }); setSt(r.ok ? "done" : "bad"); };
  return (
    <Frame>
      <h1 className="text-xl font-extrabold text-foreground">{es ? "Recordatorios de recarga" : "Refill reminders"}</h1>
      {st === "done" ? (
        <p className="mt-3 text-base">{es ? "Listo. Ya no le enviaremos recordatorios de recarga." : "Done. We won't send you refill reminders anymore."}</p>
      ) : st === "bad" || !t ? (
        <p className="mt-3 text-sm text-muted-foreground">{es ? "Este enlace no es válido. Escriba a support@getcellpay.com y lo daremos de baja." : "This link isn't valid. Email support@getcellpay.com and we'll remove you."}</p>
      ) : (
        <>
          <p className="mt-3 text-base">{es ? "¿Dejar de recibir correos de recordatorio de recarga?" : "Stop getting refill reminder emails?"}</p>
          <Btn onClick={go} disabled={st === "busy"}>{es ? "Darse de baja" : "Unsubscribe"}</Btn>
        </>
      )}
    </Frame>
  );
};

export const RefillLink = () => {
  const lang = useLang(); const es = lang === "es"; const navigate = useNavigate(); const { search, hash } = useLocation(); const t = token(search);
  const [bad, setBad] = useState(false);
  useNoindex(es ? "Recargar | CellPay" : "Refill | CellPay");
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await links({ a: "refill", t });
      if (!live) return;
      if (r.ok && typeof r.slug === "string" && r.slug) {
        const rest = new URLSearchParams(search); rest.delete("t");
        const qs = rest.toString();
        navigate(carrierPageTarget(lang, r.slug, String(r.phone || ""), r.amount != null ? String(r.amount) : undefined, qs ? `?${qs}` : "", hash), { replace: true });
      } else setBad(true);
    })();
    return () => { live = false; };
  }, []);
  return (
    <Frame>
      <h1 className="text-xl font-extrabold text-foreground">{es ? "Recargar" : "Refill"}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {bad ? (es ? "Este enlace venció. Elija su operador para recargar." : "This link has expired. Choose your carrier to refill.") : (es ? "Un momento…" : "One moment…")}
      </p>
      {bad && <Btn onClick={() => navigate(es ? "/es" : "/")}>{es ? "Elegir mi operador" : "Choose my carrier"}</Btn>}
    </Frame>
  );
};

export const AutoPayCancel = () => {
  const es = useLang() === "es"; const { search } = useLocation(); const t = token(search);
  const [info, setInfo] = useState<{ last4?: string; charge_date?: string; used?: boolean } | null>(null);
  const [st, setSt] = useState<"load" | "ready" | "busy" | "done" | "bad" | "later">("load");
  useNoindex(es ? "Cancelar pago automático | CellPay" : "Cancel Auto Pay | CellPay");
  useEffect(() => { (async () => { const r = await links({ a: "ap_peek", t }); if (r.ok && !r.used) { setInfo(r as typeof info); setSt("ready"); } else setSt(r.used ? "done" : "bad"); })(); }, []);
  const go = async () => {
    setSt("busy");
    const c = await links({ a: "ap_confirm", t });
    if (!c.ok || typeof c.phone !== "string") { setSt(c.code === "already_used" ? "done" : "later"); return; }
    try {
      const raw = (await callProxy({ endpoint: "autopay/unsubscribe", method: "POST", payload: { phone: c.phone }, verify: c.verify } as never)) as Record<string, unknown>;
      const d = ((raw?.data as Record<string, unknown>) || raw) as Record<string, unknown>;
      setSt(d?.code === "AP_REQUEST_RECEIVED" ? "done" : "later");
    } catch { setSt("later"); }
  };
  return (
    <Frame>
      <h1 className="text-xl font-extrabold text-foreground">{es ? "Pago automático" : "Auto Pay"}</h1>
      {st === "load" && <p className="mt-3 text-sm text-muted-foreground">{es ? "Un momento…" : "One moment…"}</p>}
      {st === "ready" && (
        <>
          <p className="mt-3 text-base">{es ? `¿Cancelar el pago automático del número que termina en ${info?.last4}?` : `Cancel Auto Pay for the number ending in ${info?.last4}?`}</p>
          <Btn onClick={go}>{es ? "Sí, cancelar pago automático" : "Yes, cancel Auto Pay"}</Btn>
        </>
      )}
      {st === "busy" && <p className="mt-3 text-sm text-muted-foreground">{es ? "Enviando…" : "Sending…"}</p>}
      {st === "done" && <p className="mt-3 text-base">{es ? "Recibimos su solicitud para cancelar el pago automático. Puede tardar 1 día hábil." : "We got your request to cancel Auto Pay. It can take 1 business day."}</p>}
      {st === "later" && <p className="mt-3 text-sm">{es ? "No pudimos enviar su solicitud ahora. Escriba a support@getcellpay.com con el asunto \"Cancelar pago automático\"." : "We couldn't send your request right now. Email support@getcellpay.com with the subject \"Cancel Auto Pay\"."}</p>}
      {st === "bad" && <p className="mt-3 text-sm text-muted-foreground">{es ? "Este enlace no es válido o venció. Escriba a support@getcellpay.com." : "This link isn't valid or has expired. Email support@getcellpay.com."}</p>}
    </Frame>
  );
};
