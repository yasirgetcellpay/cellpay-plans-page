// RT-3 (Oct 6, 2026): /pay-again and /es/pay-again. Opens the last order's carrier page on this device with the number and
// amount filled in (CK-0's one-shot carrier-page hand-off), so a returning customer goes amount -> pay with no login.
// Nothing is sent to a server here; the carrier page and Checkout re-check the number, plan and today's service fee.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { useLang, langPath } from "@/lib/i18n";
import { applySeoHead } from "@/lib/seo";
import { carrierPageTarget } from "@/lib/checkoutResume";
import { readPayAgain, clearPayAgain, lastFour, type PayAgainInfo } from "@/lib/payAgain";

const PayAgain = () => {
  const lang = useLang();
  const es = lang === "es";
  const navigate = useNavigate();
  const { search, hash } = useLocation();
  const [info, setInfo] = useState<PayAgainInfo | null>(() => readPayAgain());
  const color = info?.color || "hsl(142,70%,40%)";

  useEffect(() => {
    applySeoHead({
      title: es ? "Pagar de nuevo | CellPay" : "Pay again | CellPay",
      description: es
        ? "Pague de nuevo su recarga prepagada con CellPay usando el número guardado en este dispositivo."
        : "Pay your prepaid refill again on CellPay with the number saved on this device.",
    });
    // Personal shortcut page: never indexed.
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const original = robots?.getAttribute("content") ?? null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,follow");
    return () => {
      if (original !== null) robots!.setAttribute("content", original);
    };
  }, [es]);

  const go = (withNumber: boolean) => {
    if (!info) return;
    navigate(carrierPageTarget(lang, info.slug, withNumber ? info.phone : "", withNumber ? info.amount : undefined, search, hash));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-8 sm:py-12">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 sm:p-6 text-center">
          <RotateCcw className="h-9 w-9 mx-auto" style={{ color }} aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mt-2">{es ? "Pagar de nuevo" : "Pay again"}</h1>
          {info ? (
            <>
              <p className="text-base text-foreground mt-3">
                {info.carrierName ? <span className="font-bold">{info.carrierName}</span> : null}
                {info.carrierName ? " · " : ""}
                {es ? `número que termina en ${lastFour(info.phone)}` : `number ending in ${lastFour(info.phone)}`}
              </p>
              <button
                type="button"
                onClick={() => go(true)}
                className="mt-5 w-full h-12 rounded-lg text-primary-foreground font-bold text-base hover:opacity-90 active:scale-[0.97] transition"
                style={{ backgroundColor: color }}
              >
                {es ? "Continuar" : "Continue"}
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                {es
                  ? "Luego elija el monto y pague. Se aplica un cargo por servicio, que verá antes de pagar."
                  : "Next, choose the amount and pay. A service fee applies and is shown before you pay."}
              </p>
              <button
                type="button"
                onClick={() => go(false)}
                className="mt-4 text-sm font-semibold underline underline-offset-2"
                style={{ color }}
              >
                {es ? "Pagar otro número" : "Pay for a different number"}
              </button>
              <div className="mt-6 rounded-lg bg-muted/50 p-3 text-left text-xs text-muted-foreground">
                <p className="font-bold text-foreground">{es ? "Guarde esta página para la próxima vez" : "Save this page for next time"}</p>
                <p className="mt-1">
                  {es ? "iPhone: toque Compartir y luego \"Agregar a inicio\"." : "iPhone: tap Share, then \"Add to Home Screen\"."}
                </p>
                <p>
                  {es ? "Android: toque el menú ⋮ y luego \"Agregar a la pantalla principal\"." : "Android: tap the ⋮ menu, then \"Add to Home screen\"."}
                </p>
                <p>{es ? "Computadora: guárdela en sus favoritos." : "Computer: bookmark this page."}</p>
              </div>
              <button
                type="button"
                onClick={() => { clearPayAgain(true); setInfo(null); }}
                className="mt-4 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {es ? "Borrar mi número de este dispositivo" : "Remove my number from this device"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-3">
                {es
                  ? "No hay un número guardado en este dispositivo. Después de su próximo pago, puede guardarlo en la página de confirmación."
                  : "There's no saved number on this device. After your next payment, you can save it on the confirmation page."}
              </p>
              <Link
                to={`${langPath("/", lang)}${search}`}
                className="mt-5 inline-flex w-full h-12 items-center justify-center rounded-lg text-primary-foreground font-bold text-base hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                {es ? "Elegir mi operador" : "Choose my carrier"}
              </Link>
            </>
          )}
        </div>
      </main>
      <PaymentBar lang={lang} />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default PayAgain;
