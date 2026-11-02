// GROWTH-1007-B: Auto Pay prompt on the order confirmation page. Display + navigation only.
// - Never enrolls anyone from here: no charge, no API call, no checkbox. Enrolling still happens ONLY at checkout with the
//   customer's own Auto Pay tick + authorization tick (both start unticked).
// - Customer already chose Auto Pay on this order -> "Auto Pay is on" confirmation with the cancel path.
// - Otherwise -> explains Auto Pay and links to the Pay again page and sets a one-shot sessionStorage flag; checkout then only scrolls to / highlights the offer.
// - No discount or price claim (needs Parvez's OK). No frequency/$/date claim while AP_CYCLE_CONFIRMED is false.
import { Link } from "react-router-dom";
import { Repeat } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { payAgainPath } from "@/lib/payAgain";

export const AP_LAST_KEY = "cp_autopay_last_v1"; // set by Checkout on a successful card order with Auto Pay authorized

interface Props { lang: Language; hashid: string; brandColor: string; paidByCard?: boolean; enrolledServer?: boolean }

// AUTOPAY-RECEIPT-ENROLL-1102: share the receipt confirmation and redundant-offer decision.
export const isAutoPayEnrolled = (enrolledServer: boolean | undefined, hashid: string, sessionValue: string | null): boolean =>
  enrolledServer === true || (!!hashid && sessionValue === hashid);
export const shouldHidePostPurchaseAutoPay = isAutoPayEnrolled;

export const AutoPayReceiptCard = ({ lang, hashid, brandColor, paidByCard, enrolledServer }: Props) => {
  const es = lang === "es";
  let sessionValue: string | null = null;
  try { sessionValue = sessionStorage.getItem(AP_LAST_KEY); } catch { /* ignore */ }
  const enrolled = isAutoPayEnrolled(enrolledServer, hashid, sessionValue);

  if (enrolled) {
    return (
      <div className="bg-card rounded-xl border-2 p-5" style={{ borderColor: brandColor }} data-testid="ap-receipt-on">
        <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-5 w-5" style={{ color: brandColor }} aria-hidden="true" />
          {es ? "Ya está inscrito en el pago automático" : "You're signed up for Auto Pay"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {es
            ? "Todo listo. Pagaremos este número con la misma tarjeta en su fecha de pago. Cancele cuando quiera."
            : "You're all set. We'll pay for this number with the same card on your payment date. Cancel anytime."}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {es ? "Para cancelar: " : "To cancel: "}
          <a href="/faq" className="underline font-semibold" style={{ color: brandColor }}>Unsubscribe From Autopay</a>
          {es ? " en Preguntas Frecuentes, o support@getcellpay.com." : " on our FAQ page, or support@getcellpay.com."}
        </p>
      </div>
    );
  }
  if (paidByCard === false) return null; // Auto Pay is card-only today
  return (
    <div className="bg-card rounded-xl border-2 p-5" style={{ borderColor: brandColor }} data-testid="ap-receipt-offer">
      <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
        <Repeat className="h-5 w-5" style={{ color: brandColor }} aria-hidden="true" />
        {es ? "¿No quiere volver a preocuparse por recargar?" : "Never worry about your refill again"}
      </h2>
      <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc pl-5">
        <li>{es ? "Su número se recarga solo en su fecha de pago" : "Your number refills itself on your payment date"}</li>
        <li>{es ? "Sin cortes de servicio por olvidar pagar" : "No service cut-off from a missed payment"}</li>
        <li>{es ? "Cancele en línea cuando quiera, sin iniciar sesión" : "Cancel online anytime, no login needed"}</li>
      </ul>
      <Link to={payAgainPath(lang)} onClick={() => { try { sessionStorage.setItem("cp_ap_highlight_v1", "1"); } catch { /* ignore */ } }}
        className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90"
        style={{ backgroundColor: brandColor }} data-testid="ap-receipt-cta">
        {es ? "Activar pago automático en mi próxima recarga" : "Turn on Auto Pay with my next refill"}
      </Link>
      <p className="text-xs text-muted-foreground mt-2">
        {es ? "Nada se cobra ahora. Usted elige y autoriza el pago automático en el pago." : "Nothing is charged now. You choose and authorize Auto Pay at checkout."}
      </p>
    </div>
  );
};
