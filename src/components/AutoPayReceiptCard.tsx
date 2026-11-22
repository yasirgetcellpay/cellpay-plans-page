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

// AUTOPAY-OPTIN-WORDING-1122: carrier is display-only ("slug name"); unknown/empty -> default refill wording.
interface Props { lang: Language; hashid: string; brandColor: string; paidByCard?: boolean; enrolledServer?: boolean; readonly carrier?: string }

// AUTOPAY-RECEIPT-ENROLL-1102: share the receipt confirmation and redundant-offer decision.
export const isAutoPayEnrolled = (enrolledServer: boolean | undefined, hashid: string, sessionValue: string | null): boolean =>
  enrolledServer === true || (!!hashid && sessionValue === hashid);
export const shouldHidePostPurchaseAutoPay = isAutoPayEnrolled;

export const AutoPayReceiptCard = ({ lang, hashid, brandColor, paidByCard, enrolledServer, carrier = "" }: Props) => {
  const es = lang === "es";
  const bill = /metro|boost|cricket/i.test(String(carrier || "")); // AUTOPAY-OPTIN-WORDING-1122: never Refill/Recarga for Metro/Boost/Cricket (same test as isPayWord)
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
        {bill
          ? (es ? "¿No quiere volver a atrasarse en su pago?" : "Never miss a payment again")
          : (es ? "¿No quiere volver a preocuparse por recargar?" : "Never worry about your refill again")}
      </h2>
      <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc pl-5">
        <li>{bill
          ? (es ? "Pagamos este número por usted cada mes" : "We pay this number for you every month")
          : (es ? "Recargamos este número por usted cada mes" : "We refill this number for you every month")}</li>
        <li>{es ? "Ayuda a evitar pagos atrasados y cortes de servicio" : "Helps avoid late payments and service cut-offs"}</li>
        <li>{es ? "Cancele en línea cuando quiera, sin iniciar sesión" : "Cancel online anytime, no login needed"}</li>
      </ul>
      <Link to={payAgainPath(lang)} onClick={() => { try { sessionStorage.setItem("cp_ap_highlight_v1", "1"); } catch { /* ignore */ } }}
        className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90"
        style={{ backgroundColor: brandColor }} data-testid="ap-receipt-cta">
        {bill
          ? (es ? "Activar pago automático en mi próximo pago (opcional)" : "Turn on Auto Pay for my next payment (optional)")
          : (es ? "Activar pago automático en mi próxima recarga (opcional)" : "Turn on Auto Pay for my next refill (optional)")}
      </Link>
      <p className="text-xs text-muted-foreground mt-2">
        {es ? "Hoy no se cobra nada. La próxima vez, marque el pago automático y acepte los términos. Se renueva cada mes hasta que usted cancele." : "Nothing is charged now. Next time at checkout, tick Auto Pay and agree to the terms. Renews every month until you cancel."}
      </p>
    </div>
  );
};
