// TOP4-T3-1009: "How to Use CellPay" page text, EN + ES (/how-to-use, /es/how-to-use).
// Used by src/pages/HowToUse.tsx AND by vite.config.ts (title/description of the prerendered head), so they always match.
// Relative imports only (vite.config.ts loads this file). No fee amounts; payment list follows src/config/paymentFlags.ts.
import { payList, CARD_BRANDS } from "./paymentMethods";

export type HtuLang = "en" | "es";
export type HtuPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  steps: Array<{ num: string; title: string; desc: string }>;
  tipsTitle: string;
  tips: string[];
  guidesLabel: string;
  guides: Array<[string, string]>;
};

export const HOW_TO_USE: Record<HtuLang, HtuPage> = {
  en: {
    path: "/how-to-use",
    title: "How to Refill a Prepaid Phone Online — CellPay Guide",
    description:
      "Step-by-step guide to recharging a US prepaid phone with CellPay: pick a carrier, enter the number, choose a plan, pay securely, and get your top-up.",
    h1: "How to Use CellPay",
    intro: "Recharging your prepaid phone is quick and easy. Follow these simple steps:",
    steps: [
      { num: "1", title: "Choose Your Carrier", desc: "Browse our home page and select your prepaid wireless carrier from the list of supported providers." },
      { num: "2", title: "Enter Your Phone Number", desc: "Type in the 10-digit phone number associated with your prepaid account. Make sure it's correct — refills cannot be reversed." },
      { num: "3", title: "Select a Plan or Amount", desc: "Choose from available plans or enter a custom top-up amount. Pricing, including a low service fee, is shown before you pay." },
      { num: "4", title: "Complete Payment", desc: "Pay securely with " + payList("en", { first: `a credit or debit card (${CARD_BRANDS})`, appleNote: true }) + ". Your payment is processed through our encrypted payment gateway." },
      { num: "5", title: "Refill Confirmation", desc: "Your refill is sent to your line after payment. It can take up to 30 min for a refill to reflect on your account. You'll receive a confirmation with your transaction details." },
    ],
    tipsTitle: "Tips",
    tips: [
      "Double-check your phone number before paying — refills are non-reversible.",
      "Create an account to track your orders and speed up future refills.",
      "Contact us at support@getcellpay.com if you experience any issues.",
    ],
    guidesLabel: "Carrier guides: ",
    guides: [
      ["/how-to-pay/straight-talk", "How to pay Straight Talk"],
      ["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"],
      ["/how-to-pay/simple-mobile", "How to pay Simple Mobile"],
      ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"],
      ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], // TOP4-T4-1009
    ],
  },
  es: {
    path: "/es/how-to-use",
    title: "Cómo Usar CellPay — Recargue su Teléfono Prepagado en Línea | CellPay",
    description:
      "Guía paso a paso para recargar su teléfono prepagado con CellPay: elija su compañía, ingrese el número, elija un plan y pague de forma segura.",
    h1: "Cómo usar CellPay",
    intro: "Recargar su teléfono prepagado es rápido y fácil. Siga estos pasos:",
    steps: [
      { num: "1", title: "Elija su compañía", desc: "En la página de inicio, elija su compañía de telefonía prepagada." },
      { num: "2", title: "Ingrese su número de teléfono", desc: "Escriba el número de 10 dígitos de su cuenta prepagada. Revise que esté correcto: las recargas no se pueden revertir." },
      { num: "3", title: "Elija un plan o un monto", desc: "Elija uno de los planes o escriba el monto. El precio, con el cargo por servicio, se muestra antes de pagar." },
      { num: "4", title: "Complete el pago", desc: "Pague de forma segura con " + payList("es", { first: `tarjeta de crédito o débito (${CARD_BRANDS})`, appleNote: true }) + ". Su pago se procesa en nuestra pasarela de pago cifrada." },
      { num: "5", title: "Confirmación de la recarga", desc: "Su recarga se envía a su línea después del pago. Puede tardar hasta 30 min en reflejarse en su cuenta. Recibirá una confirmación con los datos de su transacción." },
    ],
    tipsTitle: "Consejos",
    tips: [
      "Revise su número de teléfono antes de pagar: las recargas no se pueden revertir.",
      "Cree una cuenta para ver sus pedidos y recargar más rápido la próxima vez.",
      "Si tiene algún problema, escríbanos a support@getcellpay.com.",
    ],
    guidesLabel: "Guías por compañía: ",
    guides: [
      ["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"],
      ["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepago"],
      ["/es/como-pagar/simple-mobile", "Cómo pagar Simple Mobile"],
      ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepago"],
      ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepago"], // TOP4-T4-1009
    ],
  },
};
