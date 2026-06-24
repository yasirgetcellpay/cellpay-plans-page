import { useLocation } from "react-router-dom";

export type Language = "en" | "es";

export interface Translations {
  // Nav / generic
  back: string;
  account: string;
  // Hero defaults
  heroH1: (carrier: string) => string;
  heroH2: (carrier: string) => string;
  // Phone block
  enterPhoneLabel: (carrier: string) => string;
  phonePlaceholder: string;
  refilling: string;
  enterAll10: string;
  postpaidQuestion: string;
  visitCarrier: (carrier: string) => string;
  // Amount block
  selectAmount: string;
  amountPlaceholder: (min: number, max: number) => string;
  orSelectPlanBelow: string;
  enterAmount: string;
  // Errors
  phoneRequired: string;
  invalidAmount: (min: number, max: number) => string;
  confirmRequired: string;
  invalidPhone: string;
  // Confirm + buttons
  importantLabel: string;
  confirmText: string;
  payNow: string;
  verifying: string;
  total: string;
  securePayment: string;
  tapToContinue: string;
  mostPopular: string;
  // FAQ
  faqsTitle: (carrier: string) => string;
  // Footer
  company: string;
  myAccount: string;
  legal: string;
  aboutUs: string;
  contactUs: string;
  faq: string;
  howToUse: string;
  myProfile: string;
  myOrders: string;
  logIn: string;
  signUp: string;
  privacyPolicy: string;
  termsAndConditions: string;
  returnsPolicy: string;
  copyright: string;
  trademarkDisclaimer: (carrier: string) => string;
  retailDisclaimer: string;
  viewFullTerms: string;
  // PaymentBar
  weAccept: string;

  // ── Checkout ──
  checkout: string;
  rechargeTitle: (carrier: string) => string;
  orderSummary: string;
  phone: string;
  amount: string;
  serviceFee: string;
  tax: string;
  sslSecured: string;
  pciCompliant: string;
  verifiedMerchant: string;
  support247: string;
  contactInformation: string;
  emailPlaceholder: string;
  invalidEmail: string;
  paymentMethod: string;
  cardDetails: string;
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  paypalCheckout: string;
  loadingPaypal: string;
  billingDetails: string;
  billPayerPhone: string;
  stateProvince: string;
  country: string;
  zipCode: string;
  agreeTerms: string;
  agreeTermsSuffix: string;
  saveCard: string;
  saveCardWhats: string;
  subscribeAutoPay: string;
  acceptAutoPayTerms: string;
  placeOrder: string;
  processing: string;
  securePoweredBy: string;
  paymentFailed: string;
  tryAgain: string;
  validationFailedTitle: string;
  validationFailedDesc: string;
  errorTitle: string;
  goBackAria: string;
  // Card method labels
  methodCard: string;
  methodApplePay: string;
  methodGooglePay: string;
  methodPayPal: string;
  methodPayByBank: string;
  methodCashApp: string;
  methodKlarna: string;

  // ── Order Confirmation ──
  thankYouHeader: string;
  contactUsLink: string;
  postedNote: string;
  noTransaction: string;
  couldNotLoad: string;
  backToHome: string;
  orderId: string;
  pinLabel: string;
  productName: string;
  phoneNumber: string;
  emailLabel: string;
  qty: string;
  price: string;
  continueShopping: string;

  // ── Home page ──
  homeH1: string;
  homeSubtitle: string;
  homeRating: string;
  secureCheckout: string;
  instantDelivery: string;
  support247Short: string;
  refillNow: string;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  step: string;
  stepChooseCarrier: string;
  stepEnterNumber: string;
  stepSelectPlan: string;
  stepPay: string;
  homeFaqTitle: string;
  homeFaq: { q: string; a: string }[];

  // ── CashApp / Callback ──
  processingPayment: string;
  confirmingCashApp: string;
  doNotClose: string;
  paymentSuccessful: string;
  rechargeProcessed: string;
  paymentFailedDesc: string;
  transactionLabel: string;
  missingSession: string;
}

