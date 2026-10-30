// SEO-CONTENT-1014: pay-wording head, H1, short FAQ (4 Q) + FAQPage/BreadcrumbList JSON-LD for the bill-pay carrier pages
// /es/metropcs.html, /es/boost.html, /topup-crc.html and /es/topup-crc.html. Single source for DynamicCarrier.tsx (rendered page)
// AND vite.config.ts (raw HTML), so the visible FAQ and the FAQPage JSON-LD stay word for word identical.
// Wording rule (Metro, Boost, Cricket): pay/payment, pagar/pago only. No fee amounts. Relative imports only (vite.config.ts loads this).
import { methodsLong } from "./paymentMethods";

export type BillLang = "en" | "es";
export type BillFaq = { q: string; a: string };
export type BillPage = {
  path: string; // www path
  lang: BillLang;
  name: string;
  title?: string; // undefined = keep the page's existing title
  description: string;
  h1: string;
  sub: string;
  autoPayInfoLead: string; // first sentence of the Auto Pay info card
  enterAmount: string;
  securePayment: string;
  faqTitle: string;
  faqs: BillFaq[];
  guide?: [string, string]; // how-to-pay guide link (Metro, Boost; CRICKET-GUIDE-1014: + Cricket)
  more?: [string, string][]; // BILLPAY-BOOST-1022 extra internal links [href, label]
  faqOnly?: boolean; // BILLPAY-TMOBILE-1024: JSON-LD = FAQPage only (no BreadcrumbList)
  preFaq?: [string, string]; // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027  (H2 heading + short paragraph shown above the FAQ)
};

const WWW = "https://www.cellpay.us";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const faqsEn = (name: string): BillFaq[] => [
  { q: "Do I need an account to pay?", a: `No. You don't need a CellPay account or a ${name} login. Enter the 10-digit phone number, pick the amount and pay.` },
  { q: "What payment methods can I use?", a: methodsLong("en") },
  { q: "Can I pay for someone else?", a: `Yes. Enter their 10-digit ${name} phone number. Double-check the number before you pay.` },
  { q: "Is there a fee?", a: "Service fee shown before you pay." },
];

const faqsEs = (name: string): BillFaq[] => [
  { q: "¿Necesito una cuenta para pagar?", a: `No. No necesita una cuenta de CellPay ni iniciar sesión en ${name}. Ingrese el número de teléfono de 10 dígitos, elija el monto y pague.` },
  { q: "¿Qué métodos de pago puedo usar?", a: methodsLong("es") },
  { q: "¿Puedo pagar por otra persona?", a: `Sí. Ingrese su número de teléfono de ${name} de 10 dígitos. Revise bien el número antes de pagar.` },
  { q: "¿Hay un cargo?", a: "El cargo por servicio se muestra antes de pagar." },
];

const esPage = (path: string, name: string, guide?: [string, string]): BillPage => ({
  path, lang: "es", name,
  title: `Pague su factura de ${name} en línea | CellPay`,
  description: `Pague su factura de ${name} en línea, sin cuenta y sin iniciar sesión, también por otra persona. El cargo por servicio se muestra antes de pagar.`,
  h1: `Pague su factura de ${name} en línea, rápido y seguro`,
  sub: "Sin cuenta y sin iniciar sesión. Ingrese el número, elija el monto y pague.",
  autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.",
  enterAmount: "Ingrese el monto que desea pagar",
  securePayment: "Pago seguro. Su pago se aplica al número que ingresó.",
  faqTitle: "Preguntas frecuentes",
  faqs: faqsEs(name),
  guide,
});

// BILLPAY-METRO-1021
const metroFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [
  { q: "¿Cómo pago mi factura de Metro PCS en línea?", a: "Ingrese el número de Metro, elija el monto de su plan y pague. Toma alrededor de un minuto." },
  { q: "¿Puedo pagar Metro PCS como invitado?", a: "Sí. Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono." },
  { q: "¿Puedo pagar sin el PIN de la cuenta?", a: "Sí, el número de teléfono es suficiente." },
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` },
  { q: "¿Cuándo se aplica mi pago?", a: "Por lo general en pocos minutos. Recibe una confirmación en pantalla y por correo electrónico." },
  { q: "¿Puedo pagar la línea de Metro de otra persona?", a: "Sí, ingrese su número." },
] : [
  { q: "How do I pay my Metro PCS bill online?", a: "Enter the Metro phone number, pick the amount for your plan, and pay. It takes about a minute." },
  { q: "Can I pay Metro PCS as a guest?", a: "Yes. No account or login. You only need the phone number." },
  { q: "Can I pay without the account PIN?", a: "Yes, the phone number is enough." },
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en")}` },
  { q: "When does my payment post?", a: "Usually within minutes. You get a confirmation on screen and by email." },
  { q: "Can I pay for someone else's Metro line?", a: "Yes, enter their number." },
];

// BILLPAY-BOOST-1022
const boostFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [
  { q: "¿Cómo pago mi factura de Boost Mobile en línea?", a: "Ingrese el número de Boost, elija el monto de su plan y pague. Toma alrededor de un minuto." },
  { q: "¿Puedo pagar Boost como invitado?", a: "Sí. Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono." },
  { q: "¿Puedo pagar sin iniciar sesión en mi cuenta de Boost?", a: "Sí. No necesita su usuario ni su PIN de Boost. El número de teléfono es suficiente." },
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` },
  { q: "¿Cuándo se aplica mi pago?", a: "Por lo general en pocos minutos. Recibe una confirmación en pantalla y por correo electrónico." },
  { q: "Me cambié a Boost, ¿puedo pagar aquí?", a: "Sí. Si acaba de pasar su número a Boost, ingréselo y pague de la misma forma." },
] : [
  { q: "How do I pay my Boost Mobile bill online?", a: "Enter the Boost phone number, pick the amount for your plan, and pay. It takes about a minute." },
  { q: "Can I pay Boost as a guest?", a: "Yes. No account or login. You only need the phone number." },
  { q: "Can I pay without logging in to my Boost account?", a: "Yes. You don't need your Boost login or PIN. The phone number is enough." },
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en")}` },
  { q: "When does my payment post?", a: "Usually within minutes. You get a confirmation on screen and by email." },
  { q: "I switched to Boost — can I still pay here?", a: "Yes. If you just moved your number to Boost, enter it and pay the same way." },
];

const cricketFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-CRICKET-1023
  { q: "¿Cómo pago mi factura de Cricket en línea?", a: "Ingrese el número de teléfono de Cricket, elija su plan o monto y complete el pago en línea." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar Cricket como invitado, al estilo Quick Pay?", a: "Sí. Puede pagar como invitado solo con el número de teléfono de Cricket. No necesita una cuenta." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar sin iniciar sesión en Cricket?", a: "Sí. No necesita su usuario ni su contraseña de Cricket. Ingrese el número de la línea que desea pagar." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` }, // BILLPAY-CRICKET-1023
  { q: "¿Cuándo se aplica mi pago?", a: "Puede tardar hasta 30 minutos en verse reflejado en su cuenta." }, // BILLPAY-CRICKET-1023
  { q: "¿Puedo pagar la línea de Cricket de un familiar?", a: "Sí. Ingrese el número de Cricket de su familiar y revise que sea correcto antes de pagar. El pago se aplica a esa línea." }, // BILLPAY-CRICKET-1023
  faqsEs("Cricket Wireless")[3], // BILLPAY-CRICKET-1023: preserve the existing fee question and answer exactly
] : [ // BILLPAY-CRICKET-1023
  { q: "How do I pay my Cricket bill online?", a: "Enter the Cricket phone number, choose your plan or amount, and complete your payment online." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay Cricket as a guest (Quick Pay style)?", a: "Yes. You can pay as a guest with just the Cricket phone number. No account is needed." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay without my Cricket login?", a: "Yes. You don't need your Cricket username or password. Enter the number of the line you want to pay." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-CRICKET-1023
  { q: "When does my payment post?", a: "It can take up to 30 min for a payment to reflect on your account." }, // BILLPAY-CRICKET-1023
  { q: "Can I pay a family member's Cricket line?", a: "Yes. Enter your family member's Cricket number and double-check it before paying. The payment applies to their line." }, // BILLPAY-CRICKET-1023
  faqsEn("Cricket Wireless")[3], // BILLPAY-CRICKET-1023: preserve the existing fee question and answer exactly
]; // BILLPAY-CRICKET-1023

const tmobileFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-TMOBILE-1024
  { q: "¿Cómo pago mi factura de T-Mobile Prepago como invitado?", a: "Ingrese el número de teléfono de T-Mobile, elija su plan o monto y pague. No necesita una cuenta." }, // BILLPAY-TMOBILE-1024
  { q: "¿Puedo pagar mi factura de T-Mobile sin iniciar sesión?", a: "Sí. No necesita iniciar sesión en T-Mobile. El número de teléfono es suficiente." }, // BILLPAY-TMOBILE-1024
  { q: "¿Puedo pagar la línea de T-Mobile de otra persona?", a: "Sí. Ingrese su número de T-Mobile y revíselo bien antes de pagar." }, // BILLPAY-TMOBILE-1024
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` }, // BILLPAY-TMOBILE-1024
  { q: "¿Cuándo se aplica mi pago?", a: "Por lo general en pocos minutos. Recibe una confirmación en pantalla y por correo electrónico." }, // BILLPAY-TMOBILE-1024
  { q: "Me cambié a T-Mobile Prepago, ¿puedo pagar aquí?", a: "Sí. Ingrese su número de T-Mobile y pague de la misma forma." }, // BILLPAY-TMOBILE-1024 // USC-FLEXI-1025
  { q: "¿Es diferente de comprar una tarjeta o un PIN?", a: "Sí. El monto se aplica directamente a su número de T-Mobile Prepago. No necesita comprar una tarjeta ni ingresar un código PIN." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
  { q: "¿Funciona para T-Mobile pospago?", a: "No. Esta página es solo para números de T-Mobile Prepago." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
  { q: "¿Cómo consulto mi saldo?", a: "Marque #BAL# o #999# desde su teléfono T-Mobile." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
  { q: "¿Hay un cargo por servicio?", a: "Sí. Verá el cargo por servicio antes de pagar." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
] : [ // BILLPAY-TMOBILE-1024
  { q: "How do I pay my T-Mobile Prepaid bill as a guest?", a: "Enter the T-Mobile phone number, pick your plan or amount, and pay. No account needed." }, // BILLPAY-TMOBILE-1024
  { q: "Can I pay my T-Mobile bill without logging in?", a: "Yes. You don't need a T-Mobile login. The phone number is enough." }, // BILLPAY-TMOBILE-1024
  { q: "Can I pay someone else's T-Mobile line?", a: "Yes. Enter their T-Mobile number and double-check it before you pay." }, // BILLPAY-TMOBILE-1024
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-TMOBILE-1024
  { q: "When does my payment post?", a: "Usually within minutes. You get a confirmation on screen and by email." }, // BILLPAY-TMOBILE-1024
  { q: "I switched to T-Mobile Prepaid, including from UScellular. Can I pay here?", a: "Yes. Enter your T-Mobile phone number and pay the same way." }, // BILLPAY-TMOBILE-1024 // USC-FLEXI-1025 // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
  { q: "Is a refill online different from a refill card or PIN?", a: "Yes. We load the amount directly to your T-Mobile Prepaid number. There is no card to buy and no PIN code to enter." }, // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
  { q: "Does the amount need to match my plan?", a: "Yes. Pick the amount that exactly matches your T-Mobile Prepaid plan." }, // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
  { q: "Does this work for T-Mobile postpaid?", a: "No. This page is for T-Mobile Prepaid numbers only." }, // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
  { q: "How do I check my balance?", a: "Dial #BAL# or #999# from your T-Mobile phone." }, // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
]; // BILLPAY-TMOBILE-1024

const straightTalkFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-STRAIGHTTALK-1025
  { q: "¿Cómo pago mi factura de Straight Talk en línea?", a: "Ingrese el número de teléfono de Straight Talk, elija su plan y pague. No necesita una cuenta." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "¿Puedo pagar mi factura de Straight Talk sin iniciar sesión?", a: "Sí. Solo necesita el número de teléfono." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "¿Puedo pagar la línea de Straight Talk de otra persona?", a: "Sí. Ingrese su número de Straight Talk y revíselo bien antes de pagar." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es")}` }, // BILLPAY-STRAIGHTTALK-1025
  { q: "¿Cuándo se aplica mi pago?", a: "Por lo general en pocos minutos. Recibe una confirmación en pantalla y por correo electrónico." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "¿Funciona para los planes de 30 días de Straight Talk?", a: "Sí. Elija un plan de la lista en esta página. Verá el monto antes de pagar." }, // BILLPAY-STRAIGHTTALK-1025
] : [ // BILLPAY-STRAIGHTTALK-1025
  { q: "How do I pay my Straight Talk bill online?", a: "Enter the Straight Talk phone number, pick your plan, and pay. No account needed." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "Can I pay my Straight Talk bill without logging in?", a: "Yes. You only need the phone number." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "Can I pay someone else's Straight Talk line?", a: "Yes. Enter their Straight Talk number and double-check it before you pay." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-STRAIGHTTALK-1025
  { q: "When does my payment post?", a: "Usually within minutes. You get a confirmation on screen and by email." }, // BILLPAY-STRAIGHTTALK-1025
  { q: "Does it work for Straight Talk 30-day plans?", a: "Yes. Choose a plan from the list on this page. No prices are listed here — you'll see the amount before you pay." }, // BILLPAY-STRAIGHTTALK-1025
]; // BILLPAY-STRAIGHTTALK-1025

const totalWirelessFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-TOTALWIRELESS-1026
  { q: "¿Cómo pago mi factura de Total Wireless en línea?", a: "Ingrese el número de teléfono de Total Wireless, elija su plan y pague. No necesita una cuenta." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "¿Puedo pagar Total Wireless como invitado, sin iniciar sesión?", a: "Sí. No necesita iniciar sesión ni una cuenta. Solo necesita el número de teléfono." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "¿Puedo pagar la línea de Total Wireless de otra persona?", a: "Sí. Ingrese su número de Total Wireless y revíselo bien antes de pagar." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "¿Qué métodos de pago acepta, como Apple Pay o tarjeta?", a: `Sí. ${methodsLong("es").replace("Apple Pay en dispositivos Apple compatibles", "Apple Pay en dispositivos compatibles")}` }, // BILLPAY-TOTALWIRELESS-1026 // ORGANIC-ES-BILLPAY-TW-TMO-1027
  { q: "¿Cuándo se aplica mi pago?", a: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Cuando el pago se completa, verá una confirmación con los datos de su transacción." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "¿Funciona para los planes mensuales de Total Wireless?", a: "Sí. Elija un plan de la lista en esta página. Verá el monto antes de pagar." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "¿Puede pagar sin su PIN de cuenta?", a: "Sí. Solo necesita el número de teléfono de Total Wireless. CellPay nunca le pide el PIN de su cuenta ni que inicie sesión." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
  { q: "¿Hay un cargo por servicio?", a: "Sí. Verá el cargo por servicio antes de pagar." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
  { q: "¿Puede pagar desde fuera de EE. UU.?", a: "Sí, siempre que su tarjeta o billetera digital funcione con comercios de EE. UU." }, // ORGANIC-ES-BILLPAY-TW-TMO-1027
] : [ // BILLPAY-TOTALWIRELESS-1026
  { q: "How do I pay my Total Wireless bill online?", a: "Enter the Total Wireless phone number, pick your plan, and pay. No account needed." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "Can I pay my Total Wireless bill as a guest, without logging in?", a: "Yes. You don't need a login or an account. The phone number is enough." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "Can I pay someone else's Total Wireless line?", a: "Yes. Enter their Total Wireless number and double-check it before you pay." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-TOTALWIRELESS-1026
  { q: "When does my payment post?", a: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. You see a confirmation with your transaction details once the payment goes through." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "Does it work for Total Wireless monthly plans?", a: "Yes. Choose a plan from the list on this page. You'll see the amount before you pay." }, // BILLPAY-TOTALWIRELESS-1026
  { q: "When is my Total Wireless bill due, and what happens if service lapses?", a: "Your due date is shown in your Total Wireless account or app. If your service lapses, you can pay here with just the phone number to get it back. No login needed." }, // ORGANIC-TW-PAYBILL-FAQ-1027
  { q: "Can I pay without my account PIN?", a: "Yes. You only need the Total Wireless phone number. CellPay never asks for your account PIN or a login." }, // ORGANIC-TW-PAYBILL-FAQ-1027
  { q: "Is CellPay Auto Pay the same as Total Wireless Auto Pay?", a: "No. CellPay Auto Pay renews your payment on CellPay on the schedule you choose. Total Wireless Auto Pay is their own service. CellPay Auto Pay is optional and never pre-checked." }, // ORGANIC-TW-PAYBILL-FAQ-1027
  { q: "My payment posted but service is still off — what do I do?", a: "Most payments post in a few minutes; some take up to 30 minutes. Restart your phone. If it still isn't working after 30 minutes, tap Help and choose Check order status, or email support@getcellpay.com with your Order ID." }, // ORGANIC-TW-PAYBILL-FAQ-1027
  { q: "Which plans are shown?", a: "The plans and prices on this page load live from checkout, so you always see the current options before you pay." }, // ORGANIC-TW-PAYBILL-FAQ-1027
  { q: "Can I pay from outside the US?", a: "Yes, as long as your card or wallet works for a US merchant." }, // ORGANIC-TW-PAYBILL-FAQ-1027
]; // BILLPAY-TOTALWIRELESS-1026
const verizonFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-VERIZON-PREPAID-1027
  { q: "¿Cómo pago mi factura de Verizon Prepaid en línea?", a: "Ingrese el número de teléfono de Verizon Prepaid, elija el monto o el plan y pague. No necesita una cuenta." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "¿Puedo pagar mi factura de Verizon Prepaid sin iniciar sesión en My Verizon?", a: "Sí. No necesita iniciar sesión en My Verizon ni una cuenta. Solo necesita el número de teléfono." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "¿Puedo pagar la línea de Verizon Prepaid de otra persona?", a: "Sí. Ingrese su número de Verizon Prepaid y revíselo bien antes de pagar." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es").replace("Apple Pay en dispositivos Apple compatibles", "Apple Pay en dispositivos compatibles")}` }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "¿Cuándo se aplica mi pago?", a: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Cuando el pago se completa, verá una confirmación con los datos de su transacción." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "¿Puedo activar el Auto Pago?", a: "Sí. El Auto Pago es opcional. Lo puede activar al pagar. Nunca está marcado de antemano." }, // BILLPAY-VERIZON-PREPAID-1027
] : [ // BILLPAY-VERIZON-PREPAID-1027
  { q: "How do I pay my Verizon Prepaid bill online?", a: "Enter the Verizon Prepaid phone number, pick your amount or plan, and pay. No account needed." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "Can I pay my Verizon Prepaid bill without a My Verizon login?", a: "Yes. You don't need a My Verizon login or an account. The phone number is enough." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "Can I pay someone else's Verizon Prepaid line?", a: "Yes. Enter their Verizon Prepaid number and double-check it before you pay." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "When does my payment post?", a: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. You see a confirmation with your transaction details once the payment goes through." }, // BILLPAY-VERIZON-PREPAID-1027
  { q: "Can I set up Auto Pay?", a: "Yes. Auto Pay is optional. You can turn it on at checkout. It is never pre-checked." }, // BILLPAY-VERIZON-PREPAID-1027
]; // BILLPAY-VERIZON-PREPAID-1027
const ultraFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-ULTRA-1028
  { q: "¿Cómo pago mi factura de Ultra Mobile en línea?", a: "Ingrese el número de teléfono de Ultra Mobile, elija el plan y pague. No necesita una cuenta." }, // BILLPAY-ULTRA-1028
  { q: "¿Puedo pagar mi factura de Ultra Mobile sin iniciar sesión?", a: "Sí. No necesita iniciar sesión ni una cuenta. Solo necesita el número de teléfono." }, // BILLPAY-ULTRA-1028
  { q: "¿Puedo pagar la línea de Ultra Mobile de otra persona?", a: "Sí. Ingrese su número de Ultra Mobile y revíselo bien antes de pagar." }, // BILLPAY-ULTRA-1028
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es").replace("Apple Pay en dispositivos Apple compatibles", "Apple Pay en dispositivos compatibles")}` }, // BILLPAY-ULTRA-1028
  { q: "¿Cuándo se aplica mi pago?", a: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Cuando el pago se completa, verá una confirmación con los datos de su transacción." }, // BILLPAY-ULTRA-1028
  { q: "¿Puedo activar el Auto Pago?", a: "Sí. El Auto Pago es opcional. Lo puede activar al pagar. Nunca está marcado de antemano." }, // BILLPAY-ULTRA-1028
] : [ // BILLPAY-ULTRA-1028
  { q: "How do I pay my Ultra Mobile bill online?", a: "Enter the Ultra Mobile phone number, pick your plan, and pay. No account needed." }, // BILLPAY-ULTRA-1028
  { q: "Can I pay my Ultra Mobile bill without a login?", a: "Yes. You don't need a login or an account. The phone number is enough." }, // BILLPAY-ULTRA-1028
  { q: "Can I pay someone else's Ultra Mobile line?", a: "Yes. Enter their Ultra Mobile number and double-check it before you pay." }, // BILLPAY-ULTRA-1028
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-ULTRA-1028
  { q: "When does my payment post?", a: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. You see a confirmation with your transaction details once the payment goes through." }, // BILLPAY-ULTRA-1028
  { q: "Can I set up Auto Pay?", a: "Yes. Auto Pay is optional. You can turn it on at checkout. It is never pre-checked." }, // BILLPAY-ULTRA-1028
]; // BILLPAY-ULTRA-1028
const attFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-ATT-1029
  { q: "¿Cómo pago mi factura de AT&T Prepaid en línea?", a: "Ingrese el número de teléfono de AT&T Prepaid, elija el monto o el plan y pague. No necesita una cuenta." }, // BILLPAY-ATT-1029
  { q: "¿Puedo pagar AT&T Prepaid como invitado, sin iniciar sesión?", a: "Sí. No necesita iniciar sesión ni crear una cuenta. Solo necesita el número de teléfono." }, // BILLPAY-ATT-1029
  { q: "¿Puedo pagar la línea de AT&T Prepaid de otra persona?", a: "Sí. Ingrese su número de AT&T Prepaid y revíselo bien antes de pagar." }, // BILLPAY-ATT-1029
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es").replace("Apple Pay en dispositivos Apple compatibles", "Apple Pay en dispositivos compatibles")}` }, // BILLPAY-ATT-1029
  { q: "¿Cuándo se aplica mi pago?", a: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Cuando el pago se completa, verá una confirmación con los datos de su transacción." }, // BILLPAY-ATT-1029
  { q: "¿Puedo activar el Auto Pago?", a: "Sí. El Auto Pago es opcional. Lo puede activar al pagar. Nunca está marcado de antemano." }, // BILLPAY-ATT-1029
] : [ // BILLPAY-ATT-1029
  { q: "How do I pay my AT&T Prepaid bill online?", a: "Enter the AT&T Prepaid phone number, pick the amount or plan, and pay. No account needed." }, // BILLPAY-ATT-1029
  { q: "Can I pay AT&T Prepaid as a guest without logging in?", a: "Yes. You don't need a login or an account. The phone number is enough." }, // BILLPAY-ATT-1029
  { q: "Can I pay someone else's AT&T Prepaid line?", a: "Yes. Enter their AT&T Prepaid number and double-check it before you pay." }, // BILLPAY-ATT-1029
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-ATT-1029
  { q: "When does my payment post?", a: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. You see a confirmation with your transaction details once the payment goes through." }, // BILLPAY-ATT-1029
  { q: "Can I set up Auto Pay?", a: "Yes. Auto Pay is optional. You can turn it on at checkout. It is never pre-checked." }, // BILLPAY-ATT-1029
]; // BILLPAY-ATT-1029
const pageplusFaqs = (lang: BillLang): BillFaq[] => lang === "es" ? [ // BILLPAY-PAGEPLUS-1030
  { q: "¿Cómo pago mi factura de Page Plus en línea?", a: "Ingrese el número de teléfono de Page Plus, elija el plan y pague. No necesita una cuenta." }, // BILLPAY-PAGEPLUS-1030
  { q: "¿Puedo pagar Page Plus como invitado, sin iniciar sesión?", a: "Sí. No necesita iniciar sesión ni crear una cuenta. Solo necesita el número de teléfono." }, // BILLPAY-PAGEPLUS-1030
  { q: "¿Puedo pagar la línea de Page Plus de otra persona?", a: "Sí. Ingrese su número de Page Plus y revíselo bien antes de pagar." }, // BILLPAY-PAGEPLUS-1030
  { q: "¿Puedo pagar con Apple Pay o con tarjeta?", a: `Sí. ${methodsLong("es").replace("Apple Pay en dispositivos Apple compatibles", "Apple Pay en dispositivos compatibles")}` }, // BILLPAY-PAGEPLUS-1030
  { q: "¿Cuándo se aplica mi pago?", a: "La mayoría de los pagos se acreditan en pocos minutos, pero el pago puede tardar hasta 30 minutos en aparecer en la cuenta. Cuando el pago se completa, verá una confirmación con los datos de su transacción." }, // BILLPAY-PAGEPLUS-1030
  { q: "¿Puedo activar el Auto Pago?", a: "Sí. El Auto Pago es opcional. Lo puede activar al pagar. Nunca está marcado de antemano." }, // BILLPAY-PAGEPLUS-1030
] : [ // BILLPAY-PAGEPLUS-1030
  { q: "How do I pay my Page Plus bill online?", a: "Enter the Page Plus phone number, pick the plan, and pay. No account needed." }, // BILLPAY-PAGEPLUS-1030
  { q: "Can I pay Page Plus as a guest without logging in?", a: "Yes. You don't need a login or an account. The phone number is enough." }, // BILLPAY-PAGEPLUS-1030
  { q: "Can I pay someone else's Page Plus line?", a: "Yes. Enter their Page Plus number and double-check it before you pay." }, // BILLPAY-PAGEPLUS-1030
  { q: "Can I pay with Apple Pay or a card?", a: `Yes. ${methodsLong("en").replace("Apple Pay on supported Apple devices", "Apple Pay on supported devices")}` }, // BILLPAY-PAGEPLUS-1030
  { q: "When does my payment post?", a: "Most payments post within a few minutes, but it can take up to 30 minutes for a payment to show on the account. You see a confirmation with your transaction details once the payment goes through." }, // BILLPAY-PAGEPLUS-1030
  { q: "Can I set up Auto Pay?", a: "Yes. Auto Pay is optional. You can turn it on at checkout. It is never pre-checked." }, // BILLPAY-PAGEPLUS-1030
]; // BILLPAY-PAGEPLUS-1030

export const BILL_PAGES: BillPage[] = [
  { // BILLPAY-METRO-1021
    ...esPage("/es/metropcs.html", "Metro PCS", ["/es/como-pagar/metro-pcs", "Cómo pagar Metro by T-Mobile"]),
    title: "Pagar Factura Metro PCS en Línea sin Cuenta | CellPay",
    h1: "Pague su Factura de Metro by T-Mobile en Línea",
    sub: "Pague su línea de Metro PCS como invitado, solo con el número. Sin cuenta ni PIN.",
    faqs: metroFaqs("es"),
  },
  { // BILLPAY-METRO-1021
    path: "/metropcs.html", lang: "en", name: "Metro PCS",
    title: "Pay Metro PCS Bill Online as a Guest – No Login | CellPay",
    description: "Metro PCS pay bill online. Pay your Metro by T-Mobile prepaid bill with any card or wallet. No login needed. Service fee shown before you pay.",
    h1: "Pay Your Metro PCS Bill Online", // COPY-1024
    sub: "Metro by T-Mobile bill payment online as a guest — just the phone number. No login, no PIN.", // COPY-1024
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: metroFaqs("en"),
    guide: ["/how-to-pay/metro-pcs", "How to pay Metro by T-Mobile"],
  },
  { // BILLPAY-BOOST-1022
    ...esPage("/es/boost.html", "Boost Mobile", ["/es/como-pagar/boost-mobile", "Cómo pagar Boost Mobile"]),
    title: "Pagar Factura Boost Mobile en Línea sin Cuenta | CellPay",
    h1: "Pague su Factura de Boost Mobile en Línea",
    sub: "Pague su plan de Boost como invitado, solo con el número. Sin cuenta.",
    faqs: boostFaqs("es"),
    more: [["/es/cambiaste-a-boost", "¿Se cambió a Boost Mobile?"], ["/es/paga-tu-factura", "Pague su factura de celular"]],
  },
  { // BILLPAY-BOOST-1022
    path: "/boost.html", lang: "en", name: "Boost Mobile",
    title: "Pay Boost Mobile Bill Online as a Guest – No Login | CellPay",
    description: "Pay your Boost Mobile bill online as a guest with just the phone number. No login needed. Service fee shown before you pay.",
    h1: "Pay Your Boost Mobile Bill Online",
    sub: "Pay your Boost Mobile bill as a guest with just the phone number. No login needed.",
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: boostFaqs("en"),
    guide: ["/how-to-pay/boost-mobile", "How to pay Boost Mobile"],
    more: [["/switched-to-boost", "Switched to Boost Mobile?"], ["/pay-your-phone-bill", "Pay your phone bill"]],
  },
  { // BILLPAY-CRICKET-1023
    ...esPage("/es/topup-crc.html", "Cricket Wireless", ["/es/como-pagar/cricket", "Cómo pagar Cricket Wireless"]), // BILLPAY-CRICKET-1023
    title: "Pagar Factura Cricket en Línea sin Cuenta | CellPay", // BILLPAY-CRICKET-1023
    h1: "Pague su Factura de Cricket Wireless en Línea", // BILLPAY-CRICKET-1023
    sub: "Pague su línea o plan de Cricket solo con el número. Sin cuenta.", // BILLPAY-CRICKET-1023
    faqs: cricketFaqs("es"), // BILLPAY-CRICKET-1023
    more: [["/es/paga-tu-factura", "Pague su factura de celular"]], // BILLPAY-CRICKET-1023
  }, // BILLPAY-CRICKET-1023
  { // BILLPAY-CRICKET-1023
    path: "/topup-crc.html", lang: "en", name: "Cricket Wireless",
    title: "Pay Cricket Bill Online – Quick Pay as a Guest | CellPay", // BILLPAY-CRICKET-1023
    description: "Cricket Quick Pay on CellPay: pay any Cricket Wireless bill online. No login needed. All major cards & wallets. Service fee shown before you pay.",
    h1: "Pay Your Cricket Wireless Bill Online", // BILLPAY-CRICKET-1023
    sub: "Pay your Cricket bill with just the phone number. No login, no account.", // BILLPAY-CRICKET-1023
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.",
    enterAmount: "Enter the amount you want to pay",
    securePayment: "Secure payment. Your payment goes to the number you entered.",
    faqTitle: "Common questions",
    faqs: cricketFaqs("en"), // BILLPAY-CRICKET-1023
    guide: ["/how-to-pay/cricket", "How to pay Cricket Wireless"], // CRICKET-GUIDE-1014
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-CRICKET-1023
  },
  { // BILLPAY-TMOBILE-1024
    path: "/es/tmobile-flexi.html", lang: "es", name: "T-Mobile Prepago", // BILLPAY-TMOBILE-1024
    title: "Pagar Factura T-Mobile como Invitado sin Cuenta | CellPay", // BILLPAY-TMOBILE-1024
    description: "Pague su factura de T-Mobile Prepago en línea como invitado, solo con el número. Sin cuenta y sin iniciar sesión. Verá el cargo por servicio antes de pagar.", // BILLPAY-TMOBILE-1024
    h1: "Pague su Factura de T-Mobile Prepago como Invitado", // BILLPAY-TMOBILE-1024
    sub: "Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono. Pague por usted o por otra persona.", // BILLPAY-TMOBILE-1024
    autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.", // BILLPAY-TMOBILE-1024
    enterAmount: "Ingrese el monto que desea recargar", // BILLPAY-TMOBILE-1024
    securePayment: "Pago seguro. Su recarga se envía directamente a su teléfono.", // BILLPAY-TMOBILE-1024
    faqTitle: "Preguntas frecuentes", // BILLPAY-TMOBILE-1024
    faqs: tmobileFaqs("es"), // BILLPAY-TMOBILE-1024
    guide: ["/es/como-pagar/t-mobile-prepaid", "Cómo pagar T-Mobile Prepago"], // BILLPAY-TMOBILE-1024
    more: [["/es/paga-tu-factura", "Pague su factura de celular"], ["/es/total-wireless", "Pague su factura de Total Wireless"]], // BILLPAY-TMOBILE-1024 // ORGANIC-ES-BILLPAY-TW-TMO-1027
    faqOnly: true, // BILLPAY-TMOBILE-1024
  }, // BILLPAY-TMOBILE-1024
  { // BILLPAY-TMOBILE-1024
    path: "/tmobile-flexi.html", lang: "en", name: "T-Mobile Prepaid", // BILLPAY-TMOBILE-1024
    title: "Pay T-Mobile Prepaid Online: Guest Pay, No Login | CellPay", // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
    description: "Pay or refill your T-Mobile Prepaid online as a guest with just the phone number. No login, no account. Low service fee shown before you pay.", // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
    h1: "Pay Your T-Mobile Prepaid Bill as a Guest", // BILLPAY-TMOBILE-1024
    sub: "No login. Just the phone number. Pay for yourself or someone else.", // BILLPAY-TMOBILE-1024
    autoPayInfoLead: "Optional: Auto Pay so you never miss a refill.", // BILLPAY-TMOBILE-1024
    enterAmount: "Enter the amount you want to recharge", // BILLPAY-TMOBILE-1024
    securePayment: "Secure payment. Your refill is sent directly to your phone.", // BILLPAY-TMOBILE-1024
    faqTitle: "Common questions", // BILLPAY-TMOBILE-1024
    faqs: tmobileFaqs("en"), // BILLPAY-TMOBILE-1024
    guide: ["/how-to-pay/t-mobile-prepaid", "How to pay T-Mobile Prepaid"], // BILLPAY-TMOBILE-1024
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-TMOBILE-1024
    faqOnly: true, // BILLPAY-TMOBILE-1024
    preFaq: ["Add a T-Mobile Prepaid refill online", "Pick your amount and pay. The refill loads straight to the T-Mobile Prepaid number. No card to buy and no PIN code to enter."], // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
  }, // BILLPAY-TMOBILE-1024
  { // BILLPAY-STRAIGHTTALK-1025
    path: "/es/straight-talk.html", lang: "es", name: "Straight Talk", // BILLPAY-STRAIGHTTALK-1025
    title: "Pagar Factura Straight Talk en Línea sin Cuenta | CellPay", // BILLPAY-STRAIGHTTALK-1025
    description: "Pague su factura de Straight Talk en línea solo con el número de teléfono. Sin cuenta y sin iniciar sesión. Verá el cargo por servicio antes de pagar.", // BILLPAY-STRAIGHTTALK-1025
    h1: "Pague su Factura de Straight Talk en Línea", // BILLPAY-STRAIGHTTALK-1025
    sub: "Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono. Pague por usted o por otra persona.", // BILLPAY-STRAIGHTTALK-1025
    autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.", // BILLPAY-STRAIGHTTALK-1025
    enterAmount: "Ingrese el monto que desea recargar", // BILLPAY-STRAIGHTTALK-1025
    securePayment: "Pago seguro. Su recarga se envía directamente a su teléfono.", // BILLPAY-STRAIGHTTALK-1025
    faqTitle: "Preguntas frecuentes", // BILLPAY-STRAIGHTTALK-1025
    faqs: straightTalkFaqs("es"), // BILLPAY-STRAIGHTTALK-1025
    guide: ["/es/como-pagar/straight-talk", "Cómo pagar Straight Talk"], // BILLPAY-STRAIGHTTALK-1025
    more: [["/es/paga-tu-factura", "Pague su factura de celular"]], // BILLPAY-STRAIGHTTALK-1025
    faqOnly: true, // BILLPAY-STRAIGHTTALK-1025
  }, // BILLPAY-STRAIGHTTALK-1025
  { // BILLPAY-STRAIGHTTALK-1025
    path: "/straight-talk.html", lang: "en", name: "Straight Talk", // BILLPAY-STRAIGHTTALK-1025
    title: "Pay Straight Talk Bill Online – No Login, Pay as Guest | CellPay", // BILLPAY-STRAIGHTTALK-1025
    description: "Pay your Straight Talk bill online with just the phone number. No login or account needed. Pay for yourself or someone else. Low service fee shown before you pay.", // BILLPAY-STRAIGHTTALK-1025
    h1: "Pay Your Straight Talk Bill Online", // BILLPAY-STRAIGHTTALK-1025
    sub: "No login. Just the phone number. Pay for yourself or someone else.", // BILLPAY-STRAIGHTTALK-1025
    autoPayInfoLead: "Optional: Auto Pay so you never miss a payment.", // BILLPAY-STRAIGHTTALK-1025
    enterAmount: "Enter the amount you want to recharge", // BILLPAY-STRAIGHTTALK-1025
    securePayment: "Secure payment. Your refill is sent directly to your phone.", // BILLPAY-STRAIGHTTALK-1025
    faqTitle: "Common questions", // BILLPAY-STRAIGHTTALK-1025
    faqs: straightTalkFaqs("en"), // BILLPAY-STRAIGHTTALK-1025
    guide: ["/how-to-pay/straight-talk", "How to pay Straight Talk"], // BILLPAY-STRAIGHTTALK-1025
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-STRAIGHTTALK-1025
    faqOnly: true, // BILLPAY-STRAIGHTTALK-1025
  }, // BILLPAY-STRAIGHTTALK-1025
  { // BILLPAY-TOTALWIRELESS-1026
    path: "/es/total-wireless.html", lang: "es", name: "Total Wireless", // BILLPAY-TOTALWIRELESS-1026
    title: "Pagar Factura Total Wireless en Línea sin Cuenta | CellPay", // BILLPAY-TOTALWIRELESS-1026
    description: "Pague su factura de Total Wireless en línea solo con el número de teléfono. Sin cuenta y sin iniciar sesión. Cargo por servicio bajo, mostrado antes de pagar.", // BILLPAY-TOTALWIRELESS-1026
    h1: "Pague su Factura de Total Wireless en Línea", // BILLPAY-TOTALWIRELESS-1026
    sub: "Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono. Pague por usted o por otra persona.", // BILLPAY-TOTALWIRELESS-1026
    autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.", // BILLPAY-TOTALWIRELESS-1026
    enterAmount: "Ingrese el monto que desea recargar", // BILLPAY-TOTALWIRELESS-1026
    securePayment: "Pago seguro. Su recarga se envía directamente a su teléfono.", // BILLPAY-TOTALWIRELESS-1026
    faqTitle: "Preguntas frecuentes", // BILLPAY-TOTALWIRELESS-1026
    faqs: totalWirelessFaqs("es"), // BILLPAY-TOTALWIRELESS-1026
    guide: ["/es/como-pagar/total-wireless", "Cómo pagar Total Wireless"], // BILLPAY-TOTALWIRELESS-1026
    more: [["/es/paga-tu-factura", "Pague su factura de celular"], ["/es/tmobile-flexi.html", "Pague su factura de T-Mobile Prepago"]], // BILLPAY-TOTALWIRELESS-1026 // ORGANIC-ES-BILLPAY-TW-TMO-1027
    faqOnly: true, // BILLPAY-TOTALWIRELESS-1026
  }, // BILLPAY-TOTALWIRELESS-1026
  { // BILLPAY-TOTALWIRELESS-1026
    path: "/total-wireless.html", lang: "en", name: "Total Wireless", // BILLPAY-TOTALWIRELESS-1026
    title: "Total Wireless Pay Bill Online: No Login, Guest Pay | CellPay", // ORGANIC-TW-PAYBILL-FAQ-1027
    description: "Pay your Total Wireless bill online in minutes. No login needed — enter the phone number, pick your plan and pay with any card or wallet.", // BILLPAY-TOTALWIRELESS-1026
    h1: "Pay Your Total Wireless Bill Online", // BILLPAY-TOTALWIRELESS-1026
    sub: "Pay as a guest with just the phone number. No login needed.", // BILLPAY-TOTALWIRELESS-1026
    autoPayInfoLead: "Optional: Auto Pay so you never miss a refill.", // BILLPAY-TOTALWIRELESS-1026
    enterAmount: "Enter the amount you want to recharge", // BILLPAY-TOTALWIRELESS-1026
    securePayment: "Secure payment. Your refill is sent directly to your phone.", // BILLPAY-TOTALWIRELESS-1026
    faqTitle: "Common questions", // BILLPAY-TOTALWIRELESS-1026
    faqs: totalWirelessFaqs("en"), // BILLPAY-TOTALWIRELESS-1026
    guide: ["/how-to-pay/total-wireless", "How to pay Total Wireless"], // BILLPAY-TOTALWIRELESS-1026
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-TOTALWIRELESS-1026
    faqOnly: true, // BILLPAY-TOTALWIRELESS-1026
  }, // BILLPAY-TOTALWIRELESS-1026
  { // BILLPAY-VERIZON-PREPAID-1027
    path: "/es/verizon", lang: "es", name: "Verizon Prepaid", // BILLPAY-VERIZON-PREPAID-1027
    title: "Pagar Factura Verizon Prepaid en Línea sin Cuenta | CellPay", // BILLPAY-VERIZON-PREPAID-1027
    description: "Pague su factura de Verizon Wireless Prepaid en línea. Sin cuenta y sin iniciar sesión. Puede pagar por otra persona. Verá el cargo por servicio antes de pagar.", // BILLPAY-VERIZON-PREPAID-1027
    h1: "Pague su Factura de Verizon Prepaid en Línea", // BILLPAY-VERIZON-PREPAID-1027
    sub: "Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono. Pague por usted o por otra persona.", // BILLPAY-VERIZON-PREPAID-1027
    autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.", // BILLPAY-VERIZON-PREPAID-1027
    enterAmount: "Ingrese el monto que desea recargar", // BILLPAY-VERIZON-PREPAID-1027
    securePayment: "Pago seguro. Su recarga se envía directamente a su teléfono.", // BILLPAY-VERIZON-PREPAID-1027
    faqTitle: "Preguntas frecuentes", // BILLPAY-VERIZON-PREPAID-1027
    faqs: verizonFaqs("es"), // BILLPAY-VERIZON-PREPAID-1027
    guide: ["/es/como-pagar/verizon-prepaid", "Cómo pagar Verizon Prepaid"], // BILLPAY-VERIZON-PREPAID-1027
    more: [["/es/paga-tu-factura", "Pague su factura de celular"]], // BILLPAY-VERIZON-PREPAID-1027
    faqOnly: true, // BILLPAY-VERIZON-PREPAID-1027
  }, // BILLPAY-VERIZON-PREPAID-1027
  { // BILLPAY-VERIZON-PREPAID-1027
    path: "/verizon", lang: "en", name: "Verizon Prepaid", // BILLPAY-VERIZON-PREPAID-1027
    title: "Pay Verizon Prepaid Bill Online – No Login | CellPay", // BILLPAY-VERIZON-PREPAID-1027
    description: "Pay your Verizon Prepaid bill online with just the phone number. No My Verizon login or account needed. Pay for yourself or someone else.", // BILLPAY-VERIZON-PREPAID-1027
    h1: "Pay Your Verizon Prepaid Bill Online", // BILLPAY-VERIZON-PREPAID-1027
    sub: "No login. Just the phone number. Pay for yourself or someone else.", // BILLPAY-VERIZON-PREPAID-1027
    autoPayInfoLead: "Optional: Auto Pay so you never miss a refill.", // BILLPAY-VERIZON-PREPAID-1027
    enterAmount: "Enter the amount you want to recharge", // BILLPAY-VERIZON-PREPAID-1027
    securePayment: "Secure payment. Your refill is sent directly to your phone.", // BILLPAY-VERIZON-PREPAID-1027
    faqTitle: "Common questions", // BILLPAY-VERIZON-PREPAID-1027
    faqs: verizonFaqs("en"), // BILLPAY-VERIZON-PREPAID-1027
    guide: ["/how-to-pay/verizon-prepaid", "How to pay Verizon Prepaid"], // BILLPAY-VERIZON-PREPAID-1027
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-VERIZON-PREPAID-1027
    faqOnly: true, // BILLPAY-VERIZON-PREPAID-1027
  }, // BILLPAY-VERIZON-PREPAID-1027
  { // BILLPAY-ULTRA-1028
    path: "/es/ultra-mobile.html", lang: "es", name: "Ultra Mobile", // BILLPAY-ULTRA-1028
    title: "Pagar Factura Ultra Mobile en Línea sin Cuenta | CellPay", // BILLPAY-ULTRA-1028
    description: "Pague su factura de Ultra Mobile en línea. Sin cuenta y sin iniciar sesión. Puede pagar por otra persona. Verá el cargo por servicio antes de pagar.", // BILLPAY-ULTRA-1028
    h1: "Pague su Factura de Ultra Mobile en Línea", // BILLPAY-ULTRA-1028
    sub: "Transacciones Sencillas y Seguras para Usuarios Prepagados de Ultra Mobile", // BILLPAY-ULTRA-1028
    autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.", // BILLPAY-ULTRA-1028
    enterAmount: "Ingrese el monto que desea recargar", // BILLPAY-ULTRA-1028
    securePayment: "Pago seguro. Su recarga se envía directamente a su teléfono.", // BILLPAY-ULTRA-1028
    faqTitle: "Preguntas frecuentes", // BILLPAY-ULTRA-1028
    faqs: ultraFaqs("es"), // BILLPAY-ULTRA-1028
    guide: ["/es/como-pagar/ultra-mobile", "Cómo pagar Ultra Mobile"], // BILLPAY-ULTRA-1028
    more: [["/es/paga-tu-factura", "Pague su factura de celular"]], // BILLPAY-ULTRA-1028
    faqOnly: true, // BILLPAY-ULTRA-1028
  }, // BILLPAY-ULTRA-1028
  { // BILLPAY-ULTRA-1028
    path: "/ultra-mobile.html", lang: "en", name: "Ultra Mobile", // BILLPAY-ULTRA-1028
    title: "Pay Ultra Mobile Bill Online – No Login | CellPay", // BILLPAY-ULTRA-1028
    description: "Pay your Ultra Mobile bill online with just the phone number. No account or login needed. Pay for yourself or someone else. Low service fee shown before you pay.", // BILLPAY-ULTRA-1028
    h1: "Pay Your Ultra Mobile Bill Online", // BILLPAY-ULTRA-1028
    sub: "No login needed. Enter your phone number, choose your plan, and you're recharged.", // BILLPAY-ULTRA-1028
    autoPayInfoLead: "Optional: Auto Pay so you never miss a refill.", // BILLPAY-ULTRA-1028
    enterAmount: "Enter the amount you want to recharge", // BILLPAY-ULTRA-1028
    securePayment: "Secure payment. Your refill is sent directly to your phone.", // BILLPAY-ULTRA-1028
    faqTitle: "Common questions", // BILLPAY-ULTRA-1028
    faqs: ultraFaqs("en"), // BILLPAY-ULTRA-1028
    guide: ["/how-to-pay/ultra-mobile", "How to pay Ultra Mobile"], // BILLPAY-ULTRA-1028
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-ULTRA-1028
    faqOnly: true, // BILLPAY-ULTRA-1028
  }, // BILLPAY-ULTRA-1028
  { // BILLPAY-ATT-1029
    path: "/es/topup-at.html", lang: "es", name: "AT&T Prepaid", // BILLPAY-ATT-1029
    title: "Pagar Factura AT&T Prepaid en Línea sin Cuenta | CellPay", // BILLPAY-ATT-1029
    description: "Pague su factura de AT&T Prepaid en línea. Sin cuenta y sin iniciar sesión. Puede pagar por otra persona. Verá el cargo por servicio antes de pagar.", // BILLPAY-ATT-1029
    h1: "Pague su Factura de AT&T Prepaid en Línea", // BILLPAY-ATT-1029
    sub: "Sin cuenta y sin iniciar sesión. Solo necesita el número de teléfono. Pague por usted o por otra persona.", // BILLPAY-ATT-1029
    autoPayInfoLead: "Opcional: Auto Pago para no olvidar su pago.", // BILLPAY-ATT-1029
    enterAmount: "Ingrese el monto que desea recargar", // BILLPAY-ATT-1029
    securePayment: "Pago seguro. Su recarga se envía directamente a su teléfono.", // BILLPAY-ATT-1029
    faqTitle: "Preguntas frecuentes", // BILLPAY-ATT-1029
    faqs: attFaqs("es"), // BILLPAY-ATT-1029
    guide: ["/es/como-pagar/att-prepaid", "Cómo pagar AT&T Prepaid"], // BILLPAY-ATT-1029
    more: [["/es/paga-tu-factura", "Pague su factura de celular"]], // BILLPAY-ATT-1029
    faqOnly: true, // BILLPAY-ATT-1029
  }, // BILLPAY-ATT-1029
  { // BILLPAY-ATT-1029
    path: "/topup-at.html", lang: "en", name: "AT&T Prepaid", // BILLPAY-ATT-1029
    title: "Pay Your AT&T Prepaid Bill Online – No Login | CellPay", // BILLPAY-ATT-1029
    description: "Pay your AT&T Prepaid bill online with just your phone number. No login, no account sign-in needed. Pay for yourself or someone else.", // BILLPAY-ATT-1029
    h1: "Pay Your AT&T Prepaid Bill Online", // BILLPAY-ATT-1029
    sub: "No login. Just the phone number. Pay for yourself or someone else.", // BILLPAY-ATT-1029
    autoPayInfoLead: "Optional: Auto Pay so you never miss a refill.", // BILLPAY-ATT-1029
    enterAmount: "Enter the amount you want to recharge", // BILLPAY-ATT-1029
    securePayment: "Secure payment. Your refill is sent directly to your phone.", // BILLPAY-ATT-1029
    faqTitle: "Common questions", // BILLPAY-ATT-1029
    faqs: attFaqs("en"), // BILLPAY-ATT-1029
    guide: ["/how-to-pay/att-prepaid", "How to pay AT&T Prepaid"], // BILLPAY-ATT-1029
    more: [["/pay-your-phone-bill", "Pay your phone bill"]], // BILLPAY-ATT-1029
    faqOnly: true, // BILLPAY-ATT-1029
  }, // BILLPAY-ATT-1029
];

const BILL_PATH_ALIAS: Record<string, string> = { "/total-wireless": "/total-wireless.html", "/es/total-wireless": "/es/total-wireless.html", "/ultra-mobile": "/ultra-mobile.html", "/es/ultra-mobile": "/es/ultra-mobile.html", "/topup-at": "/topup-at.html", "/es/topup-at": "/es/topup-at.html" }; // TW-FAQ-HYDRATE-SHELL-1027 // BILLPAY-ULTRA-1028 // BILLPAY-ATT-1029

export const billPageByPath = (pathname: string): BillPage | undefined => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const q = BILL_PATH_ALIAS[p] ?? p; // TW-FAQ-HYDRATE-SHELL-1027
  return BILL_PAGES.find((x) => x.path === q);
};

/** FAQPage + BreadcrumbList (Home › Carrier). Same FAQ text as the visible FAQ. */
export const billJsonLd = (pg: BillPage): string => {
  const url = WWW + pg.path;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: pg.lang,
        mainEntity: pg.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: pg.lang === "es" ? "Inicio" : "Home", item: pg.lang === "es" ? `${WWW}/es` : `${WWW}/` },
          { "@type": "ListItem", position: 2, name: pg.name, item: url },
        ],
      },
    ].filter((_, index) => !pg.faqOnly || index === 0), // BILLPAY-TMOBILE-1024
  }).replace(/</g, "\\u003c");
};

/** Raw-HTML block below the first screen (same text as the rendered FAQ + guide link). */
export const billStaticBlock = (pg: BillPage): string =>
  `<section class="max-w-3xl mx-auto px-4 sm:px-6 py-10" data-bill-static="1">` +
  (pg.preFaq ? `<h2 class="text-2xl font-extrabold text-foreground mb-2 text-left">${esc(pg.preFaq[0])}</h2><p class="text-sm text-muted-foreground mb-6 text-left">${esc(pg.preFaq[1])}</p>` : "") + // ORGANIC-TMO-REFILL-ONLINE-FAQ-1027
  `<h2 class="text-2xl font-extrabold text-foreground mb-4 text-left">${esc(pg.faqTitle)}</h2>` +
  pg.faqs.map((f) => `<div class="mb-4 text-left"><h3 class="font-bold">${esc(f.q)}</h3><p class="text-sm text-muted-foreground mt-1">${esc(f.a)}</p></div>`).join("") +
  (pg.guide ? `<p class="text-sm mt-4"><a href="${pg.guide[0]}" class="underline">${esc(pg.guide[1])}</a></p>` : "") +
  (pg.more ? pg.more.map(([href, label]) => `<p class="text-sm mt-2"><a href="${href}" class="underline">${esc(label)}</a></p>`).join("") : "") + // BILLPAY-BOOST-1022
  `</section>`;
