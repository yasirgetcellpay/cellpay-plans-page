// MONTHLY-BILL-COPY-1011: plain "pay your bill" wording for Metro, Boost and Cricket. Their customers pay a monthly plan or add
// pay-as-you-go balance; for CellPay it is the same payment, applied to the account and plan the customer has. Copy only: no prices,
// fees, plan IDs, payment values or tracking. Relative imports only (vite.config.ts loads this file for the static first screens).
// These carriers never show the words refill / recharge / recarga here.
import { payWith, CARD_BRANDS } from "./paymentMethods";

export type BillLang = "en" | "es";

/** Carrier slugs (checkout / go / carrier pages) and name pattern for the three carriers. */
export const BILL_SLUGS = ["metropcs", "metro-pcs", "boost", "topup-crc", "cricket"];
export const isBillSlug = (slug?: string | null): boolean => !!slug && BILL_SLUGS.includes(String(slug).toLowerCase());
export const isBillName = (name?: string | null): boolean => !!name && /^(metro|boost|cricket)/i.test(String(name).trim());

export const BILL_AUTOPAY_LINE: Record<BillLang, string> = {
  en: "Optional: Auto Pay so you never miss a payment. You can turn it on at checkout — it is never pre-checked.",
  es: "Opcional: Auto Pago para no olvidar su pago. Lo puede activar al pagar — nunca está marcado de antemano.",
};
export const billAutoPayLine = (lang: BillLang): string => BILL_AUTOPAY_LINE[lang];

export const BILL_AMOUNT_HELP: Record<BillLang, string> = {
  en: "Enter the amount you want to pay. Monthly or pay-as-you-go, it is the same payment.",
  es: "Ingrese el monto que desea pagar. Plan mensual o de pago por uso, es el mismo pago.",
};
export const billAmountHelp = (lang: BillLang): string => BILL_AMOUNT_HELP[lang];

/** One line on the checkout summary. */
export const BILL_SUMMARY_NOTE: Record<BillLang, string> = {
  en: "Your payment is applied to your account and plan, monthly or pay-as-you-go.",
  es: "Su pago se aplica a su cuenta y a su plan, mensual o de pago por uso.",
};

/** Overrides for the shared translation table (heroH1 / heroH2 are NOT touched: those are SEO headings, Tier B). */
export const BILL_TR = {
  en: {
    refilling: "Paying for",
    enterAmount: BILL_AMOUNT_HELP.en,
    securePayment: "Secure payment. Your payment is applied to your account and plan.",
    securePoweredBy: "Secure payment powered by CellPay. Your payment is applied to your account and plan.",
    rechargeTitle: (c: string) => `${c} Bill Payment`,
    rechargeProcessed: "Your payment has been processed successfully.",
    postedNote: "Your payment has been applied to your account and plan, monthly or pay-as-you-go. It can take up to 30 min to show on your account.",
    pinLabel: "Pin (Use it if not applied)",
    validationFailedDesc: "Unable to validate this payment",
  },
  es: {
    refilling: "Pagando para",
    enterAmount: BILL_AMOUNT_HELP.es,
    securePayment: "Pago seguro. Su pago se aplica a su cuenta y a su plan.",
    securePoweredBy: "Pago seguro con tecnología de CellPay. Su pago se aplica a su cuenta y a su plan.",
    rechargeTitle: (c: string) => `Pago de factura de ${c}`,
    rechargeProcessed: "Su pago se procesó exitosamente.",
    postedNote: "Su pago se aplicó a su cuenta y a su plan, mensual o de pago por uso. Puede tardar hasta 30 min en verse en su cuenta.",
    pinLabel: "PIN (Úselo si no se aplicó)",
    validationFailedDesc: "No se pudo validar este pago",
  },
} as const;

/** Auto Pay offer wording (title + benefit + interim line only; terms and consent text are untouched). */
export const BILL_AP = {
  en: {
    offerTitle: "Never miss a payment: turn on Auto Pay (optional)",
    offerBenefit: "Pays this number each month on your payment date, so your service doesn't lapse.",
    chargeInterim: "Auto Pay pays this number with this card. Renews monthly on your payment date, cancel anytime.",
  },
  es: {
    offerTitle: "No se quede sin pagar: active el pago automático (opcional)",
    offerBenefit: "Paga este número cada mes en su fecha de pago, para que su servicio no se interrumpa.",
    chargeInterim: "El pago automático paga este número con esta tarjeta. Se renueva cada mes en la fecha de su pago; cancele cuando quiera.",
  },
} as const;

