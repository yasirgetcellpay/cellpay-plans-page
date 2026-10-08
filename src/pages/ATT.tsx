import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback, useEffect } from "react";
import { Phone, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import attLogo from "@/assets/att-prepaid-logo.webp";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { loadResolvedPlans, pickPlanForAmount, type ResolvedPlans } from "@/lib/resolvePlanId";
import { applySeoHead } from "@/lib/seo";
import { t, useLang } from "@/lib/i18n";

const plans = [
  { price: "$100", highlight: "Prepaid Refill" },
  { price: "$85", highlight: "Prepaid Refill" },
  { price: "$80", highlight: "Prepaid Refill" },
  { price: "$75", highlight: "Prepaid Refill" },
  { price: "$70", highlight: "Prepaid Refill" },
  { price: "$65", highlight: "Prepaid Refill" },
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$45", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const formatPhone = (value: string): string => {
  let raw = value.replace(/\D/g, ""); if (raw.length === 11 && raw.startsWith("1")) raw = raw.slice(1); if (raw.length >= 10 && raw.startsWith("1")) raw = raw.slice(1); const digits = raw.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

// ─── Amount input (CP-01b: same logic as CP-01 in DynamicCarrier.tsx) ───
// Keep digits and ONE decimal point (max 2 decimals). Never drop the "." or shift digits
// ("25.00" stays $25, never $250) and never cut digits off ("151" stays 151 and is then
// validated against the min/max).
const sanitizeAmountInput = (raw: string): string => {
  let s = (raw || "").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  s = s.replace(/^0+(?=\d)/, "");
  if (s.startsWith(".")) s = "0" + s;
  const [intPart, dec] = s.split(".");
  return intPart.slice(0, 6) + (dec !== undefined ? "." + dec : "");
};

// Paste: strip $, spaces and commas and take the first number ("$1,025.00" → "1025.00").
const parsePastedAmount = (text: string): string => {
  const m = (text || "").replace(/[$\s]/g, "").match(/\d[\d,]*(?:\.\d*)?|\.\d+/);
  return m ? sanitizeAmountInput(m[0].replace(/,/g, "")) : "";
};

// Field text → dollars (rounded to cents). NaN when empty.
const parseAmountDollars = (s: string): number => {
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

// On blur: "12.5" → "12.50", "25." → "25.00", "25" stays "25".
const normalizeAmountOnBlur = (s: string): string => {
  const n = parseAmountDollars(s);
  if (!Number.isFinite(n)) return "";
  return s.includes(".") ? n.toFixed(2) : String(n);
};

// Amount step is $1 (cents must be .00), same as CP-01.
const AMOUNT_STEP_CENTS = 100;

const getAmountProblem = (text: string, n: number, min: number, max: number): "empty" | "range" | "step" | null => {
  if (!text || !Number.isFinite(n)) return "empty";
  if (n < min || n > max) return "range";
  if (Math.round(n * 100) % AMOUNT_STEP_CENTS !== 0) return "step";
  return null;
};

const wholeDollarMessage = (lang: string, n: number): string =>
  lang === "es"
    ? `Ingrese un monto en dólares enteros (por ejemplo $${Math.floor(n)} o $${Math.ceil(n)}).`
    : `Please enter a whole-dollar amount (for example $${Math.floor(n)} or $${Math.ceil(n)}).`;

const BRAND = "hsl(196,100%,44%)";

const ATT = () => {
  useEffect(() => {
    const isEs = typeof window !== "undefined" && window.location.pathname.startsWith("/es");
    applySeoHead(isEs
      ? { title: 'Recarga AT&T Prepago en Línea | CellPay', description: 'Recarga tu teléfono AT&T Prepaid en línea con CellPay. Recarga en línea segura desde $5 hasta $150, enviada directamente a tu número.' }
      : { title: 'AT&T Prepaid Refill Online | CellPay', description: 'Refill your AT&T Prepaid phone online with CellPay. Secure online top-up from $5 to $150, sent directly to your number.' });
  }, []);
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  // Amount field has been left (blur) or pasted into — show below-min / step messages only then.
  const [amountTouched, setAmountTouched] = useState(false);
  const lang = useLang();
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [resolved, setResolved] = useState<ResolvedPlans>({ fixedPlans: [] });

  useEffect(() => {
    loadResolvedPlans("topup-at").then(setResolved).catch((e) => console.warn("ATT plan load failed", e));
  }, []);

  const goCheckout = (amt: number | string) => {
    const amountNum = typeof amt === "number" ? amt : Number(amt);
    const picked = pickPlanForAmount(resolved, amountNum);
    // FN-1: same checkout hand-off as the working AT&T page (/topup-at.html): backend slug "topup-at", the AT&T Prepaid carrier id and
    // plan from the same carriers/view data, /es/checkout in Spanish. Never go to checkout without a plan id (plans may still be loading).
    if (!picked.planId) { loadResolvedPlans("topup-at").then(setResolved).catch((e) => console.warn("ATT plan load failed", e)); return; }
    navigate(lang === "es" ? "/es/checkout" : "/checkout", {
      state: {
        phone,
        amount: amountNum,
        carrierSlug: "topup-at",
        carrierName: "AT&T", // same as /topup-at.html (carriers/view carrier.name); checkout sends it as carrier_name
        brandColor: BRAND,
        carrierId: picked.carrierId ?? resolved.rangeCarrierId ?? 3,
        planId: picked.planId,
        planName: picked.name,
      },
    });
  };

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountTouched(false);
    setAmount(sanitizeAmountInput(e.target.value));
  }, []);

  const handleAmountPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setAmount(parsePastedAmount(e.clipboardData.getData("text")));
    setAmountTouched(true);
  }, []);

  const handleAmountBlur = useCallback(() => {
    setAmount((a) => normalizeAmountOnBlur(a));
    setAmountTouched(true);
  }, []);

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = parseAmountDollars(amount) || 0; // dollars, same unit checkout uses
  // FN-1: same min/max as the working AT&T page (carriers/view topup-at), not a hardcoded range.
  const rangeMin = resolved.rangeMin ?? 5;
  const rangeMax = Math.min(resolved.rangeMax ?? 300, 150); // FirstNet cap $150 (owner decision)
  const amountProblem = getAmountProblem(amount, amountNum, rangeMin, rangeMax);
  const amountValid = amountProblem === null;
  const amountMessage =
    amountProblem === "range"
      ? t(lang).invalidAmount(rangeMin, rangeMax)
      : amountProblem === "step"
      ? wholeDollarMessage(lang, amountNum)
      : null;
  // Over the max shows at once; below-min / cents show after the customer leaves the field.
  const showAmountMessage = !!amountMessage && (amountTouched || amountNum > rangeMax);
  const isValid = phoneDigits.length === 10 && amountValid && confirmed && agreedTerms;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: BRAND }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img src={attLogo} alt="AT&T Prepaid" className="h-[32px] sm:h-[44px] w-auto object-contain" />
          </div>
        </div>
      </nav>

      <section className="text-primary-foreground" style={{ backgroundColor: BRAND }}>
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">AT&amp;T Prepaid Bill Pay</h1>
        </div>
      </section>

      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your AT&amp;T Phone Number</label>
          <div className="relative mb-3">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": BRAND } as React.CSSProperties} />
          </div>
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Select Amount</label>
          <div className="relative mb-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} onPaste={handleAmountPaste} onBlur={handleAmountBlur} aria-invalid={showAmountMessage} aria-describedby={showAmountMessage ? "carrier-amount-error" : undefined} placeholder={`$${rangeMin} - $${rangeMax}`}
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": BRAND } as React.CSSProperties} />
          </div>
          {showAmountMessage && (
            <p id="carrier-amount-error" role="alert" className="text-[11px] sm:text-xs text-destructive font-semibold mt-1 mb-1">
              {amountMessage}
            </p>
          )}
          <p className="text-[10px] sm:text-xs text-muted-foreground">Or select a plan below</p>
          {amountValid && (
            <button type="button" onClick={() => {
              if (isValid) {
                goCheckout(amount);
              } else {
                document.getElementById("checkout-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }} className="mt-4 w-full h-10 sm:h-11 rounded-lg text-primary-foreground font-bold text-sm sm:text-base transition-colors active:scale-[0.97] hover:opacity-90" style={{ backgroundColor: BRAND }}>PAY NOW</button>
          )}
        </div>
      </div>

      <PlanGrid plans={plans} brandColor={BRAND} onSelect={(plan) => setAmount(plan.price.replace("$", ""))} />

      <div id="checkout-section" className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6">
          <p className="text-xs sm:text-sm font-bold text-foreground mb-3">Important</p>
          <label className="flex items-start gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: BRAND }} />
            <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">I have confirmed that I entered the correct phone number. I understand that this sale is final as the minutes cannot be removed nor transferred once loaded to the phone number I have provided above.</span>
          </label>
          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: BRAND }} />
            <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Agree with AT&amp;T Product Policies and Sales.{" "}<a href="https://www.att.com/legal/terms.attWebsiteTermsOfUse.html" className="underline font-semibold" style={{ color: BRAND }}>View More</a></span>
          </label>
          <button type="button" disabled={!isValid} onClick={() => goCheckout(amount)} className="w-full h-[44px] sm:h-[48px] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97]" style={{ backgroundColor: BRAND }}>PAY NOW</button>
          <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">Secure payment. Your refill is sent directly to your phone. It can take up to 30 min for a refill to reflect on your account.</p>
        </div>
      </div>

      <PaymentBar />
      <CarrierFooter brandColor={BRAND} carrierName="AT&T" />
    </div>
  );
};

export default ATT;
