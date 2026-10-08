import { useState, useCallback, useEffect } from "react";
import { Phone, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PaymentBar } from "@/components/PaymentBar";
// PAYCOPY-1008: shared payment list (follows src/config/paymentFlags.ts)
import { payBrandsComma, payWith, CARD_BRANDS, PAYPAL_SHOWN } from "@/content/paymentMethods";
import { PlanGrid } from "@/components/PlanGrid";
import { fetchCarrierView, verifyPhone, type CarrierViewData } from "@/services/apiWrapper";
import { applySeoHead } from "@/lib/seo";
import { takeCheckoutPrefill } from "@/lib/checkoutResume";
import { t, type Language } from "@/lib/i18n";
import cellpayLogo from "@/assets/cellpay-logo.svg";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * GO-1 / GO-1b / GO-2 dedicated paid-ad lander (refill.cellpay.us/go/* and /es/go/*).
 * noindex, ads only. No carrier nav. Legal footer only.
 * Same 3-step checkout hand-off as DynamicCarrier (number → amount → pay).
 * Auto Pay: optional unchecked checkbox + benefit line; never required, never pre-checked.
 * GO-2: guest/phone FAQs first; tighter above-fold phone+amount/plan; ES chrome.
 */

const formatPhone = (value: string): string => {
  let raw = value.replace(/\D/g, "");
  if (raw.length === 11 && raw.startsWith("1")) raw = raw.slice(1);
  if (raw.length >= 10 && raw.startsWith("1")) raw = raw.slice(1);
  const digits = raw.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

interface NormalizedPlan {
  plan_id: string;
  price: string;
  highlight: string;
  amount: number;
  name: string;
  carrierId?: number;
}

const sanitizeText = (s: string): string =>
  s.replace(/[\uFFFD\u0000-\u001F\u007F-\u009F]/g, "").replace(/\s+/g, " ").trim();

const normalizeHighlight = (raw: string, amount: number): string => {
  const cleaned = sanitizeText(raw);
  if (!cleaned) return amount > 0 ? `$${amount} Refill` : "Prepaid Refill";
  if (/^topup/i.test(cleaned)) return amount > 0 ? `$${amount} Refill` : cleaned;
  return cleaned;
};

function normalizePlans(plans: Array<Record<string, unknown>>): NormalizedPlan[] {
  return plans.map((p) => {
    const id = String(p.plan_id || p.planId || p.id || p.ID || "");
    const amt = Number(p.amount || p.price || p.Amount || 0);
    const rawName = String(p.name || p.Name || p.description || "");
    const carrier = p.carrier;
    const carrierIdNum =
      typeof carrier === "number"
        ? carrier
        : typeof carrier === "string" && carrier !== ""
        ? Number(carrier)
        : undefined;
    const cleanName = normalizeHighlight(rawName, amt);
    return {
      plan_id: id,
      price: `$${amt}`,
      highlight: cleanName,
      amount: amt,
      name: cleanName,
      carrierId: Number.isFinite(carrierIdNum) ? (carrierIdNum as number) : undefined,
    };
  });
}

const sanitizeAmountInput = (raw: string): string => {
  let s = (raw || "").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  s = s.replace(/^0+(?=\d)/, "");
  if (s.startsWith(".")) s = "0" + s;
  const [intPart, dec] = s.split(".");
  return intPart.slice(0, 6) + (dec !== undefined ? "." + dec : "");
};

const parsePastedAmount = (text: string): string => {
  const m = (text || "").replace(/[$\s]/g, "").match(/\d[\d,]*(?:\.\d*)?|\.\d+/);
  return m ? sanitizeAmountInput(m[0].replace(/,/g, "")) : "";
};

const parseAmountDollars = (s: string): number => {
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

const normalizeAmountOnBlur = (s: string): string => {
  const n = parseAmountDollars(s);
  if (!Number.isFinite(n)) return "";
  return s.includes(".") ? n.toFixed(2) : String(n);
};

const AMOUNT_STEP_CENTS = 100;

const getAmountProblem = (
  text: string,
  n: number,
  min: number,
  max: number,
): "empty" | "range" | "step" | null => {
  if (!text || !Number.isFinite(n)) return "empty";
  if (n < min || n > max) return "range";
  if (Math.round(n * 100) % AMOUNT_STEP_CENTS !== 0) return "step";
  return null;
};

const formatDollars = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const wholeDollarMessage = (lang: string, n: number): string =>
  lang === "es"
    ? `Ingrese un monto en dólares enteros (por ejemplo $${Math.floor(n)} o $${Math.ceil(n)}).`
    : `Please enter a whole-dollar amount (for example $${Math.floor(n)} or $${Math.ceil(n)}).`;

/** PAY-1 canonical list (card brands + wallets checkout really accepts). PAYCOPY-1008: from the shared list. */
const PAY_METHODS = payBrandsComma();

/**
 * GO-COPY-1008: wallet marks under the fee line (Cash App, PayPal, Apple Pay, Google Pay, Klarna = live checkout tabs).
 * Small inline SVGs, fixed 16px height. Keep byte-identical with GO_PAY_MARKS in vite.config.ts (goFirstScreen) so nothing moves.
 */
const GO_PAY_MARKS =
  '<svg width="16" height="16" viewBox="0 0 20 20" role="img" aria-label="Cash App"><rect width="20" height="20" rx="4" fill="#00D632"/><text x="10" y="14.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="13" fill="#fff">$</text></svg>' +
  (PAYPAL_SHOWN ? '<svg width="46" height="16" viewBox="0 0 46 16" role="img" aria-label="PayPal"><text x="0" y="12.5" font-family="Arial,sans-serif" font-weight="900" font-size="13" font-style="italic" fill="#003087">Pay</text><text x="23" y="12.5" font-family="Arial,sans-serif" font-weight="900" font-size="13" font-style="italic" fill="#009cde">Pal</text></svg>' : "") + // PAYCOPY-1008: PayPal mark only while PayPal is offered
  '<svg width="38" height="16" viewBox="0 0 48 20" role="img" aria-label="Apple Pay"><rect width="48" height="20" rx="4" fill="#000"/><path d="M11.4 7.1c-.4.5-1 .9-1.6.8-.1-.6.2-1.3.6-1.7.4-.5 1.1-.8 1.6-.9.1.7-.2 1.3-.6 1.8zm.6.9c-.9-.1-1.6.5-2 .5s-1-.5-1.7-.5c-.9 0-1.7.5-2.1 1.3-.9 1.6-.2 4 .7 5.3.4.6.9 1.3 1.6 1.3.6 0 .9-.4 1.7-.4s1 .4 1.7.4c.7 0 1.2-.6 1.6-1.3.5-.7.7-1.4.7-1.5-.1 0-1.4-.5-1.4-2.1 0-1.3 1.1-1.9 1.1-2-.6-.9-1.5-1-1.9-1z" fill="#fff"/><text x="18" y="14" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="#fff">Pay</text></svg>' +
  '<svg width="32" height="16" viewBox="0 0 40 20" role="img" aria-label="Google Pay"><rect x=".5" y=".5" width="39" height="19" rx="4" fill="#fff" stroke="#dadce0"/><text x="5" y="14" font-family="Arial,sans-serif" font-weight="700" font-size="11" fill="#4285F4">G</text><text x="16" y="14" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="#5f6368">Pay</text></svg>' +
  '<svg width="45" height="16" viewBox="0 0 56 20" role="img" aria-label="Klarna"><rect width="56" height="20" rx="4" fill="#FFA8CD"/><text x="28" y="14" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="10" fill="#0A0A0A">Klarna.</text></svg>';

/** GO-COPY-1008: route descriptions say "Low service fee"; show "Service fee shown before you pay" (EN/ES). Same as goFeeCopy in vite.config.ts. */
const goFeeCopy = (s: string): string =>
  s
    .replace("Low service fee shown before you pay", "Service fee shown before you pay")
    .replace("Cargo por servicio bajo, mostrado antes de pagar", "Cargo por servicio mostrado antes de pagar");

/** ADS-FOLLOWUPS-1008: ad-style carrier names for the /go FAQs + FAQPage JSON-LD (same name as each lander's H1). Checkout keeps the catalog name. */
const GO_AD_NAMES: Record<string, string> = {
  boost: "Boost",
  metropcs: "Metro",
  s1: "Simple Mobile",
  "topup-crc": "Cricket",
  "topup-at": "AT&T Prepaid",
  "ultra-mobile": "Ultra Mobile",
  "straight-talk": "Straight Talk",
  lyca: "Lyca Mobile",
  h2o: "H2O Wireless",
  net10: "Net10",
  tmobile: "T-Mobile",
  verizon: "Verizon Prepaid",
  pageplus: "Page Plus",
  "total-wireless": "Total Wireless",
  tracfone: "Tracfone",
};

/** GO-COPY-1008: carrier-specific FAQs (also sent as FAQPage JSON-LD). True claims only: no refunds, no email-receipt claim, no fee amounts. */
const goFaqsEn = (c: string) => [
  {
    q: `Can I pay my ${c} bill without signing in?`,
    a: `Yes. No account or login needed. Enter the ${c} phone number, pick the amount or plan, and pay as a guest.`,
  },
  {
    q: `Can I pay for someone else's ${c} line?`,
    a: `Yes. Enter their ${c} phone number, choose the amount or plan, and pay. The refill goes to that line.`,
  },
  {
    q: `Do I just need the ${c} phone number?`,
    a: `Yes. Enter the 10-digit phone number of the ${c} line you want to refill. Then pick the amount or plan and pay.`,
  },
  {
    q: `Do I need to call ${c} to pay?`,
    a: "No. You pay online on this page with the phone number. No phone call needed.",
  },
  {
    q: "How can I pay?",
    a: payWith("en", `Card (${CARD_BRANDS})`) + ". Apple Pay shows on supported Apple devices. The service fee is shown before you pay.",
  },
  {
    q: `How long does a ${c} refill take?`,
    a: "Most refills finish in a few minutes. Some can take up to 30 minutes.",
  },
  {
    q: "What if the payment fails?",
    a: "If it fails, your card was NOT charged. If you see a pending amount, your bank removes it in 1–2 days. You can try another card or payment method.",
  },
  {
    q: "How do I get help?",
    a: "Support: Monday–Friday 9:00 AM–6:00 PM (EST) · Saturday–Sunday 10:00 AM–4:00 PM (EST) · support@getcellpay.com",
  },
];

/** Very simple Spanish. Never "cualquier". No refunds / 24/7 / instant / authorized. */
const goFaqsEs = (c: string) => [
  {
    q: `¿Puedo pagar mi factura de ${c} sin cuenta?`,
    a: `Sí. No necesita cuenta ni iniciar sesión. Escriba el número de teléfono de ${c}, elija el monto o plan y pague como invitado.`,
  },
  {
    q: `¿Puedo pagar la línea de ${c} de otra persona?`,
    a: `Sí. Escriba el número de ${c} de esa persona, elija el monto o plan y pague. La recarga llega a esa línea.`,
  },
  {
    q: `¿Solo necesito el número de teléfono de ${c}?`,
    a: `Sí. Escriba el número de 10 dígitos de la línea de ${c} que quiere recargar. Luego elija el monto o plan y pague.`,
  },
  {
    q: `¿Tengo que llamar a ${c} para pagar?`,
    a: "No. Pague en línea en esta página con el número de teléfono. No necesita llamar.",
  },
  {
    q: "¿Cómo puedo pagar?",
    a: payWith("es", `Con tarjeta (${CARD_BRANDS})`) + ". Apple Pay aparece en equipos Apple compatibles. El cargo por servicio se muestra antes de pagar.",
  },
  {
    q: `¿Cuánto tarda la recarga de ${c}?`,
    a: "La mayoría termina en unos minutos. Algunas pueden tardar hasta 30 minutos.",
  },
  {
    q: "¿Qué pasa si el pago falla?",
    a: "Si falla, su tarjeta NO fue cobrada. Si ve un cargo pendiente, su banco lo quita en 1–2 días. Puede probar otra tarjeta u otra forma de pago.",
  },
  {
    q: "¿Cómo pido ayuda?",
    a: "Soporte: lunes–viernes 9:00 AM–6:00 PM (EST) · sábado–domingo 10:00 AM–4:00 PM (EST) · support@getcellpay.com",
  },
];

export interface GoLanderProps {
  carrierName: string;
  carrierSlug: string;
  carrierId: number;
  brandColor: string;
  logo?: string;
  /** Keyword-matched H1, e.g. "Pay Your Boost Mobile Bill Online" */
  h1: string;
  title: string;
  description: string;
  lang?: Language;
}

const GoLander = ({
  carrierName: initialName,
  carrierSlug,
  carrierId: initialCarrierId,
  brandColor,
  logo,
  h1,
  title,
  description,
  lang = "en",
}: GoLanderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tr = t(lang);
  const { toast } = useToast();

  const [phone, setPhone] = useState(() => formatPhone(takeCheckoutPrefill(carrierSlug)));
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [amountTouched, setAmountTouched] = useState(false);
  // Optional Auto Pay interest on the lander — never pre-checked, never required to pay.
  // Real Auto Pay opt-in stays unchecked-by-default on Checkout.
  const [autoPayInterest, setAutoPayInterest] = useState(false);

  const [carrierName, setCarrierName] = useState(initialName);
  const [carrierId, setCarrierId] = useState(initialCarrierId);
  const [showRange, setShowRange] = useState(false);
  const [showFixedPlans, setShowFixedPlans] = useState(false);
  const [rangeMin, setRangeMin] = useState(5);
  const [rangeMax, setRangeMax] = useState(300);
  const [rangePlanId, setRangePlanId] = useState<string>("");
  const [rangeCarrierId, setRangeCarrierId] = useState<number | undefined>(undefined);
  const [plans, setPlans] = useState<NormalizedPlan[]>([]);

  // noindex + ads SEO (static shells also ship noindex)
  useEffect(() => {
    applySeoHead({ title, description: goFeeCopy(description), path: typeof window !== "undefined" ? window.location.pathname : "/" });
    let tag = document.querySelector('meta[name="robots"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "robots");
      document.head.appendChild(tag);
    }
    const prev = tag.getAttribute("content");
    tag.setAttribute("content", "noindex,follow");
    return () => {
      if (prev !== null) tag!.setAttribute("content", prev);
      else tag!.setAttribute("content", "index,follow");
    };
  }, [title, description]);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
    setInlineError(null);
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInlineError(null);
    setAmountTouched(false);
    setAmount(sanitizeAmountInput(e.target.value));
  }, []);

  const handleAmountPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setInlineError(null);
    setAmount(parsePastedAmount(e.clipboardData.getData("text")));
    setAmountTouched(true);
  }, []);

  const handleAmountBlur = useCallback(() => {
    setAmount((a) => normalizeAmountOnBlur(a));
    setAmountTouched(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data: CarrierViewData = await fetchCarrierView(carrierSlug);
        if (cancelled) return;

        if (data.carrier?.name) setCarrierName(data.carrier.name);
        if (data.carrier?.carrierId) setCarrierId(data.carrier.carrierId);

        const cp = data.carrier_plans;
        const rootFp = (data as Record<string, unknown>).fixed_plans;
        const nestedFp =
          cp && !Array.isArray(cp) ? (cp as Record<string, unknown>).fixed_plans : undefined;
        const fp = (rootFp ?? nestedFp) as
          | Array<Record<string, unknown>>
          | { rangePlan?: boolean | string; plans?: Array<Record<string, unknown>>; [k: string]: unknown }
          | undefined;

        const cpRange =
          cp &&
          !Array.isArray(cp) &&
          (cp.rangePlan === true || (typeof cp.rangePlan === "string" && cp.rangePlan !== ""));

        const fpRange =
          (Array.isArray(fp) && fp.length > 0) ||
          (fp &&
            !Array.isArray(fp) &&
            (fp.rangePlan === true || (typeof fp.rangePlan === "string" && fp.rangePlan !== "")));

        if (cpRange && cp && !Array.isArray(cp)) {
          setShowRange(true);
          setRangeMin(cp.carrier?.rangeMin ?? 5);
          setRangeMax(
            carrierSlug === "topup-at"
              ? Math.min(cp.carrier?.rangeMax ?? 300, 150)
              : cp.carrier?.rangeMax ?? 300,
          );
          if (typeof cp.rangePlan === "string" && cp.rangePlan !== "") {
            setRangePlanId(cp.rangePlan);
          } else if (cp.carrier?.rangePlan) {
            setRangePlanId(String(cp.carrier.rangePlan));
          }
          const rcRaw =
            (cp.carrier as Record<string, unknown> | undefined)?.id ??
            (cp.carrier as Record<string, unknown> | undefined)?.ID;
          const rcNum = typeof rcRaw === "number" ? rcRaw : rcRaw != null ? Number(rcRaw) : NaN;
          if (Number.isFinite(rcNum)) setRangeCarrierId(rcNum);
        } else {
          setShowRange(false);
        }

        if (fpRange && fp && !Array.isArray(fp) && Array.isArray(fp.plans) && fp.plans.length > 0) {
          setShowFixedPlans(true);
          setPlans(normalizePlans(fp.plans));
        } else if (Array.isArray(fp) && fp.length > 0) {
          setShowFixedPlans(true);
          setPlans(normalizePlans(fp as Array<Record<string, unknown>>));
        } else if (cp && !cpRange) {
          if (Array.isArray(cp)) {
            setShowFixedPlans(true);
            // Straight Talk API returns wireless + Broadband-* + addon-* together; ads lander shows wireless only.
            const raw = cp as Array<Record<string, unknown>>;
            const filtered =
              carrierSlug === "straight-talk"
                ? raw.filter((p) => {
                    const id = String(p.plan_id || p.planId || p.id || p.ID || "");
                    return !/^(broadband-|addon-)/i.test(id);
                  })
                : raw;
            setPlans(normalizePlans(filtered));
          } else if (Array.isArray(cp.plans) && cp.plans.length > 0) {
            setShowFixedPlans(true);
            setPlans(normalizePlans(cp.plans));
          }
        } else {
          setShowFixedPlans(false);
        }
      } catch (err) {
        console.warn("GoLander: failed to load carrier view for", carrierSlug, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [carrierSlug]);

  useEffect(() => {
    if (loading) return;
    const raw = searchParams.get("amount");
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    if (showRange) {
      setAmount(String(Math.min(Math.max(n, rangeMin), rangeMax)));
    } else if (showFixedPlans && plans.length > 0) {
      const match = plans.find((p) => p.amount === n);
      if (match) setAmount(String(match.amount));
    } else {
      setAmount(String(n));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = parseAmountDollars(amount) || 0;
  const amountProblem = getAmountProblem(amount, amountNum, rangeMin, rangeMax);
  const rangeAmountValid = amountProblem === null;
  const amountMessage =
    amountProblem === "range"
      ? tr.invalidAmount(rangeMin, rangeMax)
      : amountProblem === "step"
      ? wholeDollarMessage(lang, amountNum)
      : null;
  const showAmountMessage = !!amountMessage && (amountTouched || amountNum > rangeMax);

  const VERIZON_CARRIER_ID = 14;
  const isVerizonRange = (amt: number) =>
    carrierSlug === "verizon" && rangePlanId !== "" && amt >= rangeMin && amt <= rangeMax;

  const goCheckout = (planAmount: number, planId?: string, planName?: string, planCarrierId?: number) => {
    const vzRange = isVerizonRange(planAmount);
    navigate(lang === "es" ? "/es/checkout" : "/checkout", {
      state: {
        phone,
        amount: planAmount,
        carrierSlug,
        carrierId: vzRange
          ? VERIZON_CARRIER_ID
          : planCarrierId ?? rangeCarrierId ?? carrierId,
        carrierName,
        brandColor,
        planId: vzRange ? rangePlanId : planId || rangePlanId || undefined,
        planName,
        // Landers never force Auto Pay; checkout stays useState(false). Interest is not a pre-check.
      },
    });
  };

  const handlePlanPayNow = async (plan: { price: string; highlight: string }) => {
    if (phoneDigits.length !== 10) {
      toast({ title: tr.phoneRequired, description: tr.phoneRequired, variant: "destructive" });
      return;
    }
    setVerifying(true);
    const verify = await verifyPhone(carrierSlug, phoneDigits);
    setVerifying(false);
    if (!verify.success) {
      toast({
        title: tr.invalidPhone,
        description: verify.message || tr.invalidPhone,
        variant: "destructive",
      });
      return;
    }
    const planAmount = Number(plan.price.replace("$", ""));
    const vzRange = isVerizonRange(planAmount);
    const selectedPlan = vzRange ? undefined : plans.find((p) => p.amount === planAmount);
    goCheckout(
      planAmount,
      vzRange ? rangePlanId : selectedPlan?.plan_id,
      selectedPlan?.name,
      vzRange ? VERIZON_CARRIER_ID : selectedPlan?.carrierId,
    );
  };

  const handlePay = async () => {
    setInlineError(null);
    if (phoneDigits.length !== 10) {
      const msg = tr.phoneRequired;
      setInlineError(msg);
      toast({ title: msg, description: msg, variant: "destructive" });
      return;
    }
    if (!rangeAmountValid) {
      const msg = amountMessage || tr.invalidAmount(rangeMin, rangeMax);
      setAmountTouched(true);
      setInlineError(msg);
      toast({ title: msg, description: msg, variant: "destructive" });
      return;
    }
    setVerifying(true);
    const verify = await verifyPhone(carrierSlug, phoneDigits);
    setVerifying(false);
    if (!verify.success) {
      const msg = verify.message || tr.invalidPhone;
      setInlineError(msg);
      toast({ title: tr.invalidPhone, description: msg, variant: "destructive" });
      return;
    }
    const vzRange = isVerizonRange(amountNum);
    const selectedPlan = vzRange ? undefined : plans.find((p) => p.amount === amountNum);
    goCheckout(
      amountNum,
      selectedPlan?.plan_id || rangePlanId || undefined,
      selectedPlan?.name,
      vzRange ? VERIZON_CARRIER_ID : selectedPlan?.carrierId ?? rangeCarrierId,
    );
  };

  const bc = brandColor;
  const isEs = lang === "es";
  // GO-COPY-1008: trust line (no email-receipt claim: no project code sends a receipt). Boost: no phone call needed.
  const tagline = isEs ? "Sin cuenta. Pague por usted o por otra persona." : "No login. Pay for yourself or someone else.";
  const noCallLine =
    carrierSlug === "boost"
      ? isEs
        ? "Sin llamar. Pague Boost en línea en 3 pasos."
        : "No phone call needed. Pay Boost online in 3 steps."
      : null;
  // GO-COPY-1008: visible "En español" switch on English /go pages (every /go page has an /es/go twin).
  const esHref = !isEs && typeof window !== "undefined" ? `/es${window.location.pathname}` : null;
  const stepsLine = isEs ? "3 pasos: número → monto → pagar" : "3 steps: number → amount → pay";
  const autoPayLine = isEs
    ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar — nunca está marcado de antemano."
    : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout — it is never pre-checked.";
  const feeLine = isEs
    ? "Cargo por servicio mostrado antes de pagar"
    : "Service fee shown before you pay";
  const faqHeading = isEs ? "Preguntas frecuentes" : "Common questions";
  const faqName = GO_AD_NAMES[carrierSlug] ?? initialName; // ADS-FOLLOWUPS-1008: ad-style name in the FAQs only
  const faqs = isEs ? goFaqsEs(faqName) : goFaqsEn(faqName);
  // SPEED-WWW-1008: while the carrier view loads, Cricket (amount range, no plan grid) shows its loaded layout (same form, pay bar
  // and FAQ) with read-only fields and disabled pay buttons instead of a spinner. It matches the static first screen
  // (goCricketScreen in vite.config.ts), so nothing moves when the app mounts or when the data arrives. Display only: the real
  // range, validation and pay flow come from the API exactly as before (the loaded branch below is unchanged).
  const skeletonRange: [number, number] | null = carrierSlug === "topup-crc" ? [5, 250] : null;
  const privacyLabel = isEs ? "Política de Privacidad" : "Privacy Policy";
  const termsLabel = isEs ? "Términos y Condiciones" : "Terms and Conditions";
  const returnsLabel = isEs ? "Política de Devoluciones" : "Returns Policy";

  // GO-COPY-1008: FAQPage JSON-LD built from the same Q&As shown on the page (removed when the page unmounts).
  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: isEs ? "es" : "en",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-go-faq", "1");
    el.text = faqJsonLd;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [faqJsonLd]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      {/* Ads chrome: logo only — no carrier grid nav, no Domestic/Bill/International bar */}
      <header className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: bc }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-14 sm:h-16 items-center gap-3">
            <img src={cellpayLogo} alt="CellPay" width={110} height={28} className="h-7 sm:h-8 w-auto" />
            <span className="text-muted-foreground text-sm hidden sm:inline">·</span>
            {logo ? (
              <img
                src={logo}
                alt={`${carrierName} logo`}
                width={94}
                height={28}
                className="h-[28px] sm:h-[36px] w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-extrabold" style={{ color: bc }}>
                {carrierName}
              </span>
            )}
          </div>
        </div>
      </header>

      <section style={{ backgroundColor: bc }} className="text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-3 sm:py-4 text-center">
          <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold leading-snug">{h1}</h1>
          <p className="text-xs sm:text-sm opacity-90 mt-1">{tagline}</p>
          {noCallLine && <p className="text-xs sm:text-sm font-bold mt-1">{noCallLine}</p>}
          {esHref && (
            <p className="text-xs sm:text-sm mt-1">
              <a href={esHref} lang="es" hrefLang="es" className="font-semibold underline underline-offset-2">
                En español
              </a>
            </p>
          )}
        </div>
      </section>

      {/* SPEED-LANDER-LCP2: Autopay benefit always after H1 (matches goFirstScreen; checkbox stays unchecked). */}
      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-2 pb-2">
        <div className="bg-card rounded-xl border border-border px-3 py-3 sm:px-4 sm:py-3 text-left">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPayInterest}
              onChange={(e) => setAutoPayInterest(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
              style={{ accentColor: bc }}
            />
            <span className="text-[11px] sm:text-xs text-foreground leading-relaxed">
              {autoPayLine}
            </span>
          </label>
          <p className="mt-2 text-[11px] sm:text-xs font-semibold text-foreground text-center">
            {feeLine}
          </p>
          <div
            className="mt-2 flex flex-wrap items-center justify-center gap-1.5"
            dangerouslySetInnerHTML={{ __html: GO_PAY_MARKS }}
          />
          <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground leading-snug text-center">
            {PAY_METHODS}
          </p>
        </div>
      </div>

      {loading && skeletonRange ? (
        <>
          <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-3 pb-1 sm:pt-4" aria-busy="true">
            <div className="bg-card rounded-xl shadow-lg border border-border p-3 sm:p-5 text-center">
              <p className="text-[11px] sm:text-xs text-muted-foreground mb-3">{stepsLine}</p>
              <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                {tr.enterPhoneLabel(carrierName)}
              </label>
              <div className="relative mb-3">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  type="tel"
                  readOnly
                  tabIndex={-1}
                  value={phone}
                  placeholder={tr.phonePlaceholder}
                  aria-label={tr.enterPhoneLabel(carrierName)}
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                />
              </div>
              <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">{tr.selectAmount}</label>
              <div className="relative mb-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  readOnly
                  tabIndex={-1}
                  value=""
                  placeholder={tr.amountPlaceholder(skeletonRange[0], skeletonRange[1])}
                  aria-label={tr.selectAmount}
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">{tr.enterAmount}</p>
            </div>
          </div>
          <div className="max-w-[420px] mx-auto px-4 pb-24 sm:pb-8">
            <div className="hidden sm:flex justify-center">
              <button type="button" disabled className="h-[48px] px-14 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2" style={{ backgroundColor: bc }}>
                {tr.payNow}
              </button>
            </div>
          </div>
          <div
            data-help-dock-slot=""
            className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pl-3 pr-[72px] py-2 flex items-center gap-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
          >
            <div className="flex-1 text-left leading-tight">
              <p className="text-[10px] text-muted-foreground">{tr.total}</p>
              <p className="text-base font-extrabold text-foreground">$—</p>
            </div>
            <button type="button" disabled className="flex-[2] h-[46px] rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2" style={{ backgroundColor: bc }}>
              {tr.payNow}
            </button>
          </div>
          <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-4 text-left">{faqHeading}</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`go-faq-${i}`}>
                  <AccordionTrigger className="text-left font-bold text-foreground" style={{ color: bc }}>
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </>
      ) : loading ? (
        <div className="flex justify-center items-start py-16 flex-1 min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-3 pb-1 sm:pt-4">
            <div className="bg-card rounded-xl shadow-lg border border-border p-3 sm:p-5 text-center">
              <p className="text-[11px] sm:text-xs text-muted-foreground mb-3">
                {stepsLine}
              </p>
              <label
                htmlFor="go-phone-input"
                className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2"
              >
                {tr.enterPhoneLabel(carrierName)}
              </label>
              <div className="relative mb-3">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  id="go-phone-input"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={tr.phonePlaceholder}
                  aria-label={tr.enterPhoneLabel(carrierName)}
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                  style={{ "--tw-ring-color": bc } as React.CSSProperties}
                />
              </div>
              {phoneDigits.length === 10 && (
                <p className="text-[10px] sm:text-xs text-cellpay-green font-semibold mb-2 -mt-1">
                  ✓ {tr.refilling}: {phone}
                </p>
              )}
              {phoneDigits.length > 0 && phoneDigits.length < 10 && (
                <p className="text-[10px] sm:text-xs text-destructive mb-2 -mt-1">{tr.enterAll10}</p>
              )}

              {showRange && (
                <>
                  <label
                    htmlFor="go-amount-input"
                    className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2"
                  >
                    {tr.selectAmount}
                  </label>
                  <div className="relative mb-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <input
                      id="go-amount-input"
                      name="amount"
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={handleAmountChange}
                      onPaste={handleAmountPaste}
                      onBlur={handleAmountBlur}
                      placeholder={tr.amountPlaceholder(rangeMin, rangeMax)}
                      aria-label={tr.selectAmount}
                      aria-invalid={showAmountMessage}
                      aria-describedby={showAmountMessage ? "go-amount-error" : undefined}
                      className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                      style={{ "--tw-ring-color": bc } as React.CSSProperties}
                    />
                  </div>
                  {showAmountMessage && (
                    <p
                      id="go-amount-error"
                      role="alert"
                      className="text-[11px] sm:text-xs text-destructive font-semibold mt-1 mb-1"
                    >
                      {amountMessage}
                    </p>
                  )}
                  {rangeAmountValid && (
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={verifying}
                      className="mt-3 w-full h-10 sm:h-11 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm sm:text-base transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                      style={{ backgroundColor: bc }}
                    >
                      {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                      {verifying ? tr.verifying : tr.payNow}
                    </button>
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                    {showFixedPlans ? tr.orSelectPlanBelow : tr.enterAmount}
                  </p>
                </>
              )}

              {inlineError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] sm:text-xs text-destructive font-semibold text-left"
                >
                  {inlineError}
                </div>
              )}


            </div>
          </div>

          {showFixedPlans && plans.length > 0 && (
            <div className="pt-1 sm:pt-2">
              <PlanGrid
                plans={plans.map((p) => ({ price: p.price, highlight: p.highlight }))}
                brandColor={bc}
                onSelect={handlePlanPayNow}
                popularIndex={Math.min(plans.length - 1, Math.floor(plans.length / 2))}
              />
            </div>
          )}

          {showRange && (
            <div className="max-w-[420px] mx-auto px-4 pb-24 sm:pb-8">
              <div className="hidden sm:flex justify-center">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={verifying || !rangeAmountValid}
                  className="h-[48px] px-14 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: bc }}
                >
                  {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                  {verifying ? tr.verifying : tr.payNow}
                </button>
              </div>
            </div>
          )}

          {showRange && (
            <div
              data-help-dock-slot=""
              className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pl-3 pr-[72px] py-2 flex items-center gap-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
            >
              <div className="flex-1 text-left leading-tight">
                <p className="text-[10px] text-muted-foreground">{tr.total}</p>
                <p className="text-base font-extrabold text-foreground">
                  ${amountNum > 0 ? formatDollars(amountNum) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={handlePay}
                disabled={verifying || !rangeAmountValid}
                className="flex-[2] h-[46px] rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: bc }}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? tr.verifying : tr.payNow}
              </button>
            </div>
          )}

          {/* Below-fold: guest/phone FAQs first (plain EN or ES) */}
          <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-4 text-left">
              {faqHeading}
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`go-faq-${i}`}>
                  <AccordionTrigger
                    className="text-left font-bold text-foreground"
                    style={{ color: bc }}
                  >
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </>
      )}

      {/* GO-COPY-1008: "We Accept" shows every live checkout method (cards + PayPal + wallets). */}
      <PaymentBar lang={lang} wallets />

      {/* Legal links only — no company / account / other-carrier nav */}
      <footer className="bg-cellpay-dark text-gray-100 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm mb-6">
            <li>
              <a href={isEs ? "/es/privacy-policy" : "/privacy-policy"} className="hover:text-primary-foreground underline-offset-2 hover:underline">
                {privacyLabel}
              </a>
            </li>
            <li>
              <a href="/terms-and-conditions" className="hover:text-primary-foreground underline-offset-2 hover:underline">
                {termsLabel}
              </a>
            </li>
            <li>
              <a href="/returns-policy" className="hover:text-primary-foreground underline-offset-2 hover:underline">
                {returnsLabel}
              </a>
            </li>
          </ul>
          <p className="text-xs opacity-80">{tr.copyright}</p>
          <p className="text-[10px] leading-relaxed max-w-3xl mx-auto opacity-70 mt-3">
            {tr.trademarkDisclaimer(carrierName)}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default GoLander;
