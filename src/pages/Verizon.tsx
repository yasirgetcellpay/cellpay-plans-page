import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback, useEffect } from "react";
import { Phone, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import verizonLogo from "@/assets/verizon-logo.png";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { loadResolvedPlans, pickPlanForAmount, type ResolvedPlans } from "@/lib/resolvePlanId";
import { applySeoHead } from "@/lib/seo";
import { t, useLang } from "@/lib/i18n";

const plans = [
  { price: "$80", highlight: "Prepaid Refill" },
  { price: "$75", highlight: "Prepaid Refill" },
  { price: "$70", highlight: "Prepaid Refill" },
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$45", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
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

const BRAND = "hsl(0,100%,45%)";

const Verizon = () => {
  useEffect(() => {
    const isEs = typeof window !== "undefined" && window.location.pathname.startsWith("/es");
    applySeoHead(isEs
      ? { title: 'Recarga Verizon Prepago en Línea | CellPay', description: 'Recarga tu teléfono Verizon Prepaid en línea con CellPay. Recarga segura enviada directamente a tu número Verizon. La recarga puede tardar hasta 30 min en reflejarse.' }
      : { title: 'Verizon Prepaid Refill Online | CellPay', description: 'Refill your Verizon Prepaid phone online with CellPay. Secure online top-up sent straight to your Verizon number.' });
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
    loadResolvedPlans("verizon").then(setResolved).catch((e) => console.warn("Verizon plan load failed", e));
  }, []);

  const goCheckout = (amt: number | string) => {
    const amountNum = typeof amt === "number" ? amt : Number(amt);
    const picked = pickPlanForAmount(resolved, amountNum);
    navigate("/checkout", {
      state: {
        phone,
        amount: String(amountNum), // whole dollars as before ("25.00" → "25")
        carrierSlug: "verizon",
        carrierName: "Verizon",
        brandColor: BRAND,
        carrierId: picked.carrierId,
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
  const amountProblem = getAmountProblem(amount, amountNum, 10, 150);
  const amountValid = amountProblem === null;
  const amountMessage =
    amountProblem === "range"
      ? t(lang).invalidAmount(10, 150)
      : amountProblem === "step"
      ? wholeDollarMessage(lang, amountNum)
      : null;
  // Over the max shows at once; below-min / cents show after the customer leaves the field.
  const showAmountMessage = !!amountMessage && (amountTouched || amountNum > 150);
  const isValid = phoneDigits.length === 10 && amountValid && confirmed && agreedTerms;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: BRAND }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img src={verizonLogo} alt="Verizon Prepaid logo" className="h-[32px] sm:h-[44px] w-auto object-contain" />
          </div>
        </div>
      </nav>

      <section className="text-primary-foreground" style={{ backgroundColor: BRAND }}>
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">Verizon Prepaid Bill Pay</h1>
        </div>
      </section>

      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your Verizon Phone Number</label>
          <div className="relative mb-3">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": BRAND } as React.CSSProperties} />
          </div>
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Select Amount</label>
          <div className="relative mb-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} onPaste={handleAmountPaste} onBlur={handleAmountBlur} aria-invalid={showAmountMessage} aria-describedby={showAmountMessage ? "carrier-amount-error" : undefined} placeholder="$10 - $150"
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
              if (phoneDigits.length !== 10) return;
              goCheckout(amount);
            }} disabled={phoneDigits.length !== 10} className="mt-4 w-full h-10 sm:h-11 rounded-lg text-primary-foreground font-bold text-sm sm:text-base transition-colors active:scale-[0.97] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: BRAND }}>PAY NOW</button>
          )}
        </div>
      </div>

      <PlanGrid plans={plans} brandColor={BRAND} onSelect={(plan) => setAmount(plan.price.replace("$", ""))} />

      <div id="checkout-section" className="max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
        <p className="text-xs sm:text-sm font-bold text-foreground mb-2 mt-2">Important</p>
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: BRAND }} />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">I have confirmed that I entered the correct phone number. I understand that this sale is final as the minutes cannot be removed nor transferred once loaded to the phone number I have provided above.</span>
        </label>
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: BRAND }} />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Agree with Verizon Product Policies and Sales.{" "}<a href="https://www.verizon.com/support/prepaid-terms-conditions/" className="underline font-semibold" style={{ color: BRAND }}>View More</a></span>
        </label>
        <div className="flex justify-center">
          <button type="button" disabled={!isValid} onClick={() => goCheckout(amount)} className="h-[44px] sm:h-[48px] px-10 sm:px-14 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97]" style={{ backgroundColor: BRAND }}>PAY NOW</button>
        </div>
        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">Secure payment. Your refill is sent directly to your phone. It can take up to 30 min for a refill to reflect on your account.</p>
      </div>

      <PaymentBar />
      <CarrierFooter brandColor={BRAND} carrierName="Verizon" />
    </div>
  );
};

export default Verizon;
