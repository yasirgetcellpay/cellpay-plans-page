import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback, useEffect } from "react";
import { Phone, DollarSign, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import boostLogo from "@/assets/boost-logo.png";
import { PaymentBar } from "@/components/PaymentBar";
import { verifyPhone } from "@/services/apiWrapper";
import { useToast } from "@/hooks/use-toast";
import { loadResolvedPlans, pickPlanForAmount, type ResolvedPlans } from "@/lib/resolvePlanId";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const Boost = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resolved, setResolved] = useState<ResolvedPlans>({ fixedPlans: [] });

  useEffect(() => {
    loadResolvedPlans("boost").then(setResolved).catch((e) => console.warn("Boost plan load failed", e));
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val === "") { setAmount(""); return; }
    const num = parseInt(val, 10);
    if (num <= 250) setAmount(val);
  }, []);

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = amount ? parseInt(amount, 10) : 0;
  const isValid = phoneDigits.length === 10 && amountNum >= 5 && amountNum <= 250 && confirmed && agreedTerms;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-[hsl(27,100%,50%)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img src={boostLogo} alt="Boost Mobile" className="h-[32px] sm:h-[44px] w-auto object-contain" />
          </div>
        </div>
      </nav>

      <section className="bg-[hsl(27,100%,50%)] text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">Boost Mobile Bill Pay</h1>
        </div>
      </section>

      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your Boost Mobile Phone Number</label>
          <div className="relative mb-3">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(27,100%,50%)] focus:border-transparent text-center" />
          </div>
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Recharge Amount</label>
          <div className="relative mb-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} placeholder="$5 - $250"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(27,100%,50%)] focus:border-transparent text-center" />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the amount you want to recharge</p>
        </div>
      </div>

      <div className="max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
        <p className="text-xs sm:text-sm font-bold text-foreground mb-2">Important</p>
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(27,100%,50%)]" />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">I have confirmed that I entered the correct phone number. I understand that this sale is final as the minutes cannot be removed nor transferred once loaded to the phone number I have provided above.</span>
        </label>
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(27,100%,50%)]" />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Agree with Boost Mobile Product Policies and Sales.{" "}<a href="https://www.boostmobile.com/about/legal/terms-conditions" className="text-[hsl(27,100%,50%)] underline font-semibold">View More</a></span>
        </label>
        <div className="flex justify-center">
          <button type="button" disabled={!isValid || verifying} onClick={async () => {
            setVerifying(true);
            const verify = await verifyPhone("boost", phoneDigits);
            setVerifying(false);
            if (!verify.success) {
              toast({ title: "Invalid phone number", description: verify.message || "Couldn't verify the phone number.", variant: "destructive" });
              return;
            }
            const picked = pickPlanForAmount(resolved, parseInt(amount, 10));
            navigate("/checkout", { state: { phone, amount, carrierSlug: "boost", carrierName: "Boost Mobile", brandColor: "hsl(27,100%,50%)", carrierId: picked.carrierId, planId: picked.planId, planName: picked.name } });
          }} className="h-[44px] sm:h-[48px] px-10 sm:px-14 rounded-lg bg-[hsl(27,100%,50%)] hover:bg-[hsl(27,100%,44%)] disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2">{verifying && <Loader2 className="h-4 w-4 animate-spin" />}{verifying ? "VERIFYING..." : "PAY NOW"}</button>
        </div>
        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">Secure payment. Instant refill sent directly to your phone.</p>
      </div>

      <PaymentBar />
      <CarrierFooter brandColor={"hsl(27,100%,50%)"} carrierName="Boost Mobile" />
    </div>
  );
};

export default Boost;