const en: Translations = {
  back: "Go back",
  account: "Account",
  heroH1: () => `Top Up Your Mobile Number—Instantly & Securely`,
  heroH2: () => `No login, no hassle. Enter your phone number, choose your plan, and you're recharged.`,
  enterPhoneLabel: (c) => `Enter Your ${c} Phone Number`,
  phonePlaceholder: "(XXX) XXX-XXXX",
  refilling: "Refilling",
  enterAll10: "Enter all 10 digits",
  postpaidQuestion: "Postpaid account?",
  visitCarrier: (c) => `Visit ${c} →`,
  selectAmount: "Select Amount",
  amountPlaceholder: (min, max) => `Enter an amount between ${min} - ${max}`,
  orSelectPlanBelow: "Or select a plan below",
  enterAmount: "Enter the amount you want to recharge",
  phoneRequired: "Please enter a valid 10-digit phone number.",
  invalidAmount: (min, max) => `Please enter an amount between $${min} and $${max}.`,
  confirmRequired: "Please confirm that the phone number is correct.",
  invalidPhone: "Couldn't verify the phone number.",
  importantLabel: "Important",
  confirmText:
    "I have confirmed that I entered the correct phone number. I understand that this sale is final as the minutes cannot be removed nor transferred once loaded to the phone number I have provided above.",
  payNow: "PAY NOW",
  verifying: "VERIFYING...",
  total: "Total",
  securePayment: "Secure payment. Instant refill sent directly to your phone.",
  tapToContinue: "Tap to continue",
  mostPopular: "MOST POPULAR",
  faqsTitle: (c) => `${c} FAQs`,
  company: "Company",
  myAccount: "My Account",
  legal: "Legal",
  aboutUs: "About Us",
  contactUs: "Contact Us",
  faq: "FAQ",
  howToUse: "How to Use",
  myProfile: "My Profile",
  myOrders: "My Orders",
  logIn: "Log In",
  signUp: "Sign Up",
  privacyPolicy: "Privacy Policy",
  termsAndConditions: "Terms & Conditions",
  returnsPolicy: "Returns & Refunds Policy",
  copyright: "© 2026 CellPay. All rights reserved.",
  trademarkDisclaimer: (c) =>
    `${c}® and all carrier names, logos, and trademarks are the property of their respective owners and are referenced solely to identify the prepaid services for which CellPay processes payments. CellPay is an independent payment processor and is not affiliated with, endorsed by, or sponsored by ${c}.`,
  retailDisclaimer:
    "All prices shown are full retail prices. Taxes and fees are additional and vary by location. Service plans are non-refundable.",
  viewFullTerms: "[View full Terms & Conditions]",
  weAccept: "We Accept:",

  checkout: "Checkout",
  rechargeTitle: (c) => `${c} Recharge`,
  orderSummary: "Order Summary",
  phone: "Phone",
  amount: "Amount",
  serviceFee: "Service Fee",
  tax: "Tax",
  sslSecured: "SSL Secured",
  pciCompliant: "PCI Compliant",
  verifiedMerchant: "Verified Merchant",
  support247: "24/7 Support",
  contactInformation: "Contact Information",
  emailPlaceholder: "Email Address *",
  invalidEmail: "Please enter a valid email address",
  paymentMethod: "Payment Method",
  cardDetails: "Card Details",
  firstName: "First Name",
  lastName: "Last Name",
  streetAddress: "Street Address",
  city: "City",
  state: "State",
  zip: "ZIP",
  cardNumber: "Card Number",
  expiry: "MM/YY",
  cvv: "CVV",
  paypalCheckout: "PayPal Checkout",
  loadingPaypal: "Loading PayPal...",
  billingDetails: "Billing Details",
  billPayerPhone: "Bill Payer's Phone Number",
  stateProvince: "State/Province",
  country: "Country",
  zipCode: "ZIP Code",
  agreeTerms: "I agree to the",
  agreeTermsSuffix: "and confirm this sale is final.",
  saveCard: "Save payment information for next time?",
  saveCardWhats: "(What's this)",
  subscribeAutoPay: "Subscribe to Auto Pay?",
  acceptAutoPayTerms: "Accept Terms and Conditions",
  placeOrder: "PLACE ORDER NOW",
  processing: "Processing...",
  securePoweredBy: "Secure payment powered by CellPay. Instant refill sent directly to your phone.",
  paymentFailed: "Payment Failed",
  tryAgain: "Try Again",
  validationFailedTitle: "Validation failed",
  validationFailedDesc: "Unable to validate this recharge",
  errorTitle: "Error",
  goBackAria: "Go back",
  methodCard: "Card",
  methodApplePay: "Apple Pay",
  methodGooglePay: "Google Pay",
  methodPayPal: "PayPal",
  methodPayByBank: "Pay by Bank",
  methodCashApp: "Cash App",
  methodKlarna: "Klarna",

  thankYouHeader: "Thank you for your payment. The charge on your statement will reflect CellPay.",
  contactUsLink: "If you need additional information, please",
  postedNote: "Your payment has been posted on your account. It can take up to 30 min to reflect on your account.",
  noTransaction: "No transaction reference found.",
  couldNotLoad: "Could not load transaction details.",
  backToHome: "Back to Home",
  orderId: "Order ID",
  pinLabel: "Pin (Use it if not recharged)",
  productName: "Product Name",
  phoneNumber: "Phone Number",
  emailLabel: "Email",
  qty: "Qty",
  price: "Price",
  continueShopping: "CONTINUE SHOPPING",

  processingPayment: "Processing your payment",
  confirmingCashApp: "Confirming your Cash App payment…",
  doNotClose: "Please don't close this window — we'll update automatically.",
  paymentSuccessful: "Payment Successful!",
  rechargeProcessed: "Your recharge has been processed successfully.",
  paymentFailedDesc: "Your payment could not be completed. Please try again.",
  transactionLabel: "Transaction",
  missingSession: "Missing payment session reference.",

  homeH1: "Mobile Recharge & Prepaid Phone Refills Online",
  homeSubtitle: "Instant CellPay top-ups for 15+ US carriers · No account required",
  homeRating: "· 50,000+ customers served",
  secureCheckout: "Secure Checkout",
  instantDelivery: "Instant Delivery",
  support247Short: "24/7 Support",
  refillNow: "Refill Now",
  howItWorksTitle: "How it works in 4 easy steps",
  howItWorksSubtitle: "Refill any prepaid line in under 60 seconds — no account needed.",
  step: "Step",
  stepChooseCarrier: "Choose a Carrier",
  stepEnterNumber: "Enter your number",
  stepSelectPlan: "Select a plan",
  stepPay: "Pay",
  homeFaqTitle: "Frequently Asked Questions",
  homeFaq: [
    { q: "What is CellPay?", a: "CellPay is a fast, secure online payment service that lets you refill any major US prepaid wireless line in seconds — no account required." },
    { q: "How does CellPay work?", a: "Pick your carrier, enter the prepaid phone number, choose a refill amount or plan, and pay with card, Apple Pay, Google Pay, PayPal, Klarna, or Cash App. The refill is applied to the line instantly." },
    { q: "Is CellPay for real?", a: "Yes. CellPay has processed payments for thousands of customers across 15+ carriers. Every transaction is processed through trusted, PCI-compliant payment networks." },
    { q: "Is CellPay secure?", a: "Absolutely. All payment data is encrypted in transit with TLS, and card data is handled by PCI-DSS-compliant providers. CellPay never stores your full card number on our servers." },
  ],
};

