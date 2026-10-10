import { useLocation, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { LegalBar } from "@/components/LegalBar";
import { PaymentBar } from "@/components/PaymentBar";
import { AccountDropdown } from "@/components/AccountDropdown";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, CreditCard, Loader2, Building2, Wallet, Apple, Smartphone, CheckCircle2, ShieldCheck, Lock, Headphones } from "lucide-react";
import { CardBrandsStrip, PayPalMark, ApplePayMark, GooglePayMark, KlarnaMark, CashAppMark, BankMark } from "@/components/PaymentBrands";
import { classifyDecline, bumpCardDeclines, clearCardDeclines, MAX_CARD_RETRIES, DECLINE_COPY, type DeclineClass } from "@/lib/declineRecovery";
import { AP_LAST_KEY } from "@/components/AutoPayReceiptCard";
import { PLAID_ENABLED, PAYPAL_ENABLED } from "@/config/paymentFlags";
// [PAYPAL-REBUILD-1009] QA only: ?pp_qa=1 shows the PayPal tile in this tab while PAYPAL_ENABLED is false (?pp_qa=0 clears it).
// cellpay-proxy still refuses PayPal unless fraud_controls.paypal_mode = 'qa' and the phone is on paypal_qa_phones.
const ppShow = (): boolean => {
  if (PAYPAL_ENABLED) return true;
  try {
    const q = new URLSearchParams(window.location.search).get("pp_qa");
    if (q === "1") sessionStorage.setItem("cp_pp_qa", "1");
    if (q === "0") sessionStorage.removeItem("cp_pp_qa");
    return sessionStorage.getItem("cp_pp_qa") === "1";
  } catch {
    return false;
  }
};
import { supabase } from "@/integrations/supabase/client";
import {
  validateRecharge,
  submitTransaction as submitTransactionRaw, // DUPCHARGE-1008: wrapped below (duplicate-charge guard)
  fetchCheckoutConfig,
  createPayPalOrder,
  capturePayPalOrder,
  plaidV2LinkToken,
  plaidV2Exchange,
  createApplePaySession,
  createKlarnaSession,
  type ValidationResult,
} from "@/services/apiWrapper";
import { useToast } from "@/hooks/use-toast";
import { applySeoHead } from "@/lib/seo";
import { getGclid } from "@/lib/tracking";
import { SUPPORTED_COUNTRIES, getSubdivisions, normalizeRegionCode } from "@/lib/subdivisions";
import { useLang, t } from "@/lib/i18n";
// TOP4-T2B-1009: carrier name for the "Your payment was refunded" card (display only)
import { top4Name, displayCarrierName } from "@/content/carrierHero";
import { readCheckoutCtx, writeCheckoutCtx, clearCheckoutCtx, resolveCheckoutFromUrl, carrierPageTarget, cashAppReturnTarget, stripResumeParams, readCheckoutMethod, writeCheckoutMethod } from "@/lib/checkoutResume";

interface LocationState {
  phone: string;
  amount: string;
  planId?: string | number;
  carrierSlug: string;
  carrierName: string;
  brandColor: string;
}

type PaymentMethod = "card" | "paypal" | "plaid" | "googlepay" | "applepay" | "klarna" | "cashapp";

// Normalize a US phone number for the carrier API: strip non-digits and any
// leading "1" country code(s). For US numbers we always want exactly 10 digits.
// US area codes (NPA) never start with 0 or 1, so a leading "1" is ALWAYS the
// country code and must be removed — even on a 10-digit string like
// "1716436920" where the user typed the country code instead of the area code.
function normalizePhone(input: string): string {
  let d = (input || "").replace(/\D/g, "");
  while (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  if (d.length === 10 && d.startsWith("1")) d = d.slice(1);
  return d;
}

declare global {
  interface Window {
    Plaid?: {
      create: (config: Record<string, unknown>) => { open: () => void; destroy: () => void };
    };
    google?: {
      payments?: {
        api?: {
          PaymentsClient: new (config: Record<string, unknown>) => {
            isReadyToPay: (req: Record<string, unknown>) => Promise<{ result: boolean }>;
            loadPaymentData: (req: Record<string, unknown>) => Promise<Record<string, unknown>>;
          };
        };
      };
    };
    ApplePaySession?: {
      new (version: number, req: Record<string, unknown>): {
        begin: () => void;
        onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
        onpaymentauthorized: ((e: { payment: Record<string, unknown> }) => void) | null;
        oncancel: ((e?: unknown) => void) | null;
        completeMerchantValidation: (session: unknown) => void;
        completePayment: (result: { status: number }) => void;
        abort: () => void;
        STATUS_SUCCESS: number;
        STATUS_FAILURE: number;
      };
      canMakePayments: () => boolean;
      canMakePaymentsWithActiveCard?: (merchantId: string) => Promise<boolean>;
      supportsVersion?: (version: number) => boolean; // APAP-1007: v14 is needed for recurringPaymentRequest
    };
    Klarna?: {
      Payments: {
        init: (config: { client_token: string }) => void;
        load: (
          opts: { container: string; payment_method_category: string },
          cb: (res: { show_form: boolean }) => void
        ) => void;
        authorize: (
          opts: { payment_method_category: string },
          data: Record<string, unknown>,
          cb: (res: { approved: boolean; authorization_token?: string }) => void
        ) => void;
      };
    };
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onClick?: (data: unknown, actions: { resolve: () => unknown; reject: () => unknown }) => unknown;
        onCancel?: () => void;
        onError?: (err: unknown) => void;
        style?: Record<string, unknown>;
      }) => {
        render: (container: string | HTMLElement) => Promise<void>;
        close: () => void;
      };
    };
    CashApp?: {
      pay: (config: Record<string, unknown>) => Promise<{ token: string; cashtag: string }>;
    };
  }
}