/** Checkout messages (display only). */
export const BILL_MSG = {
  en: {
    cooldown: "This payment couldn't go through just now. Please try again in about 10 minutes or choose a different plan. You were not charged.",
    cooldownNote: "Please try again in about 10 minutes.",
    ppPaid: "PayPal confirmed your payment. It is being applied to your account and your receipt will be emailed to you. Please don't pay again.",
    ppPaidHelp: "If it doesn't show on your account in 15 minutes, email support@getcellpay.com with PayPal order",
    ppReceived: "Your PayPal payment may have gone through, but we couldn't confirm it on your account. Please don't pay again.",
    ppReceivedHelp: "We'll check it and follow up. If you don't hear from us within 30 minutes, email support@getcellpay.com with PayPal order",
    errNotAdded: (carrier: string, last4: string) => `We couldn't apply this payment to ${carrier} number •••${last4}, so it was returned automatically. Please check that this is an active ${carrier} line and that you picked the right carrier.`,
  },
  es: {
    cooldown: "Este pago no se pudo completar en este momento. Intente de nuevo en unos 10 minutos o elija otro plan. No se le cobró.",
    cooldownNote: "Intente de nuevo en unos 10 minutos.",
    ppPaid: "PayPal confirmó su pago. Se está aplicando a su cuenta y recibirá su recibo por correo electrónico. No pague de nuevo.",
    ppPaidHelp: "Si no aparece en su cuenta en 15 minutos, escriba a support@getcellpay.com con la orden de PayPal",
    ppReceived: "Es posible que su pago de PayPal se haya realizado, pero no pudimos confirmarlo en su cuenta. Por favor no pague de nuevo.",
    ppReceivedHelp: "Lo revisaremos y le daremos seguimiento. Si no sabe de nosotros en 30 minutos, escriba a support@getcellpay.com con la orden de PayPal",
    errNotAdded: (carrier: string, last4: string) => `No pudimos aplicar este pago al número •••${last4} de ${carrier}, por eso se devolvió automáticamente. Revise que sea una línea activa de ${carrier} y que eligió la compañía correcta.`,
  },
} as const;

/** FAQ shown on the /go landers and the carrier pages for these three carriers (visible text; FAQPage JSON-LD is unchanged, Tier B). */
export const billFaqs = (lang: BillLang, c: string): Array<{ q: string; a: string }> =>
  lang === "es"
    ? [
        { q: "¿Pagar la factura mensual es diferente a un pago de pago por uso?", a: "No. Es el mismo pago. Sin importar su plan, mensual o de pago por uso, su pago se aplica a su cuenta para ese plan." },
        { q: `¿Mi pago irá a mi factura mensual de ${c}?`, a: `Sí. Si tiene un plan mensual de ${c}, su pago se aplica a su cuenta y a su plan. No tiene que elegir un tipo de pago.` },
        { q: "¿Cuándo se verá en mi cuenta?", a: "La mayoría de los pagos se ven en pocos minutos. Puede tardar hasta 30 minutos." },
        { q: "¿Qué pasa si elegí la compañía o el número equivocado?", a: `Revise la compañía y el número de 10 dígitos antes de pagar. Los pagos son finales una vez aplicados a una línea. ¿No está seguro de su compañía? Use «¿No está seguro de su compañía?» o escriba a support@getcellpay.com.` },
        { q: `¿Puedo pagar sin cuenta y sin iniciar sesión en ${c}?`, a: `Sí. Escriba el número de teléfono de ${c}, elija el monto o plan y pague como invitado.` },
        { q: `¿Puedo pagar la línea de ${c} de otra persona?`, a: `Sí. Escriba el número de ${c} de esa persona, elija el monto o plan y pague. El pago se aplica a esa línea.` },
        { q: "¿Cómo puedo pagar?", a: payWith("es", `Con tarjeta (${CARD_BRANDS})`) + ". Apple Pay aparece en equipos Apple compatibles. El cargo por servicio se muestra antes de pagar." },
        { q: "¿Qué pasa si el pago falla?", a: "Si falla, su tarjeta NO fue cobrada. Si ve un cargo pendiente, su banco lo quita en 1–2 días. Puede probar otra tarjeta u otra forma de pago." },
        { q: "¿Cómo pido ayuda?", a: "Soporte: lunes–viernes 9:00 AM–6:00 PM (EST) · sábado–domingo 10:00 AM–4:00 PM (EST) · support@getcellpay.com" },
      ]
    : [
        { q: "Is a monthly payment different from a pay-as-you-go payment?", a: "No. It is the same payment. Whatever plan you have, monthly or pay-as-you-go, your payment is applied to your account for that plan." },
        { q: `Will my payment go to my monthly ${c} bill?`, a: `Yes. If you have a monthly ${c} plan, your payment is applied to your account and plan. You do not have to choose a type of payment.` },
        { q: "When will it show on my account?", a: "Most payments show within a few minutes. It can take up to 30 minutes." },
        { q: "What if I picked the wrong carrier or number?", a: `Check your carrier and the 10-digit number before you pay. Payments are final once applied to a line. Not sure of your carrier? Use "Not sure of your carrier?" or email support@getcellpay.com.` },
        { q: `Can I pay my ${c} bill without signing in?`, a: `Yes. No account or login needed. Enter the ${c} phone number, pick the amount or plan, and pay as a guest.` },
        { q: `Can I pay for someone else's ${c} line?`, a: `Yes. Enter their ${c} phone number, choose the amount or plan, and pay. The payment is applied to that line.` },
        { q: "How can I pay?", a: payWith("en", `Card (${CARD_BRANDS})`) + ". Apple Pay shows on supported Apple devices. The service fee is shown before you pay." },
        { q: "What if the payment fails?", a: "If it fails, your card was NOT charged. If you see a pending amount, your bank removes it in 1–2 days. You can try another card or payment method." },
        { q: "How do I get help?", a: "Support: Monday–Friday 9:00 AM–6:00 PM (EST) · Saturday–Sunday 10:00 AM–4:00 PM (EST) · support@getcellpay.com" },
      ];

/** Short answers for the "Not sure of your carrier?" help sheet (carrier-assist) and the help chat topic. */
export const BILL_HELP_LINE: Record<BillLang, string> = {
  en: "Monthly plan or pay-as-you-go, Metro, Boost and Cricket use the same payment. It is applied to your account and plan.",
  es: "Plan mensual o de pago por uso, Metro, Boost y Cricket usan el mismo pago. Se aplica a su cuenta y a su plan.",
};