const es: Translations = {
  back: "Volver",
  account: "Cuenta",
  heroH1: (c) => `Soluciones Rápidas y Seguras para Recargas Prepagadas de ${c}`,
  heroH2: (c) => `Transacciones Sencillas y Seguras para Usuarios Prepagados de ${c}`,
  enterPhoneLabel: (c) => `Ingrese su número de teléfono de ${c}`,
  phonePlaceholder: "(XXX) XXX-XXXX",
  refilling: "Recargando",
  enterAll10: "Ingrese los 10 dígitos",
  postpaidQuestion: "¿Cuenta pospago?",
  visitCarrier: (c) => `Visitar ${c} →`,
  selectAmount: "Seleccione el monto",
  amountPlaceholder: (min, max) => `Ingrese un monto entre ${min} - ${max}`,
  orSelectPlanBelow: "O seleccione un plan abajo",
  enterAmount: "Ingrese el monto que desea recargar",
  phoneRequired: "Por favor ingrese un número de teléfono válido de 10 dígitos.",
  invalidAmount: (min, max) => `Por favor ingrese un monto entre $${min} y $${max}.`,
  confirmRequired: "Por favor confirme que el número de teléfono es correcto.",
  invalidPhone: "No se pudo verificar el número de teléfono.",
  importantLabel: "Importante",
  confirmText:
    "He confirmado que ingresé el número de teléfono correcto. Entiendo que esta venta es final ya que los minutos no se pueden eliminar ni transferir una vez cargados al número de teléfono que proporcioné arriba.",
  payNow: "PAGAR AHORA",
  verifying: "VERIFICANDO...",
  total: "Total",
  securePayment: "Pago seguro. Recarga instantánea enviada directamente a su teléfono.",
  tapToContinue: "Toque para continuar",
  mostPopular: "MÁS POPULAR",
  faqsTitle: (c) => `Preguntas frecuentes de ${c}`,
  company: "Compañía",
  myAccount: "Mi Cuenta",
  legal: "Legal",
  aboutUs: "Sobre Nosotros",
  contactUs: "Contáctenos",
  faq: "Preguntas Frecuentes",
  howToUse: "Cómo Usar",
  myProfile: "Mi Perfil",
  myOrders: "Mis Órdenes",
  logIn: "Iniciar Sesión",
  signUp: "Registrarse",
  privacyPolicy: "Política de Privacidad",
  termsAndConditions: "Términos y Condiciones",
  returnsPolicy: "Política de Devoluciones y Reembolsos",
  copyright: "© 2026 CellPay. Todos los derechos reservados.",
  trademarkDisclaimer: (c) =>
    `${c}® y todos los nombres de operadores, logotipos y marcas comerciales son propiedad de sus respectivos dueños y se mencionan únicamente para identificar los servicios prepagados para los cuales CellPay procesa pagos. CellPay es un procesador de pagos independiente y no está afiliado, respaldado ni patrocinado por ${c}.`,
  retailDisclaimer:
    "Todos los precios mostrados son precios minoristas completos. Los impuestos y tarifas son adicionales y varían según la ubicación. Los planes de servicio no son reembolsables.",
  viewFullTerms: "[Ver Términos y Condiciones completos]",
  weAccept: "Aceptamos:",

  checkout: "Pago",
  rechargeTitle: (c) => `Recarga de ${c}`,
  orderSummary: "Resumen del pedido",
  phone: "Teléfono",
  amount: "Monto",
  serviceFee: "Cargo por servicio",
  tax: "Impuesto",
  sslSecured: "SSL Seguro",
  pciCompliant: "Cumple con PCI",
  verifiedMerchant: "Comerciante verificado",
  support247: "Soporte 24/7",
  contactInformation: "Información de contacto",
  emailPlaceholder: "Correo electrónico *",
  invalidEmail: "Por favor ingrese un correo electrónico válido",
  paymentMethod: "Método de pago",
  cardDetails: "Detalles de la tarjeta",
  firstName: "Nombre",
  lastName: "Apellido",
  streetAddress: "Dirección",
  city: "Ciudad",
  state: "Estado",
  zip: "Código Postal",
  cardNumber: "Número de tarjeta",
  expiry: "MM/AA",
  cvv: "CVV",
  paypalCheckout: "Pago con PayPal",
  loadingPaypal: "Cargando PayPal...",
  billingDetails: "Datos de facturación",
  billPayerPhone: "Teléfono del pagador",
  stateProvince: "Estado/Provincia",
  country: "País",
  zipCode: "Código Postal",
  agreeTerms: "Acepto los",
  agreeTermsSuffix: "y confirmo que esta venta es final.",
  saveCard: "¿Guardar información de pago para la próxima vez?",
  saveCardWhats: "(¿Qué es esto?)",
  subscribeAutoPay: "¿Suscribirse a pago automático?",
  acceptAutoPayTerms: "Aceptar Términos y Condiciones",
  placeOrder: "REALIZAR PEDIDO AHORA",
  processing: "Procesando...",
  securePoweredBy: "Pago seguro con tecnología de CellPay. Recarga instantánea enviada a su teléfono.",
  paymentFailed: "Pago fallido",
  tryAgain: "Intentar de nuevo",
  validationFailedTitle: "Validación fallida",
  validationFailedDesc: "No se pudo validar esta recarga",
  errorTitle: "Error",
  goBackAria: "Volver",
  methodCard: "Tarjeta",
  methodApplePay: "Apple Pay",
  methodGooglePay: "Google Pay",
  methodPayPal: "PayPal",
  methodPayByBank: "Pago bancario",
  methodCashApp: "Cash App",
  methodKlarna: "Klarna",

  thankYouHeader: "Gracias por su pago. El cargo en su estado de cuenta aparecerá como CellPay.",
  contactUsLink: "Si necesita información adicional, por favor",
  postedNote: "Su pago se ha registrado en su cuenta. Puede tardar hasta 30 min en reflejarse.",
  noTransaction: "No se encontró referencia de transacción.",
  couldNotLoad: "No se pudieron cargar los detalles de la transacción.",
  backToHome: "Volver al inicio",
  orderId: "ID del pedido",
  pinLabel: "PIN (Úselo si no se recargó)",
  productName: "Nombre del producto",
  phoneNumber: "Número de teléfono",
  emailLabel: "Correo electrónico",
  qty: "Cant.",
  price: "Precio",
  continueShopping: "CONTINUAR COMPRANDO",

  processingPayment: "Procesando su pago",
  confirmingCashApp: "Confirmando su pago de Cash App…",
  doNotClose: "Por favor no cierre esta ventana — actualizaremos automáticamente.",
  paymentSuccessful: "¡Pago exitoso!",
  rechargeProcessed: "Su recarga se procesó exitosamente.",
  paymentFailedDesc: "No se pudo completar su pago. Por favor inténtelo de nuevo.",
  transactionLabel: "Transacción",
  missingSession: "Falta la referencia de la sesión de pago.",

  homeH1: "Recargue Cualquier Teléfono Prepagado en Segundos",
  homeSubtitle: "Recargas instantáneas para más de 15 operadores · Sin necesidad de cuenta",
  homeRating: "· Más de 50,000 clientes atendidos",
  secureCheckout: "Pago Seguro",
  instantDelivery: "Entrega Instantánea",
  support247Short: "Soporte 24/7",
  refillNow: "Recargar Ahora",
  howItWorksTitle: "Cómo funciona en 4 sencillos pasos",
  howItWorksSubtitle: "Recargue cualquier línea prepagada en menos de 60 segundos — sin necesidad de cuenta.",
  step: "Paso",
  stepChooseCarrier: "Elija un Operador",
  stepEnterNumber: "Ingrese su número",
  stepSelectPlan: "Seleccione un plan",
  stepPay: "Pague",
  homeFaqTitle: "Preguntas Frecuentes",
  homeFaq: [
    { q: "¿Qué es CellPay?", a: "CellPay es un servicio de pago en línea rápido y seguro que le permite recargar cualquier línea inalámbrica prepagada importante de EE. UU. en segundos, sin necesidad de cuenta." },
    { q: "¿Cómo funciona CellPay?", a: "Elija su operador, ingrese el número de teléfono prepagado, seleccione un monto o plan de recarga y pague con tarjeta, Apple Pay, Google Pay, PayPal, Klarna o Cash App. La recarga se aplica a la línea al instante." },
    { q: "¿Es CellPay real?", a: "Sí. CellPay ha procesado pagos para miles de clientes en más de 15 operadores. Cada transacción se procesa a través de redes de pago confiables y compatibles con PCI." },
    { q: "¿Es CellPay seguro?", a: "Absolutamente. Todos los datos de pago se cifran en tránsito con TLS, y los datos de la tarjeta son manejados por proveedores compatibles con PCI-DSS. CellPay nunca almacena el número completo de su tarjeta en nuestros servidores." },
  ],
};

export const t = (lang: Language): Translations => (lang === "es" ? es : en);

/** Detect language from current URL pathname. `/es/...` → 'es', else 'en'. */
export const detectLangFromPath = (pathname: string): Language =>
  pathname === "/es" || pathname.startsWith("/es/") || /-espanol(\.html)?$/.test(pathname) ? "es" : "en";

/** React hook: returns current language based on URL. */
export const useLang = (): Language => {
  const { pathname } = useLocation();
  return detectLangFromPath(pathname);
};

/** Prefix a path with `/es` when lang is Spanish. */
export const langPath = (path: string, lang: Language): string => {
  if (lang !== "es") return path;
  if (path.startsWith("/es/") || path === "/es") return path;
  return `/es${path.startsWith("/") ? path : `/${path}`}`;
};
