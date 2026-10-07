// OC-NOTYET-1007: "Phone not working yet?" card on the Order Confirmation page. Text only: no buttons that act,
// no network calls, no storage. Help labels match the live help chat (strings-en/es.json: launcher + quick.order_status).
import type { Language } from "@/lib/i18n";

interface Props { lang: Language; orderId: string; brandColor: string }

export const NotWorkingYet = ({ lang, orderId, brandColor }: Props) => {
  const es = lang === "es";
  return (
    <div className="bg-card rounded-xl border border-border p-5" data-testid="not-working-yet">
      <p className="text-sm sm:text-base font-bold text-foreground">
        {es ? "Su pago está listo. No pague otra vez por este número." : "Your payment is done. Please don't pay again for this number."}
      </p>
      <h2 className="text-base sm:text-lg font-bold text-foreground mt-3">
        {es ? "¿Su teléfono aún no funciona?" : "Phone not working yet?"}
      </h2>
      <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal pl-5">
        <li>{es ? "Espere hasta 30 minutos." : "Wait up to 30 minutes."}</li>
        <li>{es ? "Apague su teléfono y vuelva a encenderlo." : "Turn your phone off, then turn it on again."}</li>
        <li>
          {es ? (
            <>
              ¿Sigue sin funcionar? Toque <strong className="text-foreground">Ayuda</strong> abajo en la página y elija{" "}
              <strong className="text-foreground">Estado del pedido</strong>. O escriba a{" "}
              <a href="mailto:support@getcellpay.com" className="underline font-semibold" style={{ color: brandColor }}>support@getcellpay.com</a>{" "}
              con su ID del pedido: <strong className="text-foreground">{orderId}</strong>.
            </>
          ) : (
            <>
              Still not working? Tap <strong className="text-foreground">Help</strong> at the bottom of the page and choose{" "}
              <strong className="text-foreground">Check order status</strong>. Or email{" "}
              <a href="mailto:support@getcellpay.com" className="underline font-semibold" style={{ color: brandColor }}>support@getcellpay.com</a>{" "}
              with your Order ID: <strong className="text-foreground">{orderId}</strong>.
            </>
          )}
        </li>
      </ol>
    </div>
  );
};
