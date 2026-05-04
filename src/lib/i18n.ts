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
}

const en: Translations = {
  back: "Go back",
  account: "Account",
  heroH1: (c) => `Streamlined Solutions for Swift and Secure ${c} Prepaid Transactions`,
  heroH2: (c) => `Effortless and Secure Transactions Tailored for ${c} Prepaid Users`,
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
};

export const t = (lang: Language): Translations => (lang === "es" ? es : en);
