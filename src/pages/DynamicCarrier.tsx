import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback, useEffect } from "react";
import { Phone, DollarSign, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PaymentBar } from "@/components/PaymentBar";
import { fetchPlans, type Plan } from "@/services/apiWrapper";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

interface DynamicCarrierProps {
  carrierName: string;
  carrierSlug: string;
  carrierId: number;
  brandColor: string;
  logo?: string;
  amountRange?: { min: number; max: number };
  hasFixedPlans?: boolean;
}

const DynamicCarrier = ({
  carrierName,
  carrierSlug,
  carrierId,
  brandColor,
  logo,
  amountRange,
  hasFixedPlans = false,
}: DynamicCarrierProps) => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPhone(formatPhone(e.target.value)),
    []
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      if (val === "") { setAmount(""); return; }
      const num = parseInt(val, 10);
      const max = amountRange?.max ?? 300;
      if (num <= max) setAmount(val);
    },
    [amountRange]
  );

  useEffect(() => {
    if (!hasFixedPlans) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      try {
        const data = await fetchPlans(carrierSlug);
        if (!cancelled) setPlans(data);
      } catch (err) {
        console.warn("Failed to load plans for", carrierSlug, err);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => { cancelled = true; };
  }, [carrierSlug, hasFixedPlans]);

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = amount ? parseInt(amount, 10) : 0;
  const minAmt = amountRange?.min ?? 5;
  const maxAmt = amountRange?.max ?? 300;

  const isValidDirect = phoneDigits.length === 10 && amountNum >= minAmt && amountNum <= maxAmt && confirmed && agreedTerms;
  const isValidPlan = phoneDigits.length === 10 && selectedPlan !== null && confirmed && agreedTerms;
  const isValid = selectedPlan ? isValidPlan : isValidDirect;

  const handlePay = () => {
    const planAmount = selectedPlan ? Number(selectedPlan.amount) : amountNum;
    const planId = selectedPlan ? (selectedPlan as Record<string, unknown>).plan_id || (selectedPlan as Record<string, unknown>).planId || selectedPlan.id : undefined;
    navigate("/checkout", {
      state: {
        phone,
        amount: planAmount,
        carrierSlug,
        carrierId,
        carrierName,
        brandColor,
        planId,
        planName: selectedPlan?.name,
      },
    });
  };

  const bc = brandColor;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: bc }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            {logo ? (
              <img src={logo} alt={carrierName} className="h-[40px] sm:h-[56px] w-auto" />
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold" style={{ color: bc }}>{carrierName}</span>
            )}
          </div>
        </div>
      </nav>

      <section style={{ backgroundColor: bc }} className="text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">{carrierName} Bill Pay</h1>
        </div>
      </section>

      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
            Enter Your {carrierName} Phone Number
          </label>
          <div className="relative mb-3">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
              style={{ "--tw-ring-color": bc } as React.CSSProperties}
            />
          </div>

          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
            {hasFixedPlans ? "Select Amount" : "Recharge Amount"}
          </label>
          <div className="relative mb-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input
              type="text"
              inputMode="numeric"
              value={selectedPlan ? String(selectedPlan.amount) : amount}
              onChange={handleAmountChange}
              disabled={!!selectedPlan}
              placeholder={`$${minAmt} - $${maxAmt}`}
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center disabled:opacity-60"
              style={{ "--tw-ring-color": bc } as React.CSSProperties}
            />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {hasFixedPlans ? "Or select a plan below" : "Enter the amount you want to recharge"}
          </p>
        </div>
      </div>

      {/* Plans grid */}
      {hasFixedPlans && (
        <div className="max-w-7xl mx-auto px-4 pb-8 sm:px-6 lg:px-8">
          {loadingPlans ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const pid = (plan as Record<string, unknown>).plan_id || (plan as Record<string, unknown>).planId || plan.id;
                const isSelected = selectedPlan && ((selectedPlan as Record<string, unknown>).plan_id || (selectedPlan as Record<string, unknown>).planId || selectedPlan.id) === pid;
                return (
                  <button
                    key={String(pid)}
                    onClick={() => setSelectedPlan(isSelected ? null : plan)}
                    className={`rounded-xl border-2 overflow-hidden transition-all duration-200 text-left ${
                      isSelected ? "ring-2 ring-offset-2 border-transparent" : "border-border hover:shadow-lg"
                    }`}
                    style={isSelected ? { borderColor: bc, "--tw-ring-color": bc } as React.CSSProperties : undefined}
                  >
                    <div className="text-primary-foreground py-3 px-4 text-center" style={{ backgroundColor: bc }}>
                      <span className="text-xl sm:text-2xl font-extrabold">${Number(plan.amount)}</span>
                      {plan.description && (
                        <span className="text-xs sm:text-sm ml-1 opacity-90">/ {plan.description}</span>
                      )}
                    </div>
                    <div className="bg-card p-3 sm:p-4 text-center">
                      <p className="text-sm font-semibold" style={{ color: bc }}>{plan.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {/* Terms + Pay */}
      <div className="max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
        <p className="text-xs sm:text-sm font-bold text-foreground mb-2">Important</p>
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: bc }} />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
            I have confirmed that I entered the correct phone number. I understand that this sale is final as the minutes cannot be removed nor transferred once loaded to the phone number I have provided above.
          </span>
        </label>
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: bc }} />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
            Agree with {carrierName} Product Policies and Sales.
          </span>
        </label>
        <div className="flex justify-center">
          <button
            type="button"
            disabled={!isValid}
            onClick={handlePay}
            className="h-[44px] sm:h-[48px] px-10 sm:px-14 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97]"
            style={{ backgroundColor: bc }}
          >
            PAY NOW
          </button>
        </div>
        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
          Secure payment. Instant refill sent directly to your phone.
        </p>
      </div>

      <PaymentBar />
      <CarrierFooter brandColor={bc} carrierName={carrierName} />
    </div>
  );
};

export default DynamicCarrier;
