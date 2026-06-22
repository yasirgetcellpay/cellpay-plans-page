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

const BRAND = "hsl(0,100%,45%)";

const Verizon = () => {
  useEffect(() => {
    const isEs = typeof window !== "undefined" && window.location.pathname.startsWith("/es");
    applySeoHead(isEs
      ? { title: 'Recarga Verizon Prepago en Línea | CellPay', description: 'Recarga tu teléfono Verizon Prepaid en línea con CellPay. Recarga instantánea y segura enviada directamente a tu número Verizon.' }
      : { title: 'Verizon Prepaid Refill Online | CellPay', description: 'Refill your Verizon Prepaid phone online with CellPay. Secure, instant top-up delivered straight to your Verizon number.' });
  }, []);
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
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
        amount: amt,
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
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val === "") { setAmount(""); return; }
    const num = parseInt(val, 10);
    if (num <= 150) setAmount(val);
  }, []);

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = amount ? parseInt(amount, 10) : 0;
  const isValid = phoneDigits.length === 10 && amountNum >= 10 && amountNum <= 150 && confirmed && agreedTerms;

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
            <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} placeholder="$10 - $150"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": BRAND } as React.CSSProperties} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Or select a plan below</p>
          {amountNum >= 10 && amountNum <= 150 && (
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
        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">Secure payment. Instant refill sent directly to your phone.</p>
      </div>

      <PaymentBar />
      <CarrierFooter brandColor={BRAND} carrierName="Verizon" />
    </div>
  );
};

export default Verizon;