const loadScript = (src: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

// CV-1b: write pending to sessionStorage AND a SameSite=Lax Secure cookie so Apple Pay / Cash App / redirect returns still match.
const setPurchasePending = (hid: string) => {
  if (!hid) return;
  try { sessionStorage.setItem("cp_purchase_pending", String(hid)); } catch { /* storage unavailable */ }
  try { document.cookie = `cp_purchase_pending=${encodeURIComponent(String(hid))}; path=/; Max-Age=3600; SameSite=Lax; Secure`; } catch { /* cookie unavailable */ }
};

// ARB-1a: Auto Pay offer + disclosure copy (EN/ES), v2. Display only; payload fields unchanged (autopay / autopay_agreement).
// AP_CYCLE_CONFIRMED stays false until CellPay confirms the renewal cycle and fee (open with the CellPay backend via the
// Callingmart Lead). While false, no new copy states a frequency, a $ amount or a date; flip to true only after the answer.
const AP_CYCLE_CONFIRMED = false;
const AP_COPY = {
  en: {
    offerTitle: "Never miss a refill: turn on Auto Pay (optional)",
    offerBenefit: "Refills this number each month on your payment date, so your service doesn't lapse.",
    offerHow: "Charges the same amount to this same payment method. Nothing extra is charged today. Cancel anytime online, no login needed. You'll see the full terms before you agree.", // AUTOPAY-LIFT-1009
    chargeInterim: "Auto Pay recharges this number with this card. Renews monthly on your payment date, cancel anytime.",
    chargeKnown: (amount: string, date: string) => `Auto Pay charges today's total, ${amount}, to this card every 30 days, starting ${date}, until you cancel.`,
    chargeUnknown: (date: string) => `Auto Pay charges the same amount as today's order to this card every 30 days, starting ${date}, until you cancel.`,
    cancelLead: "Cancel anytime online: use ",
    cancelLink: "Unsubscribe From Autopay on our FAQ page",
    cancelTail: " (no login needed), or email support@getcellpay.com.",
    consent: "I agree to the Auto Pay terms below and authorize CellPay to charge this card monthly on my payment date until I cancel.",
    consentConfirmed: "I agree to the Auto Pay terms below and authorize CellPay to charge this card every 30 days until I cancel.",
    placeHint: "Tick the Auto Pay authorization above to continue.",
    termsNote: "",
    gpayNote: "Google Pay: CellPay's payment processor securely saves this Google Pay card so Auto Pay can charge it on each renewal. Auto Pay is run by CellPay, not Google. Cancel anytime with the link above.", // GPAY-AUTOPAY-1008
    dateLocale: "en-US",
  },
  es: {
    offerTitle: "No se quede sin recarga: active el pago automático (opcional)",
    offerBenefit: "Recarga este número cada mes en su fecha de pago, para que su servicio no se interrumpa.",
    offerHow: "Cobra el mismo monto a este mismo método de pago. Hoy no se cobra nada adicional. Cancele en línea cuando quiera, sin iniciar sesión. Verá los términos completos antes de aceptar.", // AUTOPAY-LIFT-1009
    chargeInterim: "El pago automático recarga este número con esta tarjeta. Se renueva cada mes en la fecha de su pago; cancele cuando quiera.",
    chargeKnown: (amount: string, date: string) => `El pago automático cobra el total de hoy, ${amount}, a esta tarjeta cada 30 días, a partir del ${date}, hasta que usted cancele.`,
    chargeUnknown: (date: string) => `El pago automático cobra el mismo monto del pedido de hoy a esta tarjeta cada 30 días, a partir del ${date}, hasta que usted cancele.`,
    cancelLead: "Cancele en línea cuando quiera: use ",
    cancelLink: "«Unsubscribe From Autopay» en nuestra página de Preguntas Frecuentes",
    cancelTail: " (en inglés; sin necesidad de iniciar sesión), o escriba a support@getcellpay.com.",
    consent: "Acepto los términos de pago automático a continuación y autorizo a CellPay a hacer cargos a esta tarjeta cada mes en mi fecha de pago hasta que yo cancele.",
    consentConfirmed: "Acepto los términos de pago automático a continuación y autorizo a CellPay a hacer cargos a esta tarjeta cada 30 días hasta que yo cancele.",
    placeHint: "Marque la autorización de pago automático arriba para continuar.",
    gpayNote: "Google Pay: el procesador de pagos de CellPay guarda de forma segura esta tarjeta de Google Pay para que el pago automático pueda cobrarla en cada renovación. El pago automático lo gestiona CellPay, no Google. Cancele cuando quiera con el enlace de arriba.", // GPAY-AUTOPAY-1008
    dateLocale: "es-US",
  },
} as const;

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  // CK-0: no router state (direct load, new tab, shared link) -> this tab's saved hand-off (30 min), else resolved below. Never blank.
  const routerState = location.state as (LocationState & { resumed?: boolean }) | null;
  const [savedState] = useState<LocationState | null>(() =>
    routerState || cashAppReturnTarget(location.pathname, location.search, location.hash) ? null : readCheckoutCtx(location.search)
  );
  const state = routerState ?? savedState;
  const resumed = !routerState || !!routerState.resumed;
  const lang = useLang();
  const tr = t(lang);
  const apCopy = AP_COPY[lang === "es" ? "es" : "en"];

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Coming BACK from Cash App's hosted page (or PayPal/bank) can restore this page from the browser's
  // back-forward cache with "Processing..." still showing. Reset it so PLACE ORDER NOW works again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setSubmitting(false); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  // Plaid v2 kill switch: cellpay-proxy answered plaid_unavailable (fraud_controls.plaid_exchange_mode = 'off'), so Pay by Bank
  // is hidden for the rest of this visit.
  const [plaidOff, setPlaidOff] = useState(false);
  // Plaid v2: the plaid_ref from step 2 (this order only, at most 1 h; cleared after every checkout answer) and its bank line.
  const plaidRefRef = useRef<{ ref: string; exp: number } | null>(null);
  const [plaidAccount, setPlaidAccount] = useState<string | null>(null);
  // PL-0: a hidden Pay by Bank can never stay selected (falls back to the default, card).
  useEffect(() => { if ((!PLAID_ENABLED || plaidOff) && paymentMethod === "plaid") setPaymentMethod("card"); }, [paymentMethod, plaidOff]);
  useEffect(() => { if (!ppShow() && paymentMethod === "paypal") setPaymentMethod("card"); }, [paymentMethod]); // PAYPAL-HIDE-1154 (+ REBUILD-1009 QA)
  // GROWTH-1007-W: read the Pay by Bank kill switch (fraud_controls.plaid_exchange_mode) once per visit through the boolean-only
  // RPC pay_by_bank_available(). false -> hide Pay by Bank now (same as a plaid_unavailable answer). The decline dialog offers
  // Pay by Bank ONLY after this read said true (fail closed); if the read fails the tab keeps its old behaviour (server refuses anyway).
  const [plaidOn, setPlaidOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!PLAID_ENABLED) return;
    let cancelled = false;
    Promise.resolve((supabase as unknown as { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> }).rpc("pay_by_bank_available"))
      .then(({ data, error }) => { if (cancelled || error || typeof data !== "boolean") return; setPlaidOn(data); if (!data) setPlaidOff(true); })
      .catch(() => { /* unknown: the decline dialog hides Pay by Bank */ });
    return () => { cancelled = true; };
  }, []);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [autoPayTerms, setAutoPayTerms] = useState(false);
  const checkoutConfigRef = useRef<Record<string, unknown> | null>(null); // APAP-1007: mirror of checkoutConfig (state is declared below)
  const [gpGate, setGpGate] = useState<{ ok: boolean; site: string } | null>(null); // GPAY-AUTOPAY-1008: gpay_autopay_check answer (offer stage)
  const gpRecurringRef = useRef(false); // GPAY-AUTOPAY-1008: true only when THIS Google Pay order sent the Auto Pay flags
  const [, setApConfigTick] = useState(0);
  // ARB-0: Auto Pay is offered with card only. Leaving card clears Auto Pay and its terms tick, so hidden state can't keep
  // PLACE ORDER disabled or let another method pay as if Auto Pay were on. Back on card, the customer's own earlier choice
  // comes back. Nothing is ever ticked for a customer who didn't tick it.
  const autoPayChoiceRef = useRef<{ autoPay: boolean; autoPayTerms: boolean } | null>(null);
  // APAP-1007: Apple Pay Auto Pay. Offered ONLY when the API says applePay.recurringSupported === true AND this Safari supports
  // ApplePaySession version 14. Otherwise Apple Pay stays today's one-time session and Auto Pay is not offered on it.
  const applePayRecurringOk = (() => {
    try {
      const ap = checkoutConfigRef.current?.applePay as Record<string, unknown> | undefined;
      const aps = typeof window !== "undefined" ? window.ApplePaySession : undefined;
      return ap?.recurringSupported === true && !!aps && typeof aps.supportsVersion === "function" && aps.supportsVersion(14) === true;
    } catch { return false; }
  })();
  // GPAY-AUTOPAY-1008: Google Pay Auto Pay. Offered ONLY when (a) neither kill switch is off: CellPay's googlePay.recurringSupported
  // is not false AND our site flag (gpay_autopay_controls.site, read through gpay_autopay_check) is not 'off'; (b) one of them turns
  // it on: CellPay's flag === true OR our site flag === 'on'; (c) the Fraud & QA enrollment gates pass for this phone + email.
  // No answer yet / failed / timed out = not offered (fail closed). The one-time Google Pay purchase is unchanged either way.
  const googlePayRecurringCfg = (checkoutConfigRef.current?.googlePay as Record<string, unknown> | undefined)?.recurringSupported;
  const googlePayRecurringOk = !!gpGate && gpGate.ok === true && gpGate.site !== "off" && googlePayRecurringCfg !== false
    && (googlePayRecurringCfg === true || gpGate.site === "on");
  const autoPayMethodOk = paymentMethod === "card" || (paymentMethod === "applepay" && applePayRecurringOk) || (paymentMethod === "googlepay" && googlePayRecurringOk);
  useEffect(() => {
    if (!autoPayMethodOk) {
      if (autoPay || autoPayTerms) {
        autoPayChoiceRef.current = { autoPay, autoPayTerms };
        setAutoPay(false);
        setAutoPayTerms(false);
      }
    } else if (autoPayChoiceRef.current) {
      const choice = autoPayChoiceRef.current;
      autoPayChoiceRef.current = null;
      setAutoPay(choice.autoPay);
      setAutoPayTerms(choice.autoPayTerms);
    }
  }, [paymentMethod, autoPayMethodOk, autoPay, autoPayTerms]);
  // ARB-1b: keep the customer's OWN Auto Pay, Auto Pay-terms and Terms ticks through a refresh or Back, for THIS checkout only
  // (same carrier + number + amount, this tab's sessionStorage, 30 min). Card only: any other method clears it, and so does a
  // successful order. Only a box the customer ticked in this tab comes back; nothing is ever ticked for anyone who didn't tick it.
  // Works with ARB-0 (which clears Auto Pay off card and puts the customer's choice back on card): off card this key is removed.
  const AP_TICKS_KEY = "cp_autopay_ticks_v1";
  const apTicksOrder = state ? `${state.carrierSlug}|${String(state.phone || "").replace(/\D/g, "").slice(-10)}|${Number(state.amount)}` : "";
  const apTicksRestoredRef = useRef(false);
  useEffect(() => {
    if (apTicksRestoredRef.current || !apTicksOrder) return;
    apTicksRestoredRef.current = true;
    try {
      const v = JSON.parse(sessionStorage.getItem(AP_TICKS_KEY) || "null");
      if (!v || v.v !== 1 || v.order !== apTicksOrder || !(Date.now() - Number(v.ts) <= 30 * 60 * 1000)) { sessionStorage.removeItem(AP_TICKS_KEY); return; }
      if (v.terms === true) setAgreedTerms(true);
      if (v.autoPay === true) { setAutoPay(true); if (v.autoPayTerms === true) setAutoPayTerms(true); }
    } catch { /* storage unavailable: nothing restored */ }
  }, [apTicksOrder]);
  useEffect(() => {
    if (!apTicksRestoredRef.current || !apTicksOrder) return;
    try {
      if (paymentMethod === "card" && (autoPay || autoPayTerms || agreedTerms)) {
        sessionStorage.setItem(AP_TICKS_KEY, JSON.stringify({ v: 1, ts: Date.now(), order: apTicksOrder, autoPay, autoPayTerms: autoPay && autoPayTerms, terms: agreedTerms }));
      } else {
        sessionStorage.removeItem(AP_TICKS_KEY);
      }
    } catch { /* storage unavailable */ }
  }, [apTicksOrder, paymentMethod, autoPay, autoPayTerms, agreedTerms]);
  const [showSaveInfoTip, setShowSaveInfoTip] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  // CK-0b: back on checkout for the same order (back from Cash App / PayPal / Klarna, reload, resume) -> keep the method chosen
  // before. Hidden (PLAID_ENABLED false) or unavailable -> stays card (the default). Saved per order, this tab only.
  const methodRestoredRef = useRef(false);
  useEffect(() => {
    if (!state || methodRestoredRef.current) return;
    const saved = readCheckoutMethod({ carrierSlug: state.carrierSlug, phone: state.phone, amount: state.amount });
    if (saved === "applepay" && !applePayAvailable) return; // Apple Pay is detected async: card until it is available
    methodRestoredRef.current = true;
    const allowed: PaymentMethod[] = ppShow() ? ["card", "googlepay", "paypal", "cashapp", "klarna"] : ["card", "googlepay", "cashapp", "klarna"];
    if (applePayAvailable) allowed.push("applepay");
    if (PLAID_ENABLED) allowed.push("plaid");
    if (saved && allowed.includes(saved as PaymentMethod)) setPaymentMethod(saved as PaymentMethod);
  }, [state, applePayAvailable]);
  useEffect(() => {
    if (!state || (!methodRestoredRef.current && paymentMethod === "card")) return;
    methodRestoredRef.current = true;
    writeCheckoutMethod({ carrierSlug: state.carrierSlug, phone: state.phone, amount: state.amount }, paymentMethod);
  }, [state, paymentMethod]);

  // Unique session identifier — generated once per checkout flow and reused
  // across kount_ssid / riskified_sessionid / cbsys_sessionid on every request.
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
  }

  // DUPCHARGE-1008: duplicate-charge guard (cellpay-proxy decides, server-side). DUP_CONFIRM = this phone paid this amount in the
  // last 10 min: ask "You just paid $X for this number, charge again?"; Yes resends the order once with dup_confirm (the proxy
  // removes it; it never reaches CellPay). SESSION_PAID = this checkout session already has a successful charge (e.g. the Apple Pay
  // sheet closed before the reply came back): nothing was charged now, and the earlier paid order is shown as the success it was.
  const dupConfirmRef = useRef(false);
  const [dupAsk, setDupAsk] = useState<{ amount: string } | null>(null);
  // DUPCHARGE-FOLLOWUPS-1008: IN_FLIGHT = the first charge for this order is still at CellPay (< 2 min): calm notice, not an error.
  const [inFlightNote, setInFlightNote] = useState(false);
  const submitTransaction = async (p: Record<string, unknown>): Promise<unknown> => {
    const confirmed = dupConfirmRef.current;
    dupConfirmRef.current = false;
    const raw = await submitTransactionRaw(confirmed ? { ...p, dup_confirm: true } : p);
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (r.code === "DUP_CONFIRM") setDupAsk({ amount: String(r.amount ?? "") });
    if (r.code === "IN_FLIGHT") setInFlightNote(true); // DUPCHARGE-FOLLOWUPS-1008
    if (r.code === "SESSION_PAID" && typeof r.hashid === "string" && r.hashid) {
      return { success: true, data: { status: "success", hashid: r.hashid, message: r.message } };
    }
    return raw;
  };

  // Visitor IP — fetched once on mount and sent as `source` on every transaction.
  const visitorIpRef = useRef<string>("");

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardZip, setCardZip] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [regionId, setRegionId] = useState("");
  const [regionOther, setRegionOther] = useState(false);
  const [country, setCountry] = useState("US");

  // Klarna billing fields
  const [klarnaFirstName, setKlarnaFirstName] = useState("");
  const [klarnaLastName, setKlarnaLastName] = useState("");
  const [klarnaPhone, setKlarnaPhone] = useState("");
  const [klarnaAddress, setKlarnaAddress] = useState("");
  const [klarnaCity, setKlarnaCity] = useState("");
  const [klarnaState, setKlarnaState] = useState("");
  const [klarnaZip, setKlarnaZip] = useState("");
  const [klarnaCountry, setKlarnaCountry] = useState("US");

  // Checkout config from API (typed)
  const [checkoutConfig, setCheckoutConfig] = useState<Record<string, unknown> | null>(null);
  // GPAY-AUTOPAY-1008: Fraud & QA enrollment gates (blocklist, VEL1 24 h, <=1 failed attempt 24 h, 1 name per phone 30 d; A4 behind a
  // DB flag) + our site kill switch, through the boolean-only RPC gpay_autopay_check (it never says which gate failed). Fail closed.
  const gpayAutoPayCheck = useCallback(async (args: { phone: string; email: string; first?: string; last?: string; country?: string; stage: "offer" | "submit" }): Promise<{ ok: boolean; site: string }> => {
    const call = Promise.resolve((supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }).rpc("gpay_autopay_check", {
      _phone: args.phone, _email: args.email, _first: args.first ?? null, _last: args.last ?? null, _country: args.country ?? null, _stage: args.stage,
    })).then(({ data, error }) => {
      const d = (data && typeof data === "object" ? data : null) as { ok?: unknown; site?: unknown } | null;
      const site = d && typeof d.site === "string" ? d.site : "off";
      return { ok: !error && !!d && d.ok === true, site };
    });
    const timeout = new Promise<{ ok: boolean; site: string }>((resolve) => setTimeout(() => resolve({ ok: false, site: "off" }), 3000));
    try { return await Promise.race([call, timeout]); } catch { return { ok: false, site: "off" }; }
  }, []);
  const gpPhone = state ? normalizePhone(String(state.phone || "")) : "";
  const gpEmail = email.trim();
  const gpEmailOk = gpEmail.length > 0 && gpEmail.includes("@") && gpEmail.includes(".");
  useEffect(() => {
    setGpGate(null);
    if (paymentMethod !== "googlepay" || gpPhone.length !== 10 || !gpEmailOk) return;
    let cancelled = false;
    const t = setTimeout(() => { void gpayAutoPayCheck({ phone: gpPhone, email: gpEmail, stage: "offer" }).then((r) => { if (!cancelled) setGpGate(r); }); }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [paymentMethod, gpPhone, gpEmail, gpEmailOk, gpayAutoPayCheck]);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRef = useRef<{ close: () => void } | null>(null);

  // Success / error dialogs
  // Success now redirects to /order-confirmation page
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // CX-HOLD: show "card was NOT charged" on declines with no txn id (not on auto-refund).
  const [showNotChargedNote, setShowNotChargedNote] = useState(false);
  // GROWTH-1007-A: card-decline recovery. Set ONLY for a card decline with no txn id and no auto-refund (= not charged).
  const [declineInfo, setDeclineInfo] = useState<{ cls: DeclineClass; n: number } | null>(null);
  // TOP4-T2B-1009: the provider auto-refunded this payment -> show the refund card instead of the raw provider sentence.
  const [refundCard, setRefundCard] = useState(false);
  const cardFormRef = useRef<HTMLDivElement>(null);

  // Klarna
  const klarnaContainerRef = useRef<HTMLDivElement>(null);
  const [klarnaReady, setKlarnaReady] = useState(false);
  const [klarnaToken, setKlarnaToken] = useState<string | null>(null);

  // Browser fingerprint (FingerprintJS Pro)
  const browserInfoRef = useRef<string>("");

  const getClientProps = useCallback(() => {
    try {
      return {
        languages: (navigator.languages || []).join(",") || navigator.language || "",
        screenResolution: screen?.width && screen?.height ? `${screen.width}x${screen.height}` : "",
        timezone: Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone || "" : "",
        platform: navigator.platform || "",
        vendor: navigator.vendor || "",
      };
    } catch {
      return {};
    }
  }, []);

  // Also scroll to top on mount so users always land on the "Checkout" H1 on
  // mobile (feedback Page 4–5 #1).
  useEffect(() => {
    if (!state) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    (window as unknown as { __cellpayCheckoutMeta?: Record<string, unknown> }).__cellpayCheckoutMeta = {
      carrierName: state.carrierName,
      carrierSlug: state.carrierSlug,
      sessionId: sessionIdRef.current,
    };
    const carrier = state.carrierName ? `${state.carrierName} ` : "";
    applySeoHead({
      title: `Secure ${carrier}Checkout | CellPay`.slice(0, 60),
      description:
        `Complete your ${state.carrierName || "prepaid"} refill securely on CellPay. Pay with card, Apple Pay, Google Pay, PayPal, Klarna, Cash App or bank. Low service fee shown before you pay.`.slice(
          0,
          160,
        ),
    });
  }, [state?.carrierName, state?.carrierSlug]);

  // Load FingerprintJS Pro and capture visitor identifier
  // FP-IDLE-1007 (Fraud & QA approved): start FP when the browser is idle (requestIdleCallback, ~1s setTimeout
  // fallback) instead of on mount. Every submit path calls fpReady(): it starts FP if not started yet and waits at
  // most 1500ms. On timeout the payment goes ahead without visitorId and browser_info carries fp_timeout=true.
  // FP never blocks or fails checkout.
  const fpStartRef = useRef<(() => Promise<void>) | null>(null);
  const fpPromiseRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    // Set a baseline payload immediately so we always send something
    browserInfoRef.current = JSON.stringify(getClientProps());

    const run = (): Promise<void> => {
      if (fpPromiseRef.current) return fpPromiseRef.current;
      fpPromiseRef.current = (async () => {
        try {
          const FingerprintJS = await (new Function(
            "return import('https://fpjscdn.net/v3/4zITUeuShmfN065uFVho')"
          )() as Promise<{ load: () => Promise<{ get: () => Promise<{ visitorId: string; requestId?: string }> }> }>);
          const fp = await FingerprintJS.load();
          const result = await fp.get();
          browserInfoRef.current = JSON.stringify({
            visitorId: result.visitorId,
            requestId: result.requestId || "",
            ...getClientProps(),
          });
        } catch (err) {
          console.warn("FingerprintJS Pro error", err);
        }
      })();
      return fpPromiseRef.current;
    };
    fpStartRef.current = run;

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => { void run(); }, { timeout: 1000 });
    } else {
      timer = setTimeout(() => { void run(); }, 1000);
    }
    return () => {
      if (idleId !== undefined && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, [getClientProps]);

  // FP-IDLE-1007: wait for the visitorId at submit, max 1500ms. Never throws.
  const fpReady = useCallback(async (): Promise<void> => {
    try {
      const p = fpStartRef.current ? fpStartRef.current() : null;
      let timedOut = !p;
      if (p) {
        let t: ReturnType<typeof setTimeout> | undefined;
        timedOut = await Promise.race([
          p.then(() => false),
          new Promise<boolean>((resolve) => { t = setTimeout(() => resolve(true), 1500); }),
        ]);
        if (t) clearTimeout(t);
      }
      let info: Record<string, unknown> = {};
      try { info = JSON.parse(browserInfoRef.current || "{}") as Record<string, unknown>; } catch { info = {}; }
      if (!info.visitorId) {
        browserInfoRef.current = JSON.stringify({ ...getClientProps(), ...info, fp_timeout: timedOut });
      }
    } catch {
      /* never block checkout on FP */
    }
  }, [getClientProps]);

  // Resolve visitor public IP for the `source` field. Best-effort — if the
  // lookup fails (offline / blocked), we send an empty string.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { ip?: string };
        if (!cancelled && data?.ip) visitorIpRef.current = data.ip;
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Detect Apple Pay availability (Safari on supported Apple devices)
  // Mirrors reference site: uses canMakePaymentsWithActiveCard against the merchant ID
  useEffect(() => {
    let cancelled = false;
    const aps = window.ApplePaySession;
    if (!aps || typeof aps.canMakePayments !== "function" || !aps.canMakePayments()) return;

    const merchantId =
      ((checkoutConfig?.applePay as Record<string, unknown> | undefined)?.merchantIdentifier as string) ||
      "merchant.cellpay.us";

    if (typeof aps.canMakePaymentsWithActiveCard === "function") {
      aps
        .canMakePaymentsWithActiveCard(merchantId)
        .then((ok) => {
          if (!cancelled) setApplePayAvailable(!!ok);
        })
        .catch(() => {
          // fallback: at least the device supports Apple Pay even if no provisioned card check works
          if (!cancelled) setApplePayAvailable(true);
        });
    } else {
      setApplePayAvailable(true);
    }
    return () => {
      cancelled = true;
    };
  }, [checkoutConfig]);

  // Load checkout config and validate recharge
  useEffect(() => {
    if (!state) return;
    // Restored checkout that fails validation: back to its carrier page (number + amount filled in), never off-site.
    const leave = () => {
      if (!resumed) { navigate(-1); return; }
      clearCheckoutCtx();
      navigate(carrierPageTarget(lang, state.carrierSlug, state.phone, state.amount, location.search, location.hash), { replace: true });
    };
    (async () => {
      try {
        const [result, config] = await Promise.all([
          validateRecharge(
            state.carrierSlug,
            normalizePhone(state.phone),
            state.planId,
            Number(state.amount)
          ),
          fetchCheckoutConfig().catch(() => null),
        ]);
        if (result.success === false) {
          toast({ title: tr.validationFailedTitle, description: result.message || tr.validationFailedDesc, variant: "destructive" });
          leave();
          return;
        }
        setValidation(result);
        writeCheckoutCtx({ phone: state.phone, amount: String(state.amount), planId: state.planId, carrierSlug: state.carrierSlug, carrierName: state.carrierName, brandColor: state.brandColor });
        if (config) {
          console.log("Checkout config loaded:", config);
          setCheckoutConfig(config);
          checkoutConfigRef.current = config as Record<string, unknown>; setApConfigTick((n) => n + 1); // APAP-1007
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : tr.validationFailedTitle;
        toast({ title: tr.errorTitle, description: msg, variant: "destructive" });
        leave();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state]);

  // CK-0: nothing saved in this tab. Cash App return params -> the existing status page; valid ?carrier&plan|amount&phone ->
  // hand-off rebuilt from the carrier's own data (carriers/view + verify-phone, as PAY NOW does); else carrier page or home.
  // The rebuilt state goes into history (replace), so a refresh keeps it and the number leaves the URL.
  useEffect(() => {
    if (state) return;
    const cashApp = cashAppReturnTarget(location.pathname, location.search, location.hash);
    if (cashApp) { navigate(cashApp, { replace: true }); return; }
    let cancelled = false;
    resolveCheckoutFromUrl(lang, location.search, location.hash).then((r) => {
      if (cancelled) return;
      if (r.state) navigate(`${location.pathname}${stripResumeParams(location.search)}${location.hash}`, { replace: true, state: { ...r.state, resumed: true } });
      else navigate(r.to, { replace: true });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [PAYPAL-1008] No-PII PayPal funnel: one row per step in paypal_funnel_events through the anon RPC log_paypal_funnel
  // (random per-visit id, step name, short code, en/es, host). Never awaited, never throws, never blocks or changes checkout.
  const ppSessRef = useRef<string>("");
  if (!ppSessRef.current) {
    try { ppSessRef.current = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join(""); }
    catch { ppSessRef.current = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join(""); }
  }
  const ppFunnel = (event: string, detail?: string) => {
    try {
      void Promise.resolve((supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => PromiseLike<unknown> }).rpc("log_paypal_funnel", {
        _sess: ppSessRef.current, _event: event, _detail: detail ? String(detail).toLowerCase().slice(0, 64) : null,
        _lang: lang === "es" ? "es" : "en", _host: window.location.hostname,
      })).catch(() => {});
    } catch { /* funnel is best-effort */ }
  };
  const ppEmailRef = useRef(""); // the PayPal buttons are built once; this keeps the latest email for the log row
  ppEmailRef.current = email.trim();
  const ppLogIdRef = useRef<string | null>(null); // pending_log_id of the current PayPal order (proxy log row)
  const ppDupOkRef = useRef(false); // customer saw "You just paid $X" (DUP_CONFIRM) and taps PayPal again = confirmed
  const [ppPaidNoId, setPpPaidNoId] = useState<string | null>(null); // PayPal order id: paid, but CellPay sent no receipt id
  const [ppReceivedId, setPpReceivedId] = useState<string | null>(null); // PAYPAL-HIDE-1154: PayPal took the money, CellPay failed after
  // [PAYPAL-REBUILD-1009] CellPay needs first name, last name and email with a PayPal order; the buttons are built once, so refs.
  const ppFirstRef = useRef(""); ppFirstRef.current = firstName.trim();
  const ppLastRef = useRef(""); ppLastRef.current = lastName.trim();
  const ppTermsRef = useRef(false); ppTermsRef.current = agreedTerms;
  const ppConfirmedRef = useRef(false); // customer already confirmed "charge again?" at create-order for this PayPal order
  // [PAYPAL-UX-1009] inline "details first" panel: ppTried flips on the first rejected PayPal tap (field-level errors show from then on).
  // Display + focus only: no change to what is validated, created or sent.
  const [ppTried, setPpTried] = useState(false);
  const ppFirstElRef = useRef<HTMLInputElement>(null);
  const ppLastElRef = useRef<HTMLInputElement>(null);
  const ppEmailElRef = useRef<HTMLInputElement>(null);
  const ppTermsElRef = useRef<HTMLInputElement>(null);

  // Load PayPal SDK when config is available and paypal is selected
  useEffect(() => {
    if (!checkoutConfig || paymentMethod !== "paypal") return;
    const paypalConfig = checkoutConfig.paypal as Record<string, unknown> | undefined;
    const clientId = paypalConfig?.clientId as string;
    if (!clientId) { ppFunnel("sdk_fail", "no_client_id"); return; }

    const existingScript = document.getElementById("paypal-sdk");
    if (existingScript) { setPaypalReady(true); return; }

    const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons&enable-funding=venmo,paylater&disable-funding=card`;
    loadScript(sdkUrl, "paypal-sdk")
      .then(() => setPaypalReady(true))
      .catch(() => { ppFunnel("sdk_fail", "load"); toast({ title: "Error", description: "Failed to load PayPal SDK", variant: "destructive" }); });
  }, [checkoutConfig, paymentMethod]);

  // Render PayPal Buttons when SDK is ready
  useEffect(() => {
    if (!paypalReady || paymentMethod !== "paypal" || !window.paypal || !paypalContainerRef.current) return;

    // Clean up previous buttons
    if (paypalButtonsRef.current) {
      try { paypalButtonsRef.current.close(); } catch {}
      paypalButtonsRef.current = null;
    }
    paypalContainerRef.current.innerHTML = "";

    // [PAYPAL-REBUILD-1009] Send an approved PayPal order ONCE to checkout/transaction and show the outcome. Same wrapper as every other
    // method (DUP_CONFIRM / IN_FLIGHT dialogs, SESSION_PAID), same success path (handleResult -> receipt -> purchase beacon).
    // Yasir: CellPay failures are generic (no stage/code) and CellPay may already have taken the money, so EVERY CellPay failure shows
    // "we're checking your payment, don't pay again". "Not charged" only when OUR guards refused it (nothing reached CellPay). An
    // approval is never resent: any retry needs a new PayPal approval (new create-order).
    const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
    const ppSubmit = async (body: Record<string, unknown>): Promise<void> => {
      const es = lang === "es";
      let oid = "-";
      try { oid = String(asObj(JSON.parse(String(body.paypal_authorization))).orderID || "-"); } catch { /* keep "-" */ }
      setSubmitting(true); setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); setRefundCard(false);
      try {
        const raw = (await submitTransaction(body) || {}) as Record<string, unknown>;
        let r = raw;
        if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
          const inner = r.data as Record<string, unknown>;
          r = inner.data && typeof inner.data === "object" && !Array.isArray(inner.data) ? inner.data as Record<string, unknown> : inner;
        }
        const st = String(r.status ?? "").toLowerCase();
        const ok = raw.success !== false && (r.status === true || st === "true" || st === "success" || st === "completed");
        const deepId = (v: unknown, d = 0): string => {
          if (!v || typeof v !== "object" || Array.isArray(v) || d > 5) return "";
          const o = v as Record<string, unknown>;
          for (const k of ["hashid", "transactionId", "transaction_id"]) { const x = o[k]; if ((typeof x === "string" && x.trim()) || typeof x === "number") return String(x).trim(); }
          for (const x of Object.values(o)) { const f = deepId(x, d + 1); if (f) return f; }
          return "";
        };
        if (ok) {
          const id = deepId(r);
          if (id) { ppFunnel("capture_ok", "tx"); handleResult({ status: "success", hashid: id }); }
          else { ppFunnel("capture_ok_noid", "tx"); clearCheckoutCtx(); setPpPaidNoId(oid); }
          return;
        }
        const code = String(raw.code || "");
        if (raw.blocked === true && code !== "PAYPAL_ORDER_USED") {
          // OUR guard refused it: nothing reached CellPay, so nothing was charged. A retry = tap PayPal and approve a new payment.
          ppFunnel("blocked", `tx:${code.toLowerCase()}`);
          if (code === "DUP_CONFIRM" || code === "IN_FLIGHT") return; // "Charge again?" / "still processing" dialog is open (wrapper)
          const again = es ? " Para intentarlo de nuevo, toque PayPal y apruebe un pago nuevo." : " To try again, tap PayPal and approve a new payment.";
          setErrorMsg((code === "REFILL_COOLDOWN"
            ? (es ? "Este plan no se pudo recargar en este momento. Intente de nuevo en unos 10 minutos o elija otro plan. No se le cobró." : "This plan couldn't be refilled just now. Please try again in about 10 minutes or choose a different plan. You were not charged.")
            : code === "PAYPAL_UNAVAILABLE"
            ? (es ? "PayPal no está disponible en este momento. Use otro método de pago. No se le cobró." : "PayPal is not available right now. Please use another payment method. You were not charged.")
            : code === "PAYPAL_DETAILS_MISSING"
            ? (es ? "Escriba su nombre, apellido y correo electrónico. No se le cobró." : "Please enter your first name, last name and email. You were not charged.")
            : code === "PAYPAL_AUTH_INVALID" || code === "DUPLICATE"
            ? (es ? "No pudimos leer la aprobación de PayPal. No se le cobró." : "We couldn't read the PayPal approval. You were not charged.")
            : (es ? "No pudimos procesar este pago en este momento. Intente de nuevo en unos 30 minutos o use otro método de pago. No se le cobró." : "We couldn't process this payment right now. Please try again in about 30 minutes or use a different payment method. You were not charged.")) + (code === "PAYPAL_UNAVAILABLE" ? "" : again));
          return;
        }
        // CellPay answered with a failure (or the approval was already sent once): money may be taken -> checking panel.
        const msg = String(r.msg || r.message || raw.error || "").trim();
        ppFunnel("capture_fail", code === "PAYPAL_ORDER_USED" ? "tx:order_used" : `tx:${msg.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || "no_msg"}`);
        clearCheckoutCtx();
        setPpReceivedId(oid);
      } catch {
        ppFunnel("capture_error", "tx");
        clearCheckoutCtx();
        setPpReceivedId(oid); // no answer: we can't know whether CellPay took the money
      } finally {
        setSubmitting(false);
      }
    };

    const buttons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "paypal",
        height: 48,
      },
      // [PAYPAL-REBUILD-1009] No PayPal window until name, email and terms are filled in (CellPay requires them with the order).
      onClick: (_d: unknown, actions: { resolve: () => unknown; reject: () => unknown }) => {
        const ppMiss: string[] = [];
        if (!ppFirstRef.current) ppMiss.push("first");
        if (!ppLastRef.current) ppMiss.push("last");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ppEmailRef.current)) ppMiss.push("email");
        if (!ppTermsRef.current) ppMiss.push("terms");
        if (ppMiss.length === 0) {
          setErrorMsg(null);
          return actions.resolve();
        }
        // [PAYPAL-UX-1009] same check as before, but shown inline (field errors + focus) instead of the "Payment failed" dialog.
        ppFunnel("error", `details_missing:${ppMiss.join("-")}`);
        setPpTried(true);
        try {
          const first = ({ first: ppFirstElRef, last: ppLastElRef, email: ppEmailElRef, terms: ppTermsElRef } as Record<string, { current: HTMLInputElement | null }>)[ppMiss[0]]?.current;
          if (first) {
            first.scrollIntoView({ block: "center", behavior: "smooth" });
            window.setTimeout(() => { try { first.focus({ preventScroll: true }); } catch { /* ignore */ } }, 250);
          }
        } catch { /* focus is best-effort */ }
        return actions.reject();
      },
      createOrder: async () => {
        ppFunnel("button_click");
        ppLogIdRef.current = null;
        const orderPayload = {
          phone_number: normalizePhone(state.phone),
          carrierId: validation?.carrier_id || validation?.carrierId,
          plan_id: state.planId ? String(state.planId) : undefined,
          amount: validation?.amount ?? Number(state.amount),
          total: validation?.total ?? Number(state.amount),
        };

        // [PAYPAL-1008] pp_meta = log + guard fields for cellpay-proxy (same as a card order); the proxy removes it before CellPay.
        const orderRaw = await createPayPalOrder({ ...orderPayload, pp_meta: {
          email: ppEmailRef.current || undefined, carrier_slug: state.carrierSlug, carrier_name: state.carrierName,
          browser_info: browserInfoRef.current, kount_ssid: sessionIdRef.current, source: visitorIpRef.current,
          dup_confirm: ppDupOkRef.current || undefined,
        } }) as Record<string, unknown>;
        ppConfirmedRef.current = ppDupOkRef.current; // [PAYPAL-REBUILD-1009] carried to checkout/transaction as dup_confirm
        ppDupOkRef.current = false;
        if (orderRaw.blocked === true) {
          // Proxy guard (blocklist / refill cooldown): calm message, no PayPal order was created, nothing was charged.
          const code = String(orderRaw.code || "");
          ppFunnel("blocked", code);
          const es = lang === "es";
          const amt = String(orderRaw.amount || "");
          setErrorMsg(code === "REFILL_COOLDOWN"
            ? (es ? "Este plan no se pudo recargar en este momento. Su intento anterior no se completó; cualquier cargo pendiente desaparecerá. Intente de nuevo en unos 10 minutos o elija otro plan." : String(orderRaw.message || "Please try again in about 10 minutes."))
            : code === "SESSION_PAID"
            ? (es ? `Este pedido ya está pagado ($${amt}), así que no le cobramos de nuevo. Su recibo se envió por correo electrónico.` : `This order is already paid ($${amt}), so we did not charge you again. Your receipt was sent by email.`)
            : code === "DUP_CONFIRM"
            ? (es ? `Acaba de pagar $${amt} para este número. No se le cobró esta vez. Si quiere pagar de nuevo, toque el botón de PayPal otra vez.` : `You just paid $${amt} for this number. You were not charged this time. If you want to pay again, tap the PayPal button again.`)
            : code === "PAYPAL_UNAVAILABLE"
            ? (es ? "PayPal no está disponible en este momento. Use otro método de pago. No se le cobró." : "PayPal is not available right now. Please use another payment method. You were not charged.")
            : (es ? "No pudimos procesar este pago en este momento. Intente de nuevo en unos 30 minutos o use otro método de pago. No se le cobró." : "We couldn't process this payment right now. Please try again in about 30 minutes or use a different payment method. You were not charged."));
          if (code === "DUP_CONFIRM") ppDupOkRef.current = true; // the next PayPal tap is the customer's confirmation
          throw new Error("__PP_BLOCKED__");
        }
        if (typeof orderRaw.pending_log_id === "string") ppLogIdRef.current = orderRaw.pending_log_id;
        // Unwrap double-nested
        let orderResult = orderRaw;
        if (orderResult.data && typeof orderResult.data === "object" && !Array.isArray(orderResult.data)) {
          const inner = orderResult.data as Record<string, unknown>;
          if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
            orderResult = inner.data as Record<string, unknown>;
          } else {
            orderResult = inner;
          }
        }

        const orderId = (orderResult.order_id || orderResult.id || orderResult.orderId) as string;
        if (!orderId) {
          // Check if it's a direct success (dev/sandbox mode)
          if (orderResult.status === true || orderResult.status === "true" || orderResult.status === "success" || orderResult.status === "completed") {
            handleResult(orderRaw);
            throw new Error("__DIRECT_SUCCESS__");
          }
          ppFunnel("order_fail");
          throw new Error("Could not create PayPal order");
        }
        ppFunnel("order_created");
        return orderId;
      },
      onApprove: async (data: Record<string, unknown> & { orderID?: string; payerID?: string | null }, actions?: { order?: { get?: () => Promise<unknown> } }) => {
        // [PAYPAL-REBUILD-1009] CellPay's flow (Yasir, Oct 9): NO capture here. The whole approval object goes to CellPay as ONE JSON
        // string (paypal_authorization, incl. orderID + payerID) in checkout/transaction, and CellPay takes the money. Memory only:
        // never stored or logged (it carries PayPal's short-lived facilitatorAccessToken).
        ppFunnel("approve");
        if (!data || !data.orderID || !data.payerID) {
          ppFunnel("capture_fail", "tx:no_payer");
          setErrorMsg(lang === "es" ? "PayPal no confirmó la aprobación. Toque PayPal otra vez. No se le cobró." : "PayPal didn't confirm the approval. Please tap PayPal again. You were not charged.");
          return;
        }
        // Yasir: name/email must match PayPal's payer when PayPal provides them (order details, read-only GET; never a capture).
        let pFirst = ppFirstRef.current, pLast = ppLastRef.current, pEmail = ppEmailRef.current;
        try {
          const od = asObj(await Promise.race([actions?.order?.get?.() ?? Promise.resolve(null), new Promise((res) => setTimeout(() => res(null), 4000))]));
          const payer = asObj(od.payer); const nm = asObj(payer.name);
          const gn = String(nm.given_name || "").trim(), sn = String(nm.surname || "").trim(), em = String(payer.email_address || "").trim();
          if (gn) pFirst = gn;
          if (sn) pLast = sn;
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) pEmail = em;
        } catch { /* keep the typed name/email */ }
        await fpReady();
        const body: Record<string, unknown> = {
          checkout_version: "5.0",
          payment_method: "paypal",
          amount: validation?.amount ?? Number(state.amount),
          total: validation?.total ?? Number(state.amount),
          phone_number: normalizePhone(state.phone),
          carrierId: validation?.carrier_id || validation?.carrierId,
          carrier_slug: state.carrierSlug,
          carrier_name: state.carrierName,
          plan_id: state.planId ? String(state.planId) : undefined,
          agree_desktop: true,
          paypal_authorization: JSON.stringify(data),
          payment: { firstName: pFirst, lastName: pLast, email: pEmail },
          browser_info: browserInfoRef.current,
          gclid: getGclid(),
          kount_ssid: sessionIdRef.current,
          riskified_sessionid: sessionIdRef.current,
          cbsys_sessionid: sessionIdRef.current,
          source: visitorIpRef.current,
          ...(ppConfirmedRef.current ? { dup_confirm: true } : {}),
        };
        ppConfirmedRef.current = false;
        await ppSubmit(body); // body (incl. the authorization) lives only in this call: never stored, never resent
      },
      onCancel: () => {
        ppFunnel("cancel");
        toast({ title: "PayPal", description: "Payment cancelled.", variant: "destructive" });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "__DIRECT_SUCCESS__") return; // handled in createOrder
        if (msg === "__PP_BLOCKED__") return; // [PAYPAL-1008] guard refusal: message already shown in createOrder
        ppFunnel("error", msg === "Could not create PayPal order" ? "create" : "sdk");
        console.error("PayPal error:", err);
        setErrorMsg("PayPal payment failed");
      },
    });

    buttons.render(paypalContainerRef.current).then(() => ppFunnel("button_render"), (err: unknown) => {
      ppFunnel("render_fail");
      console.error("PayPal render error:", err);
    });
    paypalButtonsRef.current = buttons;

    return () => {
      if (paypalButtonsRef.current) {
        try { paypalButtonsRef.current.close(); } catch {}
        paypalButtonsRef.current = null;
      }
    };
  }, [paypalReady, paymentMethod, validation]);

  const basePayload = useCallback((): Record<string, unknown> => ({
    phone_number: normalizePhone(state?.phone || "") || "",
    carrier_slug: state?.carrierSlug || "",
    carrier_name: state?.carrierName || "",
    amount: state?.amount || "",
    plan_id: state?.planId,
    carrier_id: validation?.carrier_id || validation?.carrierId,
  }), [state, validation]);
  const subdivisions = useMemo(() => getSubdivisions(country), [country]);
  const hasSubdivisions = subdivisions.length > 0;

  // #6 fold (iPhone SE): on phones (< sm) PLACE ORDER NOW sits 1,000-1,600px down on arrival. Until the page's own button
  // has scrolled fully above the bar (+8px, so the Help pill never lands on it when it leaves the bar), a bottom bar shows the
  // Total + PLACE ORDER NOW (same canSubmit / handlePlaceOrder; the
  // total is the display-only one from the summary). It reserves the Help launcher's slot (data-help-dock-slot, like the
  // carrier Pay bar), hides while a text field is focused (keypad up) and never shows for PayPal (SDK buttons) or on tablet/desktop.
  const inlinePayRef = useRef<HTMLButtonElement | null>(null);
  const payBarRef = useRef<HTMLDivElement | null>(null);
  const [payBarShown, setPayBarShown] = useState(false);
  useEffect(() => {
    if (loading || !state || paymentMethod === "paypal") { setPayBarShown(false); return; }
    const mq = window.matchMedia("(max-width: 639.98px)");
    let raf = 0;
    let barH = 64;
    const update = () => {
      raf = 0;
      const btn = inlinePayRef.current;
      if (payBarRef.current) barH = payBarRef.current.offsetHeight || barH;
      const a = document.activeElement as HTMLElement | null;
      const typing = !!a && a.matches("input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']), select, textarea");
      setPayBarShown(mq.matches && !!btn && !typing && btn.getBoundingClientRect().bottom > window.innerHeight - barH - 8);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    mq.addEventListener?.("change", schedule);
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      mq.removeEventListener?.("change", schedule);
    };
  }, [loading, paymentMethod, !!state]);

  // GROWTH-1007-B: arriving from the receipt's "Turn on Auto Pay with my next refill" -> scroll to and outline the offer.
  // It NEVER ticks Auto Pay or its authorization; the customer still has to tick both.
  // [CHECKOUT-310-1008] Moved here, above the "if (!state)" loader return: a hook below that return made pre-filled
  // /checkout?carrier&amount&phone links crash (React #310) when state arrives after the first render. Same behavior: it
  // still waits for state before reading the flag, exactly as when it sat below the return.
  useEffect(() => {
    if (!state) return;
    let want = false;
    try { want = sessionStorage.getItem("cp_ap_highlight_v1") === "1"; if (want) sessionStorage.removeItem("cp_ap_highlight_v1"); } catch { /* ignore */ }
    if (!want || paymentMethod !== "card") return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="autopay-offer"]');
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("ring-4", "ring-offset-2"); }
    }, 600);
    return () => clearTimeout(t);
  }, [paymentMethod, !!state]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const brandColor = state.brandColor;
  const total = validation?.total ?? Number(state.amount);
  const fee = validation?.fee ?? 0;
  const tax = validation?.tax ?? 0;

  // Card helpers
  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };
  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };
  const isValidLuhn = (num: string): boolean => {
    const digits = num.replace(/\D/g, "");
    if (digits.length < 13) return false;
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  };
  const detectCardType = (num: string): string => {
    const d = num.replace(/\D/g, "");
    if (/^4/.test(d)) return "visa";
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return "mastercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^6(?:011|5|4[4-9])/.test(d)) return "discover";
    if (/^3(?:0[0-5]|[689])/.test(d)) return "diners";
    if (/^35(2[89]|[3-8]\d)/.test(d)) return "jcb";
    return "unknown";
  };

  // Short network code for the `ctype` field (VI, MC, AE, DI, DN, JCB).
  const detectCardCode = (num: string): string => {
    switch (detectCardType(num)) {
      case "visa": return "VI";
      case "mastercard": return "MC";
      case "amex": return "AE";
      case "discover": return "DI";
      case "diners": return "DN";
      case "jcb": return "JCB";
      default: return "";
    }
  };

  const cardDigits = cardNumber.replace(/\D/g, "");
  const expiryDigits = cardExpiry.replace(/\D/g, "");
  const regionCode = normalizeRegionCode(country, regionId);
  const isCardValid =
    isValidLuhn(cardDigits) &&
    expiryDigits.length === 4 &&
    Number(expiryDigits.slice(0, 2)) >= 1 &&
    Number(expiryDigits.slice(0, 2)) <= 12 &&
    cardCvv.length >= 3 &&
    cardZip.length >= 5 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes("@") &&
    address.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length > 0 &&
    regionCode.length > 0;

  const isEmailValid = email.trim().length > 0 && email.includes("@") && email.includes(".");

  // Per-method required-field validation. Every payment method requires email + phone (already provided).
  const isKlarnaValid =
    klarnaFirstName.trim().length > 0 &&
    klarnaLastName.trim().length > 0 &&
    klarnaPhone.replace(/\D/g, "").length >= 10 &&
    klarnaAddress.trim().length > 0 &&
    klarnaCity.trim().length > 0 &&
    klarnaState.trim().length > 0 &&
    klarnaCountry.trim().length > 0 &&
    klarnaZip.length >= 5;

  let methodValid = true;
  switch (paymentMethod) {
    case "card": methodValid = isCardValid; break;
    case "klarna": methodValid = isKlarnaValid; break;
    // paypal/applepay/googlepay/plaid/cashapp collect their own details via SDK popups
    default: methodValid = true;
  }

  const canSubmit = agreedTerms && !submitting && isEmailValid && methodValid && (!autoPay || autoPayTerms);

  const handleResult = (raw: Record<string, unknown>) => {
    // Unwrap double-nested { data: { data: { status, message, transactionId } } }
    let result = raw;
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      const inner = result.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
        result = inner.data as Record<string, unknown>;
      } else {
        result = inner;
      }
    }
    const status = result.status;
    const isSuccess = status === true || status === "true" || String(status || "").toLowerCase() === "success" || String(status || "").toLowerCase() === "completed";
    if (isSuccess) {
      const hid = (result.hashid || result.transactionId || result.transaction_id || "") as string;
      // Purchase analytics fire once, from /order-confirmation, only when this flag matches its hashid (CV-1b: sessionStorage + cookie).
      setPurchasePending(hid);
      const params = new URLSearchParams({ hashid: hid, color: brandColor, carrier: state.carrierName });
      clearCheckoutCtx();
      try { sessionStorage.removeItem(AP_TICKS_KEY); } catch { /* ignore */ } // ARB-1b: order placed, forget the ticks
      // GROWTH-1007: receipt shows "Auto Pay is on" only when THIS order was card + both Auto Pay ticks. Reset decline count.
      try { if (((paymentMethod === "card" && autoPay && autoPayTerms) || (paymentMethod === "googlepay" && gpRecurringRef.current)) && hid) sessionStorage.setItem(AP_LAST_KEY, hid); else sessionStorage.removeItem(AP_LAST_KEY); } catch { /* ignore */ } // GPAY-AUTOPAY-1008: Google Pay Auto Pay orders too
      clearCardDeclines();
      navigate(`${lang === "es" ? "/es" : ""}/order-confirmation?${params.toString()}`);
    } else {
      // DUPCHARGE-FOLLOWUPS-1008: DUP_CONFIRM / IN_FLIGHT already opened our own dialog (submitTransaction wrapper): no error box, not a decline.
      if (raw.code === "DUP_CONFIRM" || raw.code === "IN_FLIGHT") { setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); return; }
      const msg = (result.msg as string) || (result.message as string) || "Transaction failed";
      const txn = String(result.hashid || result.transactionId || result.transaction_id || "").trim();
      const autoRefund = /auto[\s-]?refund/i.test(msg);
      setShowNotChargedNote(!autoRefund && !txn);
      setDeclineInfo(paymentMethod === "card" && !autoRefund && !txn && raw.code !== "DUP_CONFIRM" && raw.code !== "SESSION_PAID" ? { cls: classifyDecline(msg), n: bumpCardDeclines(apTicksOrder) } : null); // DUPCHARGE-1008: not a decline
      setRefundCard(autoRefund); // TOP4-T2B-1009
      setErrorMsg(msg);
    }
  };

  // ─── Credit Card ───
  const handleCard = async () => {
    await fpReady();
    const payload = {
      checkout_version: "5.0",
      payment_method: "cardpayment",
      amount: validation?.amount ?? Number(state.amount),
      total: validation?.total ?? Number(state.amount),
      phone_number: normalizePhone(state.phone),
      carrierId: validation?.carrier_id || validation?.carrierId || state.planId,
      carrier_slug: state.carrierSlug,
      carrier_name: state.carrierName,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      payment: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        zip: cardZip,
        cc_type: detectCardCode(cardDigits),
        cc_number: cardDigits,
        cc_exp_month: expiryDigits.slice(0, 2),
        cc_exp_year: "20" + expiryDigits.slice(2),
        cvv_number: cardCvv,
        save_cc: saveCard,
        autopay: autoPay,
        autopay_agreement: autoPay && autoPayTerms,
      },
      billing: {
        bill_email: email.trim(),
        country_id: country,
        region_id: regionCode || cardZip,
        state: regionCode,
      },
      browser_info: browserInfoRef.current,
      gclid: getGclid(),
      kount_ssid: sessionIdRef.current,
      riskified_sessionid: sessionIdRef.current,
      cbsys_sessionid: sessionIdRef.current,
      source: visitorIpRef.current,
      ctype: detectCardCode(cardDigits),
    };
    const result = await submitTransaction(payload) as Record<string, unknown>;
    handleResult(result);
  };

  // PayPal is now handled entirely by SDK Buttons rendered in the UI

  // ─── Plaid (Pay by Bank) v2: CellPay's Pay by Bank flow ───
  // 1) link token -> Plaid Link (always opens Link; there is no saved bank), 2) cellpay-proxy exchanges Link's public token
  // with CellPay (decision + plaid_ref), 3) checkout is auto-submitted with plaid_ref only. Every call goes through
  // cellpay-proxy; the public token never goes to checkout and the browser never receives an access token.
  // Steps 2 and 3 send the same order values (the proxy checks this server-side).
  // Messages come from the i18n dictionary (tr.plaid*, English and /es Spanish). CellPay's own `error` text is shown as is;
  // text the proxy wrote itself (msg_by "proxy") is replaced by the dictionary wording for its code.
  const PLAID_CODE_MSG: Record<string, string> = {
    plaid_ref: tr.plaidRelink, plaid_unavailable: tr.plaidUnavailable, plaid_declined: tr.plaidDeclined,
    plaid_bind: tr.plaidFailed, plaid_exchange: tr.plaidFailed, plaid_link: tr.plaidLinkFailed,
  };
  const plaidOrder = () => ({
    carrierId: validation?.carrier_id || validation?.carrierId,
    plan_id: state.planId ? String(state.planId) : undefined,
    phone_number: normalizePhone(state.phone),
    amount: validation?.amount ?? Number(state.amount),
    email: email.trim(),
    slug: state.carrierSlug,
  });
  type PlaidOrder = ReturnType<typeof plaidOrder>;
  const clearPlaidRef = () => { plaidRefRef.current = null; setPlaidAccount(null); };
  const plaidData = (raw: Record<string, unknown>): Record<string, unknown> => {
    const d = raw.data && typeof raw.data === "object" ? raw.data as Record<string, unknown> : {};
    return d.data && typeof d.data === "object" ? d.data as Record<string, unknown> : d;
  };
  const plaidError = (raw: Record<string, unknown>, fallback: string): string => {
    if (raw.msg_by === "proxy") {
      const mine = PLAID_CODE_MSG[String(raw.code)];
      if (mine) return mine;
      if (lang === "es") return fallback; // proxy guard text (e.g. invalid_request) is English-only
    }
    return (typeof raw.error === "string" && raw.error) || (typeof raw.message === "string" && raw.message) || fallback;
  };
  // Kill switch answer (plaid_unavailable): hide Pay by Bank for this visit; the effect above falls back to card.
  const plaidUnavailable = (raw: Record<string, unknown>): boolean => {
    if (raw.code !== "plaid_unavailable") return false;
    clearPlaidRef();
    setPlaidOff(true);
    setErrorMsg(plaidError(raw, tr.plaidUnavailable));
    return true;
  };

  // Step 3. Returns the message to relink with when CellPay answered 422 code "plaid_ref", otherwise null.
  const submitPlaid = async (ref: string, o: PlaidOrder): Promise<string | null> => {
    const raw = await submitTransaction({
      checkout_version: "5.0",
      payment_method: "plaid",
      plaid_ref: ref,
      carrierId: o.carrierId,
      plan_id: o.plan_id,
      phone_number: o.phone_number,
      amount: o.amount,
      agree_desktop: true,
      payment: {
        firstName: firstName.trim() || "Customer",
        lastName: lastName.trim() || "User",
        email: o.email,
      },
      // Read by cellpay-proxy only (same-order check and the log row); never forwarded to CellPay.
      carrier_slug: o.slug,
      carrier_name: state.carrierName,
      total: validation?.total ?? Number(state.amount),
      kount_ssid: sessionIdRef.current,
      source: visitorIpRef.current,
    }) as Record<string, unknown>;
    clearPlaidRef(); // single use: every checkout answer ends this plaid_ref
    const code = raw.code ?? plaidData(raw).code;
    if (code === "plaid_ref") return plaidError(raw, tr.plaidRelink);
    if (plaidUnavailable(raw)) return null;
    const body = raw.data && typeof raw.data === "object" ? raw.data as Record<string, unknown> : {};
    if (raw.code === "DUP_CONFIRM" || raw.code === "IN_FLIGHT") return null; // DUPCHARGE-FOLLOWUPS-1008: our own dialog shows, no error box
    if (raw.success === false || body.success === false) {
      setErrorMsg(plaidError(raw.success === false ? raw : body, tr.plaidPaymentFailed));
      return null;
    }
    handleResult(raw); // success -> order confirmation with data.transactionId, same as card
    return null;
  };

  const handlePlaid = async (relinked = false): Promise<void> => {
    clearPlaidRef();
    const order = plaidOrder();
    const plaidConfig = checkoutConfig?.plaid as Record<string, unknown> | undefined;
    const scriptUrl = (plaidConfig?.linkInitializeScriptUrl as string) || "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    try {
      await loadScript(scriptUrl, "plaid-sdk");
    } catch {
      setErrorMsg(tr.plaidSdkFailed);
      return;
    }

    // Step 1: Link token (cellpay-proxy calls CellPay's payments/plaid/link-token with the phone number).
    const tokenResp = await plaidV2LinkToken({ phone_number: order.phone_number }) as Record<string, unknown>;
    if (plaidUnavailable(tokenResp)) return;
    const linkToken = plaidData(tokenResp).link_token;
    if (tokenResp.success === false || typeof linkToken !== "string" || !linkToken) {
      setErrorMsg(plaidError(tokenResp, tr.plaidLinkFailed));
      return;
    }
    if (!window.Plaid) { setErrorMsg(tr.plaidSdkMissing); return; }

    const outcome: { relink: string | null } = { relink: null };
    await new Promise<void>((resolve) => {
      const handler = window.Plaid!.create({
        token: linkToken,
        onSuccess: async (publicToken: string, metadata: Record<string, unknown>) => {
          try {
            // Step 2: cellpay-proxy sends the public token to CellPay's exchange with the same order values as step 3.
            const ex = await plaidV2Exchange({ ...order, public_token: publicToken, metadata }) as Record<string, unknown>;
            const d = plaidData(ex);
            const ref = typeof d.plaid_ref === "string" ? d.plaid_ref : "";
            if (plaidUnavailable(ex)) {
              // Pay by Bank is now hidden for this visit
            } else if (ex.success === false && ex.code !== "plaid_declined") {
              setErrorMsg(plaidError(ex, tr.plaidPaymentFailed));
            } else if (ex.success === false || d.decision === false || d.decision === "false" || !ref) {
              setErrorMsg(tr.plaidDeclined);
            } else {
              const ttl = Math.min(Number(d.plaid_ref_expires_in) || 3600, 3600);
              plaidRefRef.current = { ref, exp: Date.now() + ttl * 1000 };
              setPlaidAccount(tr.plaidLinkedBank(String(d.account_name ?? ""), String(d.account_mask ?? ""), String(d.name ?? "")));
              // Auto-submit (step 3) while the plaid_ref is fresh.
              outcome.relink = await submitPlaid(ref, order);
            }
          } catch {
            clearPlaidRef();
            setErrorMsg(tr.plaidPaymentFailed);
          }
          resolve();
        },
        onExit: () => resolve(),
      });
      handler.open();
    });
    if (outcome.relink !== null) {
      if (relinked) setErrorMsg(outcome.relink);
      else await handlePlaid(true); // plaid_ref expired or invalid at CellPay: back to step 1 (once per click)
    }
  };

  // ─── Google Pay ───
  const handleGooglePay = async () => {
    gpRecurringRef.current = false; // GPAY-AUTOPAY-1008
    const gpWantAutoPay = autoPay && autoPayTerms && googlePayRecurringOk;
    try {
      await loadScript("https://pay.google.com/gp/p/js/pay.js", "gpay-sdk");
    } catch {
      setErrorMsg("Failed to load Google Pay SDK");
      return;
    }

    if (!window.google?.payments?.api?.PaymentsClient) {
      setErrorMsg("Google Pay is not available");
      return;
    }

    const gpayConfig = checkoutConfig?.googlePay as Record<string, unknown> | undefined;
    const gpayEnv = (gpayConfig?.environment as string) || "TEST";
    const merchantId = (gpayConfig?.merchantId || "") as string;
    const merchantName = (gpayConfig?.merchantName || "CELLPAY") as string;
    const gatewayMerchantId = (gpayConfig?.gatewayMerchantId || merchantId) as string;
    const paymentGateway = (gpayConfig?.paymentGateway || "cybersource") as string;
    const allowedNetworks = (gpayConfig?.allowedCardNetworks as string[]) || ["AMEX", "DISCOVER", "MASTERCARD", "VISA"];

    const client = new window.google.payments.api.PaymentsClient({ environment: gpayEnv });
    const baseCardMethod = {
      type: "CARD",
      parameters: {
        allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
        allowedCardNetworks: allowedNetworks,
        billingAddressRequired: true,
        billingAddressParameters: { format: "FULL", phoneNumberRequired: true },
      },
    };

    const ready = await client.isReadyToPay({ apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [baseCardMethod] });
    if (!ready.result) { setErrorMsg("Google Pay is not available on this device"); return; }

    const paymentData = await client.loadPaymentData({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [{
        ...baseCardMethod,
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: { gateway: paymentGateway, gatewayMerchantId },
        },
      }],
      transactionInfo: { totalPriceStatus: "FINAL", totalPrice: String(total), currencyCode: (gpayConfig?.currencyCode as string) || "USD", countryCode: (gpayConfig?.countryCode as string) || "US" },
      merchantInfo: { merchantId, merchantName },
    });

    const pmd = paymentData.paymentMethodData as Record<string, any>;
    const tokenizationData = pmd?.tokenizationData as Record<string, unknown> | undefined;
    const rawToken = (tokenizationData?.token as string) || "";
    let googlePayTokenPayload: string = rawToken;
    try {
      // Match reference impl: send JSON.stringify(JSON.parse(token))
      googlePayTokenPayload = JSON.stringify(JSON.parse(rawToken));
    } catch {
      googlePayTokenPayload = rawToken;
    }
    const billingAddress =
      pmd?.info?.billingAddress ||
      (pmd as any)?.billingAddress ||
      (paymentData as any)?.billingAddress ||
      null;
    console.log("[GooglePay] paymentMethodData:", pmd);
    console.log("[GooglePay] billingAddress:", billingAddress);

    // GPAY-AUTOPAY-1008: Auto Pay flags ONLY when both ticks are on AND the gates pass again now with the Google billing name and
    // country (A2 one name per phone, A3 US billing) AND neither kill switch is off. Otherwise exactly today's one-time payload.
    let gpRecurring = false;
    if (gpWantAutoPay) {
      const ba = (billingAddress || {}) as Record<string, unknown>;
      const nameParts = String(ba.name || "").trim().split(/\s+/).filter(Boolean);
      const r = await gpayAutoPayCheck({ phone: normalizePhone(state.phone), email: email.trim(), first: nameParts[0] || "", last: nameParts.slice(1).join(" "), country: String(ba.countryCode || ""), stage: "submit" });
      const cfg = (checkoutConfigRef.current?.googlePay as Record<string, unknown> | undefined)?.recurringSupported;
      gpRecurring = r.ok === true && r.site !== "off" && cfg !== false && (cfg === true || r.site === "on");
    }
    gpRecurringRef.current = gpRecurring;
    console.log("[GooglePay] autopay", gpRecurring);

    await fpReady();
    const result = await submitTransaction({
      checkout_version: "5.0",
      payment_method: "googlepay",
      amount: validation?.amount ?? Number(state.amount),
      total: validation?.total ?? Number(state.amount),
      phone_number: normalizePhone(state.phone),
      carrierId: validation?.carrier_id || validation?.carrierId,
      carrier_slug: state.carrierSlug,
      carrier_name: state.carrierName,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      payment: {
        firstName: firstName.trim() || "Customer",
        lastName: lastName.trim() || "User",
        email: email.trim() || "customer@cellpay.us",
        ...(gpRecurring ? { autopay: true, autopay_agreement: true } : {}), // GPAY-AUTOPAY-1008: same field names as card/APAP; never a profileId
      },
      google_pay_token: googlePayTokenPayload,
      gpay_billing_details: JSON.stringify(billingAddress || {}),
      browser_info: browserInfoRef.current,
      gclid: getGclid(),
      kount_ssid: sessionIdRef.current,
      riskified_sessionid: sessionIdRef.current,
      cbsys_sessionid: sessionIdRef.current,
      source: visitorIpRef.current,
    }) as Record<string, unknown>;
    handleResult(result);
  };

  // ─── Apple Pay ───
  const handleApplePay = async () => {
    console.log("[ApplePay] handleApplePay invoked");
    if (!window.ApplePaySession) {
      const msg = "Apple Pay is not available: window.ApplePaySession is undefined (use Safari on a supported Apple device).";
      console.error("[ApplePay]", msg);
      setErrorMsg(msg);
      return;
    }
    try {
      const canMake = window.ApplePaySession.canMakePayments();
      console.log("[ApplePay] canMakePayments() =", canMake);
      if (!canMake) {
        const msg = "Apple Pay is not available: canMakePayments() returned false.";
        console.error("[ApplePay]", msg);
        setErrorMsg(msg);
        return;
      }
    } catch (e) {
      console.error("[ApplePay] canMakePayments() threw", e);
      setErrorMsg("Apple Pay availability check failed: " + (e instanceof Error ? e.message : String(e)));
      return;
    }

    const appleConfig = checkoutConfig?.applePay as Record<string, unknown> | undefined;
    const displayName = (appleConfig?.displayName as string) || "Cellpay.us";
    console.log("[ApplePay] config", { displayName, total, host: window.location.hostname });

    // APAP-1007: recurring ONLY with both Auto Pay ticks AND recurring support. Anything else = today's v3 one-time session, no recurringPaymentRequest.
    const apRecurring = autoPay && autoPayTerms && applePayRecurringOk;
    const apRequest: Record<string, unknown> = {
      countryCode: "US",
      currencyCode: "USD",
      supportedNetworks: ["visa", "masterCard", "amex", "discover"],
      merchantCapabilities: ["supports3DS"],
      total: { label: displayName, amount: String(total) },
      requiredBillingContactFields: ["postalAddress", "email", "phone"],
    };
    if (apRecurring) {
      apRequest.recurringPaymentRequest = {
        paymentDescription: "Cellpay Auto Pay refill every 30 days",
        regularBilling: {
          label: "Auto Pay refill",
          amount: String(total),
          paymentTiming: "recurring",
          recurringPaymentStartDate: new Date(Date.now() + 30 * 86400000),
          recurringPaymentIntervalUnit: "day",
          recurringPaymentIntervalCount: 30,
        },
        managementURL: `${window.location.origin}${lang === "es" ? "/es" : ""}/faq#unsubscribe-autopay`, // FAQ deep link: auto-opens "Unsubscribe From Autopay"
      };
    }
    let session: InstanceType<NonNullable<typeof window.ApplePaySession>>;
    try {
      session = new window.ApplePaySession!(apRecurring ? 14 : 3, apRequest);
      console.log("[ApplePay] session version", apRecurring ? 14 : 3, "recurring", apRecurring);
      console.log("[ApplePay] session created", session);
    } catch (e) {
      console.error("[ApplePay] new ApplePaySession failed", e);
      setErrorMsg("Apple Pay session creation failed: " + (e instanceof Error ? e.message : String(e)));
      setSubmitting(false);
      return;
    }

    session.onvalidatemerchant = async (event) => {
      console.log("[ApplePay] onvalidatemerchant fired", event.validationURL);
      try {
        const merchantSession = await createApplePaySession({ validationURL: event.validationURL }) as Record<string, unknown>;
        console.log("[ApplePay] raw merchant session response", merchantSession);
        // Recursively unwrap any { success, data } wrappers until we find the real Apple session
        let sessionResult: Record<string, unknown> = merchantSession;
        for (let i = 0; i < 5; i++) {
          if (
            sessionResult &&
            typeof sessionResult === "object" &&
            !sessionResult.merchantSessionIdentifier &&
            sessionResult.data &&
            typeof sessionResult.data === "object"
          ) {
            sessionResult = sessionResult.data as Record<string, unknown>;
          } else {
            break;
          }
        }
        if (!sessionResult.merchantSessionIdentifier) {
          console.error("[ApplePay] Invalid merchant session payload (no merchantSessionIdentifier)", merchantSession);
          setErrorMsg("Apple Pay merchant validation returned an invalid session. See console for details.");
          session.abort();
          setSubmitting(false);
          return;
        }
        console.log("[ApplePay] unwrapped merchant session", {
          merchantSessionIdentifier: sessionResult.merchantSessionIdentifier,
          domainName: sessionResult.domainName,
          displayName: sessionResult.displayName,
          expiresAt: sessionResult.expiresAt,
          currentHost: window.location.hostname,
        });
        if (sessionResult.domainName && sessionResult.domainName !== window.location.hostname) {
          console.warn(
            "[ApplePay] DOMAIN MISMATCH: merchant session domainName =",
            sessionResult.domainName,
            "but page is on",
            window.location.hostname,
            "— Apple Pay will reject this session."
          );
        }
        try {
          session.completeMerchantValidation(sessionResult);
          console.log("[ApplePay] completeMerchantValidation succeeded");
        } catch (innerErr) {
          console.error("[ApplePay] completeMerchantValidation threw", innerErr);
          setErrorMsg(
            "Apple Pay merchant validation failed: " +
              (innerErr instanceof Error ? innerErr.message : String(innerErr))
          );
          setSubmitting(false);
        }
      } catch (err) {
        console.error("[ApplePay] onvalidatemerchant error", err);
        setErrorMsg(
          "Apple Pay merchant validation request failed: " +
            (err instanceof Error ? err.message : String(err))
        );
        try { session.abort(); } catch (abortErr) { console.warn("[ApplePay] session.abort() failed", abortErr); }
        setSubmitting(false);
      }
    };

    session.onpaymentauthorized = async (event) => {
      console.log("[ApplePay] onpaymentauthorized fired");
      try {
        const payment = event.payment;
        const fullToken = payment.token as Record<string, unknown> | undefined;
        const billingContact = payment.billingContact;
        console.log("[ApplePay] payment authorized, submitting transaction", { hasToken: !!fullToken });

        await fpReady();
        const raw = await submitTransaction({
          checkout_version: "5.0",
          payment_method: "applepay",
          amount: validation?.amount ?? Number(state.amount),
          total: validation?.total ?? Number(state.amount),
          phone_number: normalizePhone(state.phone),
          carrierId: validation?.carrier_id || validation?.carrierId,
          carrier_slug: state.carrierSlug,
          carrier_name: state.carrierName,
          plan_id: state.planId ? String(state.planId) : undefined,
          agree_desktop: true,
          payment: {
            firstName: (billingContact as Record<string, unknown>)?.givenName || firstName.trim() || "Customer",
            lastName: (billingContact as Record<string, unknown>)?.familyName || lastName.trim() || "User",
            email: email.trim() || "customer@cellpay.us",
            // APAP-1007: same field names as card; never a profileId. true only when the v14 recurring session was used.
            autopay: apRecurring,
            autopay_agreement: apRecurring,
          },
          apple_pay_token: JSON.stringify(fullToken),
          apple_pay_billing_contact: JSON.stringify(billingContact),
          browser_info: browserInfoRef.current,
          gclid: getGclid(),
          kount_ssid: sessionIdRef.current,
          riskified_sessionid: sessionIdRef.current,
          cbsys_sessionid: sessionIdRef.current,
          source: visitorIpRef.current,
        }) as Record<string, unknown>;
        console.log("[ApplePay] transaction response", raw);

        // Unwrap
        let result = raw;
        if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
          const inner = result.data as Record<string, unknown>;
          if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
            result = inner.data as Record<string, unknown>;
          } else {
            result = inner;
          }
        }

        const isSuccess = result.status === true || result.status === "true" || String(result.status || "").toLowerCase() === "success" || String(result.status || "").toLowerCase() === "completed";
        if (isSuccess) {
          console.log("[ApplePay] transaction success");
          // DUPCHARGE-1008: if the sheet already closed (Apple's ~30 s limit), this throws; the order is paid, so still show it.
          try { session.completePayment({ status: session.STATUS_SUCCESS }); } catch (e) { console.warn("[ApplePay] completePayment(success) after the sheet closed", e); }
          const hid = (result.hashid || result.transactionId || result.transaction_id || "") as string;
          setPurchasePending(hid);
          const apParams = new URLSearchParams({ hashid: hid, color: brandColor, carrier: state.carrierName });
          clearCheckoutCtx();
          try { sessionStorage.removeItem(AP_TICKS_KEY); } catch { /* ignore */ } // ARB-1b: order placed, forget the ticks
          try { if (apRecurring && hid) sessionStorage.setItem(AP_LAST_KEY, hid); else sessionStorage.removeItem(AP_LAST_KEY); } catch { /* ignore */ } // APAP-1007
          navigate(`${lang === "es" ? "/es" : ""}/order-confirmation?${apParams.toString()}`);
        } else {
          console.error("[ApplePay] transaction failed", result);
          try { session.completePayment({ status: session.STATUS_FAILURE }); } catch (e) { console.warn("[ApplePay] completePayment(failure) after the sheet closed", e); } // DUPCHARGE-1008
          // DUPCHARGE-FOLLOWUPS-1008: DUP_CONFIRM / IN_FLIGHT already opened our own dialog (submitTransaction wrapper): no error box.
          if (raw.code !== "DUP_CONFIRM" && raw.code !== "IN_FLIGHT") {
            const msg = (result.msg as string) || (result.message as string) || "Apple Pay transaction failed";
            const txn = String(result.hashid || result.transactionId || result.transaction_id || "").trim();
            const autoRefund = /auto[\s-]?refund/i.test(msg);
            setShowNotChargedNote(!autoRefund && !txn);
            setRefundCard(autoRefund); // TOP4-T2B-1009
            setErrorMsg(msg);
          }
        }
      } catch (err) {
        console.error("[ApplePay] onpaymentauthorized error", err);
        try { session.completePayment({ status: session.STATUS_FAILURE }); } catch (e) { console.warn("[ApplePay] completePayment(failure) after the sheet closed", e); } // DUPCHARGE-1008
        setErrorMsg("Apple Pay payment failed: " + (err instanceof Error ? err.message : String(err)));
      }
      setSubmitting(false);
    };

    session.oncancel = (event) => {
      console.warn("[ApplePay] oncancel fired", event);
      setSubmitting(false);
    };

    try {
      console.log("[ApplePay] calling session.begin()");
      session.begin();
    } catch (e) {
      console.error("[ApplePay] session.begin() threw", e);
      setErrorMsg("Apple Pay could not start: " + (e instanceof Error ? e.message : String(e)));
      setSubmitting(false);
      return;
    }
    return "pending" as const; // Apple Pay sheet is open; its callbacks reset submitting
  };

  // ─── Klarna ───
  const buildKlarnaPayload = (authToken: string) => ({
    checkout_version: "5.0",
    payment_method: "klarna",
    amount: validation?.amount ?? Number(state.amount),
    total: validation?.total ?? Number(state.amount),
    phone_number: normalizePhone(state.phone),
    carrierId: validation?.carrier_id || validation?.carrierId,
    carrier_slug: state.carrierSlug,
    carrier_name: state.carrierName,
    plan_id: state.planId ? String(state.planId) : undefined,
    agree_desktop: true,
    payment: {
      firstName: firstName.trim() || "Customer",
      lastName: lastName.trim() || "User",
      email: email.trim() || "customer@cellpay.us",
    },
    klarna_auth_token: authToken,
    browser_info: browserInfoRef.current,
    gclid: getGclid(),
    kount_ssid: sessionIdRef.current,
    riskified_sessionid: sessionIdRef.current,
    cbsys_sessionid: sessionIdRef.current,
    source: visitorIpRef.current,
  });

  const handleKlarna = async () => {
    if (klarnaToken) {
      await fpReady();
      const result = await submitTransaction(buildKlarnaPayload(klarnaToken)) as Record<string, unknown>;
      handleResult(result);
      return;
    }

    const klarnaConfig = checkoutConfig?.klarna as Record<string, unknown> | undefined;
    const klarnaScriptUrl = (klarnaConfig?.paymentsScriptUrl as string) || "https://x.klarnacdn.net/kp/lib/v1/api.js";
    try {
      await loadScript(klarnaScriptUrl, "klarna-sdk");
    } catch {
      setErrorMsg("Failed to load Klarna SDK");
      return;
    }

    const sessionResp = await createKlarnaSession({
      phone_number: normalizePhone(state.phone),
      carrierId: validation?.carrier_id || validation?.carrierId,
      plan_id: state.planId ? String(state.planId) : undefined,
      amount: validation?.total ?? Number(state.amount),
    }) as Record<string, unknown>;

    let sessionData = sessionResp;
    if (sessionData.data && typeof sessionData.data === "object") {
      const inner = sessionData.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object") sessionData = inner.data as Record<string, unknown>;
      else sessionData = inner;
    }
    const clientToken = sessionData.client_token as string;
    if (!clientToken) { setErrorMsg("Could not create Klarna session"); return; }

    if (!window.Klarna) { setErrorMsg("Klarna SDK not available"); return; }

    window.Klarna.Payments.init({ client_token: clientToken });

    return new Promise<void>((resolve) => {
      window.Klarna!.Payments.authorize(
        { payment_method_category: "pay_later" },
        {
          billing_address: {
            given_name: klarnaFirstName,
            family_name: klarnaLastName,
            email: email.trim(),
            phone: klarnaPhone.replace(/\D/g, ""),
            street_address: klarnaAddress,
            city: klarnaCity,
            region: normalizeRegionCode(klarnaCountry || "US", klarnaState),
            state: normalizeRegionCode(klarnaCountry || "US", klarnaState),
            postal_code: klarnaZip,
            country: klarnaCountry || "US",
          },
        },
        async (res) => {
          if (res.approved && res.authorization_token) {
            setKlarnaToken(res.authorization_token);
            try {
              await fpReady();
              const result = await submitTransaction(buildKlarnaPayload(res.authorization_token)) as Record<string, unknown>;
              handleResult(result);
            } catch {
              setErrorMsg("Klarna payment failed");
            }
          } else {
            setErrorMsg("Klarna authorization was declined or cancelled");
          }
          setSubmitting(false);
          resolve();
        }
      );
    });
  };

  // ─── Cash App (Pockyt) ───
  const handleCashApp = async () => {
    // Build absolute return URL pointing back to this app
    const cashappReturnUrl = `${window.location.origin}/checkout/cashapp-return`;

    // Persist context so the return page can rebuild the success redirect
    try {
      sessionStorage.setItem(
        "cashapp_return_ctx",
        JSON.stringify({ brandColor, carrier: state.carrierName })
      );
    } catch {
      /* ignore */
    }

    await fpReady();
    const raw = await submitTransaction({
      checkout_version: "5.0",
      payment_method: "pockyt",
      amount: validation?.amount ?? Number(state.amount),
      total: validation?.total ?? Number(state.amount),
      phone_number: normalizePhone(state.phone),
      carrierId: validation?.carrier_id || validation?.carrierId,
      carrier_slug: state.carrierSlug,
      carrier_name: state.carrierName,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      cashapp_return_url: cashappReturnUrl,
      payment: {
        firstName: firstName.trim() || "Customer",
        lastName: lastName.trim() || "User",
        email: email.trim() || "customer@cellpay.us",
      },
      browser_info: browserInfoRef.current,
      gclid: getGclid(),
      kount_ssid: sessionIdRef.current,
      riskified_sessionid: sessionIdRef.current,
      cbsys_sessionid: sessionIdRef.current,
      source: visitorIpRef.current,
    }) as Record<string, unknown>;

    // Unwrap double-nested response
    let result = raw;
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      const inner = result.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
        result = inner.data as Record<string, unknown>;
      } else {
        result = inner;
      }
    }

    // Check for HostedURL redirect
    const hostedUrl = (result.HostedURL || result.hostedUrl || result.hosted_url) as string;
    const dataObj = result.data as Record<string, unknown> | undefined;
    const nestedHostedUrl = hostedUrl || (dataObj?.HostedURL as string);

    if (nestedHostedUrl) {
      // Persist the pending log id so the return page can finalize the log
      // to success/failed once Pockyt confirms the hosted payment outcome.
      try {
        const pendingLogId = (raw as Record<string, unknown>).pending_log_id as string | undefined;
        if (pendingLogId) {
          const rawCtx = sessionStorage.getItem("cashapp_return_ctx");
          const ctx = rawCtx ? JSON.parse(rawCtx) : {};
          ctx.pending_log_id = pendingLogId;
          sessionStorage.setItem("cashapp_return_ctx", JSON.stringify(ctx));
        }
      } catch { /* ignore */ }
      clearCheckoutCtx();
      window.location.href = nestedHostedUrl;
      return "redirect" as const; // leaving for Cash App: keep "Processing" until the page unloads
    }

    // Cash App requires the customer to complete payment in the Pockyt-hosted
    // flow. Without a HostedURL we have NOT received payment confirmation —
    // never mark as success here. Surface the API error instead so the user
    // can retry.
    const errMsg =
      (result.message as string) ||
      (result.msg as string) ||
      (raw.message as string) ||
      "Cash App Pay is currently unavailable. Please try another payment method.";
    if (raw.code !== "DUP_CONFIRM" && raw.code !== "IN_FLIGHT") setErrorMsg(errMsg); // DUPCHARGE-FOLLOWUPS-1008: our own dialog shows instead
    try { sessionStorage.removeItem("cashapp_return_ctx"); } catch { /* ignore */ }
  };



  const validateBeforeSubmit = (): string | null => {
    if (!isEmailValid) return "Please enter a valid email address.";
    if (!agreedTerms) return "Please accept the terms and conditions.";
    if (autoPay && !autoPayTerms) return "Please accept the auto-pay terms.";
    if (paymentMethod === "card") {
      if (!firstName.trim()) return "First name is required.";
      if (!lastName.trim()) return "Last name is required.";
      if (!address.trim()) return "Street address is required.";
      if (!city.trim()) return "City is required.";
      if (!country.trim()) return "Country is required.";
      if (!regionCode) return "State / region is required.";
      if (cardZip.length < 5) return "ZIP code is required.";
      if (!isValidLuhn(cardDigits)) return "Card number is invalid.";
      if (expiryDigits.length !== 4) return "Card expiry is required.";
      if (cardCvv.length < 3) return "CVV is required.";
    }
    if (paymentMethod === "klarna") {
      if (!klarnaFirstName.trim()) return "Klarna: first name is required.";
      if (!klarnaLastName.trim()) return "Klarna: last name is required.";
      if (klarnaPhone.replace(/\D/g, "").length < 10) return "Klarna: valid phone is required.";
      if (!klarnaAddress.trim()) return "Klarna: street address is required.";
      if (!klarnaCity.trim()) return "Klarna: city is required.";
      if (!klarnaState.trim()) return "Klarna: state is required.";
      if (!klarnaCountry.trim()) return "Klarna: country is required.";
      if (klarnaZip.length < 5) return "Klarna: ZIP is required.";
    }
    return null;
  };

  // ─── Main handler ───
  const handlePlaceOrder = async () => {
    const validationErr = validateBeforeSubmit();
    if (validationErr) { setErrorMsg(validationErr); return; }
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    setShowNotChargedNote(false);
    setDeclineInfo(null);

    // "Processing..." stays ONLY while the Apple Pay sheet is open or the browser is leaving for Cash App's
    // hosted page. Every other outcome (failure, cancel, close, error) resets it here (QA #19).
    let keepProcessing = false;
    try {
      switch (paymentMethod) {
        case "card": await handleCard(); break;
        case "paypal": // PayPal is handled by SDK Buttons. [PAYPAL-REBUILD-1009] "Charge again?" Yes: an approval is never resent, so the
          // confirmation is kept for the NEXT PayPal approval (sent as dup_confirm) and the customer taps PayPal again.
          if (dupConfirmRef.current) {
            dupConfirmRef.current = false;
            ppDupOkRef.current = true;
            setErrorMsg(lang === "es" ? "Para pagar de nuevo, toque PayPal y apruebe un pago nuevo." : "To pay again, tap PayPal and approve a new payment.");
          }
          break;
        case "plaid": await handlePlaid(); break; // resolves after Plaid success/exit
        case "googlepay": await handleGooglePay(); break;
        case "applepay": keepProcessing = (await handleApplePay()) === "pending"; break;
        case "klarna": await handleKlarna(); break; // resolves after the Klarna callback
        case "cashapp": keepProcessing = (await handleCashApp()) === "redirect"; break;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setErrorMsg(msg);
    } finally {
      if (!keepProcessing) setSubmitting(false);
    }
  };

  // Detect iOS for Apple Pay priority — feedback #31
  const isIOS = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;

  type MethodEntry = { key: PaymentMethod; label: string; Brand: React.ComponentType<{ className?: string }> };
  const baseMethods: MethodEntry[] = [
    { key: "card", label: tr.methodCard, Brand: CardBrandsStrip },
    ...(applePayAvailable ? [{ key: "applepay" as PaymentMethod, label: tr.methodApplePay, Brand: ApplePayMark }] : []),
    { key: "googlepay", label: tr.methodGooglePay, Brand: GooglePayMark },
    ...(ppShow() ? [{ key: "paypal" as PaymentMethod, label: tr.methodPayPal, Brand: PayPalMark }] : []), // PAYPAL-HIDE-1154 (+ REBUILD-1009 QA)
    // PL-0: Pay by Bank (Plaid) only shows while PLAID_ENABLED is true (src/config/paymentFlags.ts).
    ...(PLAID_ENABLED && !plaidOff ? [{ key: "plaid" as PaymentMethod, label: tr.methodPayByBank, Brand: BankMark }] : []),
    { key: "cashapp", label: tr.methodCashApp, Brand: CashAppMark },
    { key: "klarna", label: tr.methodKlarna, Brand: KlarnaMark }, // Klarna last — feedback #31
  ];
  // On iOS, push Apple Pay to first position (after Credit Card stays default but Apple Pay prominent)
  const paymentMethods: MethodEntry[] = isIOS && applePayAvailable
    ? [
        baseMethods.find(m => m.key === "applepay")!,
        ...baseMethods.filter(m => m.key !== "applepay"),
      ]
    : baseMethods;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-16 items-center">
            <button
              type="button"
              onClick={() => (resumed ? navigate(carrierPageTarget(lang, state.carrierSlug, state.phone, state.amount, location.search, location.hash)) : navigate(-1))}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors text-foreground"
              aria-label={tr.goBackAria}
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <span className="font-bold text-lg text-foreground">{tr.checkout}</span>
            <AccountDropdown />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-primary-foreground py-3 text-center" style={{ backgroundColor: brandColor }}>
        <h1 className="text-xl font-extrabold">{tr.rechargeTitle(state.carrierName)}</h1>
      </section>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Order summary */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-3 text-sm">{tr.orderSummary}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center"><span className="text-muted-foreground">{tr.phone}</span><span className="font-medium text-foreground inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-cellpay-green" />{state.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{tr.amount}</span><span className="font-medium text-foreground">${state.amount}</span></div>
              {fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{tr.serviceFee}</span><span className="font-medium text-foreground">${Number(fee).toFixed(2)}</span></div>}
              {tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{tr.tax}</span><span className="font-medium text-foreground">${Number(tax).toFixed(2)}</span></div>}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-foreground">{tr.total}</span>
                <span style={{ color: brandColor }}>${Number(total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Checkout trust badges — feedback Page 5–6 #2 */}
          <div className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="flex items-center justify-around gap-2 text-[11px] font-semibold text-muted-foreground">
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center">
                <Lock className="h-4 w-4 text-cellpay-green" />
                <span>{tr.sslSecured}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center">
                <Headphones className="h-4 w-4 text-cellpay-green" />
                <span>{tr.supportLine}</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-3 text-sm">{tr.contactInformation}</h2>
            <input type="email" placeholder={tr.emailPlaceholder} aria-label={tr.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
            {email.length > 0 && !email.includes("@") && (
              <p className="text-xs text-destructive mt-1">{tr.invalidEmail}</p>
            )}
          </div>

          {/* Payment Method Select */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-3 text-sm">{tr.paymentMethod}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { if (m.key === "paypal" && paymentMethod !== "paypal") ppFunnel("tile_tap"); setPaymentMethod(m.key); }}
                  aria-pressed={paymentMethod === m.key}
                  className={`relative rounded-lg border-2 py-2.5 px-2 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 min-h-[68px] ${
                    paymentMethod === m.key
                      ? "text-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-current bg-card"
                  }`}
                  style={paymentMethod === m.key ? { borderColor: brandColor, backgroundColor: /^#[0-9a-f]{6}$/i.test(brandColor || "") ? `${brandColor}14` : undefined, boxShadow: `0 0 0 1px ${brandColor}` } : undefined}
                >
                  {paymentMethod === m.key && (
                    <CheckCircle2 className="absolute top-1 right-1 h-3.5 w-3.5" style={{ color: brandColor }} aria-hidden="true" />
                  )}
                  <span className="h-6 w-full flex items-center justify-center">
                    <m.Brand className="h-5 w-auto max-w-[64px] object-contain" />
                  </span>
                  <span className="text-[11px] leading-tight">{m.label}</span>
                  {m.key === "plaid" && (
                    <span className="text-[10px] leading-none font-medium text-muted-foreground">{lang === "es" ? "Vincule su banco" : "Link your bank"}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Plaid v2: the bank CellPay confirmed in step 2, shown while checkout is submitted */}
          {paymentMethod === "plaid" && plaidAccount && (
            <div className="bg-card rounded-xl border border-border p-4 text-sm font-medium text-foreground" aria-live="polite">
              {plaidAccount}
            </div>
          )}

          {/* Card form (only shown for credit card) */}
          {paymentMethod === "card" && (
            <div ref={cardFormRef} className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h2 className="font-bold text-foreground mb-1 text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> {tr.cardDetails}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required placeholder={`${tr.firstName} *`} aria-label={tr.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" required placeholder={`${tr.lastName} *`} aria-label={tr.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <select aria-label={tr.country} value={country} onChange={(e) => { setCountry(e.target.value); setRegionId(""); setRegionOther(false); }}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties}>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
                <option value="OTHER">{lang === "es" ? "Otro" : "Other"}</option>
              </select>
              <input type="text" required placeholder={`${tr.streetAddress} *`} aria-label={tr.streetAddress} value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <div className="grid grid-cols-3 gap-3">
                <input type="text" required placeholder={`${tr.city} *`} aria-label={tr.city} value={city} onChange={(e) => setCity(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                {hasSubdivisions && !regionOther ? (
                  <select
                    aria-label={tr.stateProvince}
                    value={regionId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__OTHER__") {
                        setRegionOther(true);
                        setRegionId("");
                      } else {
                        setRegionId(v);
                      }
                    }}
                    className="h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                  >
                    <option value="">{tr.state}</option>
                    {subdivisions.map((s) => (
                      <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                    ))}
                    <option value="__OTHER__">{lang === "es" ? "Otro…" : "Other…"}</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={tr.stateProvince}
                      aria-label={tr.stateProvince}
                      value={regionId}
                      onChange={(e) => setRegionId(e.target.value.toUpperCase().slice(0, 10))}
                      maxLength={10}
                      className="h-11 w-full px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                    />
                    {hasSubdivisions && regionOther && (
                      <button
                        type="button"
                        onClick={() => { setRegionOther(false); setRegionId(""); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground underline"
                      >
                        {lang === "es" ? "lista" : "list"}
                      </button>
                    )}
                  </div>
                )}
                <input type="text" placeholder={tr.zip} aria-label={tr.zip} value={cardZip} onChange={(e) => setCardZip(e.target.value.replace(/\D/g, "").slice(0, 5))} maxLength={5}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <input type="text" placeholder={tr.cardNumber} aria-label={tr.cardNumber} value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder={tr.expiry} aria-label={tr.expiry} value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} maxLength={5}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder={tr.cvv} aria-label={tr.cvv} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
            </div>
          )}

          {/* PayPal Buttons container (rendered by SDK) */}
          {paymentMethod === "paypal" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h2 className="font-bold text-foreground mb-1 text-sm">{tr.paypalCheckout}</h2>
              {/* [PAYPAL-REBUILD-1009] CellPay needs the buyer's name and email with a PayPal order (same fields as the card form). */}
              {/* [PAYPAL-UX-1009] Details first, inline and marked: names, email and terms are all here, above the PayPal button. Same state
                  (firstName / lastName / email / agreedTerms) as the rest of checkout; nothing new is sent or validated. */}
              {(() => {
                const es = lang === "es";
                const ppEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
                const bad = { first: !firstName.trim(), last: !lastName.trim(), email: !ppEmailOk, terms: !agreedTerms };
                const anyBad = bad.first || bad.last || bad.email || bad.terms;
                const cls = (b: boolean) => `h-11 px-4 rounded-lg border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent ${b && ppTried ? "border-destructive" : "border-input"}`;
                const fe = (b: boolean, text: string) => (b && ppTried ? <p role="alert" className="text-xs text-destructive mt-1">{text}</p> : null);
                return (
                  <>
                    <p className="text-xs text-muted-foreground" data-testid="paypal-details-intro">
                      {es
                        ? "Complete sus datos y luego toque el botón de PayPal. Le enviaremos el recibo por correo."
                        : "Fill in your details, then tap the PayPal button. We'll email your receipt."}
                    </p>
                    <div className="grid grid-cols-2 gap-3" data-testid="paypal-name">
                      <div>
                        <input ref={ppFirstElRef} type="text" required autoComplete="given-name" placeholder={`${tr.firstName} *`} aria-label={tr.firstName} aria-invalid={bad.first && ppTried} value={firstName} onChange={(e) => setFirstName(e.target.value)}
                          className={`w-full ${cls(bad.first)}`} style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                        {fe(bad.first, es ? "Escriba su nombre" : "Enter your first name")}
                      </div>
                      <div>
                        <input ref={ppLastElRef} type="text" required autoComplete="family-name" placeholder={`${tr.lastName} *`} aria-label={tr.lastName} aria-invalid={bad.last && ppTried} value={lastName} onChange={(e) => setLastName(e.target.value)}
                          className={`w-full ${cls(bad.last)}`} style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                        {fe(bad.last, es ? "Escriba su apellido" : "Enter your last name")}
                      </div>
                    </div>
                    <div data-testid="paypal-email">
                      <input ref={ppEmailElRef} type="email" inputMode="email" autoComplete="email" placeholder={es ? "Correo electrónico para su recibo *" : "Email for your receipt *"} aria-label={es ? "Correo electrónico para su recibo" : "Email for your receipt"} aria-invalid={bad.email && ppTried} value={email} onChange={(e) => setEmail(e.target.value)}
                        className={`w-full ${cls(bad.email)}`} style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                      {fe(bad.email, es ? "Escriba un correo electrónico válido" : "Enter a valid email address")}
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer" data-testid="paypal-terms">
                      <input ref={ppTermsElRef} type="checkbox" checked={agreedTerms} aria-invalid={bad.terms && ppTried} onChange={(e) => setAgreedTerms(e.target.checked)}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded ${bad.terms && ppTried ? "border-destructive" : "border-input"}`} style={{ accentColor: brandColor }} />
                      <span className="text-sm text-foreground leading-relaxed">
                        {tr.agreeTerms}{" "}
                        <a href="/terms-and-conditions" target="_blank" rel="noopener" className="underline font-semibold" style={{ color: brandColor }}>
                          {tr.termsAndConditions}
                        </a>{" "}
                        {tr.agreeTermsSuffix}
                      </span>
                    </label>
                    {fe(bad.terms, es ? "Acepte los términos para continuar" : "Please accept the terms to continue")}
                    {ppTried && anyBad && (
                      <p role="alert" className="text-sm font-semibold text-destructive" data-testid="paypal-details-alert">
                        {es
                          ? "Casi listo: complete los campos marcados y toque PayPal de nuevo. No se cobró nada."
                          : "Almost there: complete the highlighted fields, then tap PayPal again. Nothing was charged."}
                      </p>
                    )}
                    {!anyBad && (
                      <p role="status" className="text-sm font-semibold" style={{ color: brandColor }} data-testid="paypal-details-ready">
                        {es ? "Todo listo. Toque PayPal para pagar." : "All set. Tap PayPal to pay."}
                      </p>
                    )}
                  </>
                );
              })()}
              {!paypalReady ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{tr.loadingPaypal}</span>
                </div>
              ) : (
                <div ref={paypalContainerRef} id="paypal-button-container" />
              )}
            </div>
          )}

          {/* Klarna Billing Details */}
          {paymentMethod === "klarna" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h2 className="font-bold text-foreground mb-1 text-sm">{tr.billingDetails}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{tr.firstName} <span className="text-destructive">*</span></label>
                  <input type="text" placeholder={tr.firstName} value={klarnaFirstName} onChange={(e) => setKlarnaFirstName(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{tr.lastName} <span className="text-destructive">*</span></label>
                  <input type="text" placeholder={tr.lastName} value={klarnaLastName} onChange={(e) => setKlarnaLastName(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr.billPayerPhone} <span className="text-destructive">*</span></label>
                <input type="tel" placeholder="(000) 000-0000" value={klarnaPhone} onChange={(e) => setKlarnaPhone(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr.streetAddress} <span className="text-destructive">*</span></label>
                <input type="text" placeholder={tr.streetAddress} value={klarnaAddress} onChange={(e) => setKlarnaAddress(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{tr.city} <span className="text-destructive">*</span></label>
                  <input type="text" placeholder={tr.city} value={klarnaCity} onChange={(e) => setKlarnaCity(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{tr.stateProvince} <span className="text-destructive">*</span></label>
                  <input type="text" placeholder={tr.state} value={klarnaState} onChange={(e) => setKlarnaState(e.target.value.toUpperCase())}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{tr.country} <span className="text-destructive">*</span></label>
                  <input type="text" placeholder={lang === "es" ? "Estados Unidos" : "United States"} value={klarnaCountry} onChange={(e) => setKlarnaCountry(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{tr.zip} <span className="text-destructive">*</span></label>
                  <input type="text" placeholder={tr.zipCode} value={klarnaZip} onChange={(e) => setKlarnaZip(e.target.value.replace(/\D/g, "").slice(0, 5))} maxLength={5}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>
            </div>
          )}

          {/* Klarna container (hidden, used by SDK) */}
          <div ref={klarnaContainerRef} id="klarna-payments-container" className="hidden" />

          {/* Terms + Place Order */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <label className={paymentMethod === "paypal" ? "hidden" : "flex items-start gap-3 cursor-pointer"}>{/* PAYPAL-UX-1009: PayPal shows this checkbox inside its own panel */}
              <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-input" style={{ accentColor: brandColor }} />
              <span className="text-sm text-foreground leading-relaxed">
                {tr.agreeTerms}{" "}
                <a href="/terms-and-conditions" target="_blank" rel="noopener" className="underline font-semibold" style={{ color: brandColor }}>
                  {tr.termsAndConditions}
                </a>{" "}
                {tr.agreeTermsSuffix}
              </span>
            </label>

            {paymentMethod === "card" && (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-input" style={{ accentColor: brandColor }} />
                  <span className="text-sm text-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">{tr.saveCard}</span>{" "}
                    <button
                      type="button"
                      onClick={() => setShowSaveInfoTip(true)}
                      className="underline font-semibold"
                      style={{ color: brandColor }}
                    >
                      {tr.saveCardWhats}
                    </button>
                  </span>
                </label>
              </>
            )}

            {autoPayMethodOk && (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={autoPay} onChange={(e) => setAutoPay(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-input" style={{ accentColor: brandColor }} />
                  <span data-testid="autopay-offer" className="flex-1 text-sm leading-snug rounded-lg border-2 px-3 py-2 -mt-1" style={{ borderColor: brandColor }}>
                    <span className="block font-bold text-foreground">{apCopy.offerTitle}</span>
                    <span className="block text-muted-foreground mt-0.5">{apCopy.offerBenefit}</span>
                    <span data-testid="autopay-offer-how" className="block text-muted-foreground mt-1">{apCopy.offerHow}</span>
                  </span>
                </label>


                {autoPay && (
                  <div className="rounded-lg bg-muted/40 p-4 space-y-3">
                    <div data-testid="autopay-disclosure" className="space-y-2">
                      <p className="text-sm text-foreground leading-relaxed">
                        {!AP_CYCLE_CONFIRMED ? apCopy.chargeInterim : (() => {
                          const startDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString(apCopy.dateLocale, { month: "long", day: "numeric", year: "numeric" });
                          return validation?.total != null
                            ? apCopy.chargeKnown(`$${Number(validation.total).toFixed(2)}`, startDate)
                            : apCopy.chargeUnknown(startDate);
                        })()}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {apCopy.cancelLead}
                        <a href="/faq" target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: brandColor }}>{apCopy.cancelLink}</a>
                        {apCopy.cancelTail}
                      </p>
                      {paymentMethod === "googlepay" && (
                        <p data-testid="autopay-gpay-note" className="text-sm text-foreground leading-relaxed">{apCopy.gpayNote}</p>
                      )}
                    </div>


                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={autoPayTerms} onChange={(e) => setAutoPayTerms(e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-input" style={{ accentColor: brandColor }} />
                      <span data-testid="autopay-consent" className="text-sm font-bold text-foreground">{AP_CYCLE_CONFIRMED ? apCopy.consentConfirmed : apCopy.consent}</span>
                    </label>

                    {/* ARB-1b: the terms box below is in Spanish on /es, so the English-only note is gone. */}
                    <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground leading-relaxed space-y-2">
                      {/* ARB-1b: the full Auto Pay terms in Spanish on /es (QA #6); QA #5's missing-letter amount wording is gone. Billing, Cancelling and Questions use the
                          Lead-approved CK-1ap wording; cancelling names the real self-serve form (Unsubscribe From Autopay on /faq). Fees unchanged. */}
                      {lang === "es" ? (
                        <>
                          <p className="font-semibold text-foreground">TÉRMINOS Y CONDICIONES GENERALES Y ESPECÍFICOS DE PAGO; AUTORIZACIÓN DE CARGOS RECURRENTES</p>
                          <p>Los siguientes términos y condiciones son específicos de los pagos de Recarga Automática y complementan (sin reemplazar) los Términos y Condiciones de CellPay (disponibles en nuestra página de Términos y Condiciones en /terms-and-conditions (en inglés)), que usted acepta al usar CellPay. Su acceso o uso continuo del servicio de Recarga Automática después de recibir y revisar estos términos constituye su consentimiento a los términos aquí contenidos y su consentimiento continuo a los términos del Acuerdo de Servicio. Usted también sigue sujeto a los términos de la Política de Privacidad de CellPay, disponible en nuestra página de Política de Privacidad en /es/privacy-policy, que detalla las condiciones y circunstancias en las que, en el curso normal de sus operaciones, CellPay puede proporcionar a terceros información sobre usted o su cuenta.</p>
                          <p>Los siguientes «Términos y Condiciones Generales» se aplican a todas las opciones de pago de Recarga Automática.</p>
                          <p className="font-semibold text-foreground">Términos y Condiciones Generales (aplicables a TODOS los suscriptores de Recarga Automática)</p>
                          <p className="font-semibold text-foreground">Información general de pago</p>
                          <p>Para usar los pagos automáticos, debe tener registrada en CellPay en todo momento una tarjeta de crédito válida de una de las principales marcas, una tarjeta de débito o un cheque electrónico (un «Método de Pago Registrado»). Solo se puede registrar una (1) tarjeta o cuenta por cada número de teléfono inalámbrico prepagado. Si un cheque electrónico es devuelto por cualquier motivo, se le cobrará un cargo de $50 por cheque. Puede haber cargos adicionales por devolución hasta el máximo permitido por la ley. Si necesita cambiar o actualizar su información de pago, escriba al soporte de CellPay a support@getcellpay.com.</p>
                          <p className="font-semibold text-foreground">Facturación</p>
                          <p>Se le cobrarán automáticamente los pagos recurrentes de su opción de pago de Recarga Automática, según los Términos y Condiciones específicos de pago aplicables que aparecen abajo, hasta que usted cancele expresamente su inscripción en el servicio de Recarga Automática conforme a la sección «Cancelar la Recarga Automática». Estos cargos recurrentes a su cuenta no son reembolsables. El pago automático cobra el mismo monto en la fecha de renovación al mismo método de pago. Por ley, también tiene derecho a recibir un aviso antes de cualquier transferencia cuyo monto varíe respecto de la transferencia anterior.</p>
                          <p className="font-semibold text-foreground">Agregar fondos manualmente</p>
                          <p>Puede recargar su cuenta manualmente en cualquier momento haciendo un nuevo pedido en CellPay.</p>
                          <p className="font-semibold text-foreground">Cancelar la Recarga Automática</p>
                          <p>Cancele en cualquier momento con el formulario «Unsubscribe From Autopay» (Cancelar el pago automático) en nuestra página de Preguntas Frecuentes en /faq (en inglés), sin necesidad de iniciar sesión, o comunicándose con soporte. Para comunicarse con soporte, escriba a support@getcellpay.com. Nuestro equipo de soporte procesará su solicitud. La cancelación entra en vigor cuando procesemos su solicitud. El saldo de la cuenta no es reembolsable ni canjeable, y se pierde en la fecha de vencimiento. No recibirá reembolso ni crédito por los cargos aplicados a su cuenta antes de la cancelación. Usted entiende que, al cancelar su inscripción, terminará no solo la opción de pago seleccionada, sino todo su servicio de Recarga Automática. Para cambiar a una nueva opción de pago, deberá volver a inscribirse en el servicio de Recarga Automática.</p>
                          <p className="font-semibold text-foreground">Preguntas y errores</p>
                          <p>Si tiene preguntas sobre cualquier transferencia electrónica, o si cree que hay un error en un cargo de pago automático, escríbanos lo antes posible a support@getcellpay.com. Usted no es responsable de las transferencias electrónicas no autorizadas, ni de que CellPay no realice o no detenga correctamente ciertas transferencias según lo requerido; sin embargo, debemos recibir noticias suyas sobre el presunto problema o error a más tardar 5 días después de la fecha del cargo en el que aparece el problema o error. Su queja o pregunta debería incluir la siguiente información:</p>
                          <p>(1) Su nombre y número de cuenta;</p>
                          <p>(2) Una descripción del error o de la transferencia sobre la que tiene dudas, y una explicación clara de por qué cree que es un error o por qué necesita más información; y</p>
                          <p>(3) El monto en dólares del presunto error.</p>
                          <p>Si nos comunica su queja o pregunta por teléfono, podemos exigirle que nos envíe la información correspondiente por escrito dentro de 5 días hábiles.</p>
                          <p>Dentro de los 7 días hábiles posteriores a su llamada o a la recepción de su declaración escrita con la información descrita arriba, intentaremos determinar si ocurrió un error y, si es así, lo corregiremos sin demora. Sin embargo, podemos necesitar hasta 20 días hábiles para investigar el asunto (30 días hábiles para cuentas nuevas, transacciones en puntos de venta o transacciones en el extranjero). Si le pedimos que presente su queja o pregunta por escrito y no la recibimos dentro de 10 días hábiles, es posible que no acreditemos su cuenta. Le informaremos los resultados de nuestra investigación dentro de los 3 días hábiles posteriores a su conclusión. Si determinamos que hubo un error, acreditaremos sin demora a su cuenta el tiempo aire o el monto en dólares correspondiente.</p>
                          <p className="font-semibold text-foreground">Términos y Condiciones específicos de pago; Autorización de cargos recurrentes</p>
                          <p>Si seleccionó la opción de pago de Recarga Automática al inscribirse en la Recarga Automática, se le aplican los siguientes Términos y Condiciones específicos de pago y la Autorización de cargos recurrentes.</p>
                          <p className="font-semibold text-foreground">Frecuencia y monto de facturación; pago fallido; interrupción y cancelación de la cuenta</p>
                          <p>El pago automático se renueva cada mes en la fecha de su pago y cobra el mismo monto al mismo método de pago, hasta que usted cancele expresamente el servicio de Recarga Automática o hasta una interrupción del servicio, como se describe abajo. Si no tiene fondos suficientes en su cuenta para hacer su pago mensual, no se le hará el cargo y su servicio se interrumpirá. Deberá agregar manualmente fondos suficientes a su cuenta para restablecer su servicio y, una vez restablecido, la fecha de aniversario de su pago mensual se basará en la fecha de restablecimiento. Si no hace un pago mensual completo dentro de los 30 días posteriores a cualquier interrupción de la cuenta, perderá todos los fondos no utilizados, su cuenta se cancelará y perderá su número de teléfono.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-foreground">GENERAL AND PAYMENT-SPECIFIC TERMS &amp; CONDITIONS; RECURRING CHARGE AUTHORIZATION</p>
                          <p>The following terms and conditions are specific to Auto Recharge payments and are supplemental to (and do not supersede) the CellPay Terms &amp; Conditions (available on our Terms &amp; Conditions page at /terms-and-conditions), which you accept when you use CellPay. Your continued access to or use of the Auto Recharge service after the receipt and review hereof constitutes your consent to the terms contained herein and your continued consent to the terms contained in the Service Agreement. You also continue to be bound by the terms of the CellPay Privacy Policy, available on our Privacy Policy page at /privacy-policy, which details the conditions and circumstances under which, in the ordinary course of business, CellPay may provide information concerning you or your account to third parties.</p>
                          <p>The following ''General Terms &amp; Conditions'' apply to all Auto Recharge Payment Options.</p>
                          <p className="font-semibold text-foreground">General Terms and Conditions (Applicable to ALL Auto Recharge Subscribers)</p>
                          <p className="font-semibold text-foreground">General Payment Information</p>
                          <p>A valid major credit card, debit card or electronic check (a ''Registered Payment Method'') must be registered and on file with CellPay at all times to take advantage of automatic payments. Only one (1) card or account may be registered for any prepaid wireless telephone number. If an electronic check is returned for any reason, you will be charged a fee of $50 per check. There may be additional return fees up to the maximum allowed by law. If you need to change or update your payment information, please email CellPay support at support@getcellpay.com.</p>
                          {/* TODO(phone): add CellPay support phone here once supplied by Saurabh/Parvez. Do not invent. */}
                          <p className="font-semibold text-foreground">Billing</p>
                          <p>You will be automatically billed for the recurring payments corresponding to your Auto Recharge Payment Option as set forth under the applicable Payment-Specific Terms &amp; Conditions below until you affirmatively un-enroll from the Auto Recharge service in accordance with the section below entitled ''Cancelling Auto Recharge''. These recurring charges to your account are non-refundable. Auto Pay charges the same amount on the renewal date to the same payment method. By law, you also have the right to receive notice prior to any transfer that varies in amount from the previous transfer.</p>
                          <p className="font-semibold text-foreground">Adding Funds Manually</p>
                          <p>You can manually recharge your account at any time by placing a new order on CellPay.</p>
                          <p className="font-semibold text-foreground">Cancelling Auto Recharge</p>
                          <p>Cancel anytime with the Unsubscribe From Autopay form on our FAQ page at /faq (no login needed) or by contacting support. To contact support, email support@getcellpay.com. Our support team will process your request. Cancellation takes effect when we process your request. Account balance is not refundable or exchangeable, and is forfeited at expiration date. You will not receive a refund or credit for any fees charged against your account prior to cancellation. You understand that by un-enrolling you will be terminating not only your selected Payment Option, but also your Auto Recharge service entirely. Switching to a new Payment Option will require you to re-enroll in the Auto Recharge service.</p>
                          {/* TODO(phone): add CellPay support phone once supplied by Saurabh/Parvez. Do not invent. Legal must confirm the cancel method. */}
                          <p className="font-semibold text-foreground">Questions and Errors</p>
                          <p>If you have questions about any electronic transfer, or if you believe there is an error regarding an Auto Pay charge, please email us as soon as possible at support@getcellpay.com. You are not liable for unauthorized electronic transfers, or for CellPay's failure to properly make or stop certain transfers as required; however, we must hear from you regarding the suspected problem or error no later than 5 days after the date of the charge on which the problem or error appears. Your complaint or question should include the following information:</p>
                          {/* TODO(phone): Questions and Errors section, add CellPay support phone once supplied by Saurabh/Parvez (likely legally needed for electronic-transfer error notices; Legal to confirm). Do not invent. */}
                          <p>(1) Your name and account number;</p>
                          <p>(2) A description of the error or the transfer you are unsure about, and a clear explanation of why you believe it is an error or why you need more information; and</p>
                          <p>(3) The dollar amount of the suspected error.</p>
                          <p>If you tell us of your complaint or question over the phone, we may require that you follow up by sending us the relevant information in writing within 5 business days.</p>
                          <p>Within 7 business days after your call or our receipt of your written statement containing the information described above, we will attempt to determine whether an error has occurred and if it has, we will promptly correct the error. However, we may require up to 20 business days to investigate the matter (30 business days for new accounts or point-of-sale or foreign transactions). If we ask you to put your complaint or question in writing and we do not receive it within 10 business days, we may not credit your account. We will inform you of the results of our investigation within 3 business days after completion. If we determine there was an error, we will promptly credit the appropriate airtime or dollar amount to your account.</p>
                          <p className="font-semibold text-foreground">Payment-Specific Terms and Conditions; Recurring Charge Authorization</p>
                          <p>If you selected the Auto Recharge Payment Option when you enrolled in Auto Recharge, the following Payment-Specific Terms and Conditions and Recurring Charge Authorization apply to you.</p>
                          <p className="font-semibold text-foreground">Billing Frequency and Amount; Payment Failure; Account Interruption and Cancellation</p>
                          <p>Auto Pay renews monthly on your payment date and charges the same amount to the same payment method, until you affirmatively cancel the Auto Recharge service or until service interruption, as described below. If you do not have sufficient funds in your account to make your monthly payment, your account will not be charged and your service will be interrupted. You will be required to manually add enough funds to your account to have your service restored, and upon restoration, your monthly payment anniversary date will then be based upon your date of restoration. If you don't make a full monthly payment within 30 days of any account interruption, you will lose all unused funds, your account will be canceled and you will lose your phone number.</p>
                        </>
                      )}
                    </div>

                  </div>
                )}
              </>
            )}

            {paymentMethod !== "paypal" && (
              <button
                ref={inlinePayRef}
                type="button"
                disabled={!canSubmit}
                onClick={handlePlaceOrder}
                className="w-full h-[56px] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {submitting ? tr.processing : tr.placeOrder}
              </button>
            )}

            {autoPayMethodOk && autoPay && !autoPayTerms && (
              <p data-testid="autopay-place-hint" role="status" aria-live="polite" className="text-sm font-semibold text-center" style={{ color: brandColor }}>
                {apCopy.placeHint}
              </p>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {tr.securePoweredBy}
            </p>

          </div>
        </div>
      )}



      {/* #6 fold: phone Pay bar (see payBarShown). Same canSubmit / handlePlaceOrder as PLACE ORDER NOW below; the total is display
          only. Not ready yet (terms, card details): the tap scrolls to the terms + PLACE ORDER card instead. Help docks in the slot. */}
      {payBarShown && (
        <div ref={payBarRef} data-help-dock-slot="" data-testid="checkout-pay-bar" className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pl-3 pr-[72px] py-2 flex items-center gap-2"
             style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}>
          <div className="shrink-0 text-left leading-tight">
            <p className="text-[10px] text-muted-foreground">{tr.total}</p>
            <p data-testid="checkout-bar-total" className="text-base font-extrabold" style={{ color: brandColor }}>${Number(total).toFixed(2)}</p>
          </div>
          <button
            type="button"
            data-testid="checkout-bar-pay"
            aria-disabled={!canSubmit}
            onClick={() => {
              if (submitting) return;
              if (canSubmit) { handlePlaceOrder(); return; }
              const card = inlinePayRef.current?.parentElement;
              if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
            }}
            className={`flex-1 min-w-0 h-[46px] rounded-lg px-2 hover:opacity-90 text-primary-foreground font-bold text-[clamp(11px,3.5vw,13px)] whitespace-nowrap leading-tight transition-all active:scale-[0.97] inline-flex items-center justify-center gap-2 ${canSubmit ? "" : "opacity-60"}`}
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {submitting ? tr.processing : tr.placeOrder}
          </button>
        </div>
      )}

      {/* DUPCHARGE-1008: same phone + same amount paid in the last 10 min -> confirm before charging again ("No" is the default) */}
      {dupAsk && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" data-testid="dup-confirm">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center shadow-xl" role="alertdialog" aria-modal="true">
            <h3 className="text-xl font-bold text-foreground mb-2">{lang === "es" ? "¿Cobrar de nuevo?" : "Charge again?"}</h3>
            <p className="text-sm text-foreground mb-2" data-testid="dup-confirm-text">{lang === "es" ? `Acaba de pagar $${dupAsk.amount} para este número. ¿Cobrar de nuevo?` : `You just paid $${dupAsk.amount} for this number, charge again?`}</p>
            <p className="text-sm text-muted-foreground mb-4">{lang === "es" ? "No se le cobró esta vez." : "You were not charged this time."}</p>
            <div className="flex flex-col gap-2">
              <button type="button" data-testid="dup-confirm-no" onClick={() => { setDupAsk(null); setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); }}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm text-primary-foreground" style={{ backgroundColor: brandColor }}>
                {lang === "es" ? "No, no cobrar de nuevo" : "No, don't charge again"}
              </button>
              <button type="button" data-testid="dup-confirm-yes" onClick={() => { setDupAsk(null); setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); dupConfirmRef.current = true; void handlePlaceOrder(); }}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm border-2 border-border text-foreground bg-background">
                {lang === "es" ? "Sí, cobrar de nuevo" : "Yes, charge again"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPCHARGE-FOLLOWUPS-1008: the first charge for this order is still being processed (< 2 min) -> calm notice, not an error */}
      {inFlightNote && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" data-testid="in-flight-note">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center shadow-xl" role="alertdialog" aria-modal="true">
            <h3 className="text-xl font-bold text-foreground mb-2">{lang === "es" ? "Pago en proceso" : "Payment processing"}</h3>
            <p className="text-sm text-foreground mb-4" data-testid="in-flight-text">{lang === "es" ? "Su pago todavía se está procesando. Espere un momento; no se le cobró de nuevo." : "Your payment is still processing. Please wait a moment — you were not charged again."}</p>
            <button type="button" data-testid="in-flight-ok" onClick={() => { setInFlightNote(false); setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); }}
              className="w-full px-4 py-2.5 rounded-lg font-bold text-sm text-primary-foreground" style={{ backgroundColor: brandColor }}>
              {lang === "es" ? "Entendido" : "OK"}
            </button>
          </div>
        </div>
      )}

      {/* [PAYPAL-1008] PayPal paid but CellPay sent no receipt id: confirm the payment, never the empty receipt. */}
      {ppPaidNoId && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" data-testid="paypal-paid-noid">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-600" />
            <h3 className="text-xl font-bold text-foreground mb-2">{lang === "es" ? "Pago recibido" : "Payment received"}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {lang === "es"
                ? "PayPal confirmó su pago. Su recarga se está procesando y recibirá su recibo por correo electrónico. No pague de nuevo."
                : "PayPal confirmed your payment. Your refill is being processed and your receipt will be emailed to you. Please don't pay again."}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "es"
                ? <>Si su recarga no llega en 15 minutos, escriba a support@getcellpay.com con la orden de PayPal <span className="font-mono">{ppPaidNoId}</span>.</>
                : <>If your refill hasn't arrived in 15 minutes, email support@getcellpay.com with PayPal order <span className="font-mono">{ppPaidNoId}</span>.</>}
            </p>
            <button type="button" onClick={() => navigate(lang === "es" ? "/es" : "/")}
              className="px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              {lang === "es" ? "Listo" : "Done"}
            </button>
          </div>
        </div>
      )}

      {ppReceivedId && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" data-testid="paypal-received">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
            <h3 className="text-xl font-bold text-foreground mb-2">{lang === "es" ? "Estamos revisando su pago" : "We're checking your payment"}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {lang === "es"
                ? "Es posible que su pago de PayPal se haya realizado, pero no pudimos confirmar su recarga. Por favor no pague de nuevo."
                : "Your PayPal payment may have gone through, but we couldn't confirm your refill. Please don't pay again."}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "es"
                ? <>Lo revisaremos y completaremos su recarga o le devolveremos el dinero. Si no sabe de nosotros en 30 minutos, escriba a support@getcellpay.com con la orden de PayPal <span className="font-mono">{ppReceivedId}</span>.</>
                : <>We'll check it and either complete your refill or refund you. If you don't hear from us within 30 minutes, email support@getcellpay.com with PayPal order <span className="font-mono">{ppReceivedId}</span>.</>}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "es"
                ? "Si después quiere intentarlo de nuevo, tendrá que aprobar un pago nuevo en PayPal."
                : "If you want to try again later, you'll need to approve a new PayPal payment."}
            </p>
            <button type="button" onClick={() => navigate(lang === "es" ? "/es" : "/")}
              className="px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              {lang === "es" ? "Listo" : "Done"}
            </button>
          </div>
        </div>
      )}

      {/* Error dialog */}
      {errorMsg && !refundCard && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => { setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); }}>
          {/* DECLINE-DIALOG-1008: scrolls inside itself on short phones (iPhone SE + Safari bars clipped the top); on a card decline
              the raw processor message is hidden (the recovery hint below explains it); other errors still show errorMsg. */}
          <div className="bg-card rounded-2xl p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto overscroll-contain text-center shadow-xl" style={{ maxHeight: "calc(100dvh - 2rem)" }} onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-2">❌</div>
            <h3 className="text-xl font-bold text-foreground mb-2">{tr.paymentFailed}</h3>
            {!declineInfo && <p className="text-sm text-muted-foreground mb-2">{errorMsg}</p>}
            {showNotChargedNote && (
              <p className="text-sm text-muted-foreground mb-4" data-testid="cx-hold-not-charged">{tr.notChargedNote}</p>
            )}
            {!showNotChargedNote && <div className="mb-4" />}
            {declineInfo ? (() => {
              // GROWTH-1007-A/W: recovery options, order per Fraud & QA (13:34 CT): Apple Pay (when available), Cash App, card retry,
              // Google Pay, Pay by Bank. A method shows only when its tab is offered on this checkout (the same list the customer sees);
              // Pay by Bank also needs the kill-switch read to say on. Each button only closes the dialog and/or switches the method tab.
              // Nothing is submitted until the customer taps PLACE ORDER again. Non-card methods stay after the card cap and on blocked.
              const dc = DECLINE_COPY[lang === "es" ? "es" : "en"];
              const capped = declineInfo.n > MAX_CARD_RETRIES || declineInfo.cls === "blocked";
              const close = () => { setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); };
              // DECLINE-DIALOG-1008: after the switch, bring PLACE ORDER NOW into view and outline it for 1.5 s so the customer sees
              // where to tap next. Only scrolls; it never submits and never opens a wallet sheet by itself.
              const toMethod = (m: PaymentMethod) => {
                close(); setPaymentMethod(m);
                window.setTimeout(() => {
                  const el = inlinePayRef.current;
                  if (!el) return;
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-4", "ring-offset-2");
                  window.setTimeout(() => el.classList.remove("ring-4", "ring-offset-2"), 1500);
                }, 120);
              };
              const offered = new Set<PaymentMethod>(paymentMethods.map((pm) => pm.key));
              const btn = "w-full px-4 py-2.5 rounded-lg font-bold text-sm";
              return (
                <div className="space-y-2 text-left" data-testid="decline-recovery" data-class={declineInfo.cls}>
                  <p className="text-sm text-foreground mb-2" data-testid="decline-hint">{capped && declineInfo.cls !== "blocked" ? dc.capReached : dc[declineInfo.cls]}</p>
                  {/* DECLINE-DIALOG-1008: wallets first and filled (Apple Pay, Google Pay), then Cash App; card retry is an outline. */}
                  {applePayAvailable && offered.has("applepay") && (
                    <button type="button" data-testid="decline-applepay" onClick={() => toMethod("applepay")} className={btn + " bg-black text-white"}>{dc.useApplePay}</button>
                  )}
                  {offered.has("googlepay") && (
                    <button type="button" data-testid="decline-googlepay" onClick={() => toMethod("googlepay")} className={btn + " bg-black text-white"}>{dc.useGooglePay}</button>
                  )}
                  {offered.has("cashapp") && (
                    <button type="button" data-testid="decline-cashapp" onClick={() => toMethod("cashapp")} className={btn + " text-black"} style={{ backgroundColor: "#00D632" }}>{dc.useCashApp}</button>
                  )}
                  {!capped && (
                    <button type="button" data-testid="decline-retry-card"
                      onClick={() => { close(); setTimeout(() => { const el = cardFormRef.current?.querySelector<HTMLInputElement>("input"); cardFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus(); }, 50); }}
                      className={btn + " border-2 border-border text-foreground bg-background"}>
                      {declineInfo.cls === "details" ? dc.checkDetails : dc.retryCard}
                    </button>
                  )}
                  {offered.has("plaid") && plaidOn === true && (
                    <button type="button" data-testid="decline-paybybank" onClick={() => toMethod("plaid")} className={btn + " border-2 border-border text-foreground bg-background"}>{dc.usePayByBank}</button>
                  )}
                  <button type="button" data-testid="decline-other" onClick={close} className="w-full text-xs underline text-muted-foreground pt-1">{dc.otherMethod}</button>
                  {declineInfo.n >= 2 && <p className="text-xs text-muted-foreground text-center pt-1">{dc.help}</p>}
                </div>
              );
            })() : (
            <button type="button" onClick={() => { setErrorMsg(null); setShowNotChargedNote(false); }}
              className="px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              {tr.tryAgain}
            </button>
            )}
          </div>
        </div>
      )}
      {/* TOP4-T2B-1009: refund card after a provider auto-refund (replaces the raw provider sentence). Message and navigation only:
          no "not charged" note, no decline dialog, no automatic retry; nothing is charged until the customer taps Pay again. */}
      {errorMsg && refundCard && (() => {
        const es = lang === "es";
        const carrier = top4Name(state.carrierSlug, es ? "es" : "en") || displayCarrierName(state.carrierName, es ? "es" : "en");
        const last4 = String(state.phone || "").replace(/\D/g, "").slice(-4);
        const close = () => { setErrorMsg(null); setShowNotChargedNote(false); setDeclineInfo(null); setRefundCard(false); };
        const toCarrier = (ph: string) => { close(); navigate(carrierPageTarget(lang, state.carrierSlug, ph, undefined, location.search, location.hash)); };
        const openHelp = () => {
          close();
          window.setTimeout(() => {
            const b = document.querySelector<HTMLElement>('[data-testid="help-launcher"]');
            if (b) b.click(); else window.location.href = "mailto:support@getcellpay.com";
          }, 50);
        };
        const btn = "w-full px-4 py-2.5 rounded-lg font-bold text-sm";
        return (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={close}>
            <div className="bg-card rounded-2xl p-5 max-w-sm w-full overflow-y-auto overscroll-contain text-center shadow-xl" style={{ maxHeight: "calc(100dvh - 2rem)" }} onClick={(e) => e.stopPropagation()} data-testid="refund-card">
              <h3 className="text-xl font-bold text-foreground mb-2">{es ? "Le devolvimos su pago" : "Your payment was refunded"}</h3>
              <p className="text-sm text-muted-foreground mb-4" data-testid="refund-card-text">
                {es
                  ? `No pudimos agregar esta recarga al número •••${last4} de ${carrier}, por eso su pago se devolvió automáticamente. Revise que sea una línea activa de ${carrier} y que eligió la compañía correcta.`
                  : `We couldn't add this refill to ${carrier} number •••${last4}, so your payment was refunded automatically. Please check that this is an active ${carrier} line and that you picked the right carrier.`}
              </p>
              <div className="space-y-2">
                <button type="button" data-testid="refund-try-again" onClick={() => toCarrier(state.phone)} className={btn + " text-primary-foreground"} style={{ backgroundColor: brandColor }}>{es ? "Intentar de nuevo" : "Try again"}</button>
                <button type="button" data-testid="refund-change-number" onClick={() => toCarrier("")} className={btn + " border-2 border-border text-foreground bg-background"}>{es ? "Cambiar número" : "Change number"}</button>
                <button type="button" data-testid="refund-help" onClick={openHelp} className="w-full text-sm underline text-muted-foreground pt-1">{es ? "Ayuda" : "Help"}</button>
              </div>
            </div>
          </div>
        );
      })()}
      {showSaveInfoTip && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSaveInfoTip(false)}>
          <div className="bg-foreground text-background rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm leading-relaxed text-center">
              {lang === "es"
                ? "Ha optado por guardar la información de su tarjeta para un pago futuro más rápido. Asegúrese de crear una contraseña después de completar su compra para pagar con la información guardada la próxima vez."
                : "You have opted to save your cc info on file for a faster future payment. Be sure to create an password after you have completed your purchase to pay with the saved bank card info next time. And you have opted to send text to pay message."}
            </p>
            <div className="flex justify-center mt-4">
              <button type="button" onClick={() => setShowSaveInfoTip(false)}
                className="px-6 py-2 rounded-lg bg-background text-foreground font-bold text-sm">
                {lang === "es" ? "Entendido" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
      <PaymentBar lang={lang} />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Checkout;
