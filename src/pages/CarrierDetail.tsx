import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Phone, DollarSign, Loader2, ChevronDown, ArrowLeft } from "lucide-react";
import { useCarrierData, type CarrierPlan } from "@/hooks/use-carrier-data";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const CarrierDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { plans, loading, range, seoCarrier, data } = useCarrierData(slug || "", []);

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const carrierName = String(data?.carrier?.title || data?.carrier?.name || slug || "");
  const brandColor = "hsl(27, 100%, 50%)"; // Default orange, could be dynamic

  const rangeMin = range?.rangeMin ?? 5;
  const rangeMax = range?.rangeMax ?? 300;
  const isRangeBased = !!range?.rangePlan;

  const h1 = seoCarrier?.recommended?.h1 ?? `${carrierName} Bill Pay`;
  const h2 = seoCarrier?.recommended?.h2;
  const faqs = seoCarrier?.faqs ?? [];

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      if (val === "") { setAmount(""); return; }
      const num = parseInt(val, 10);
      if (num <= rangeMax) setAmount(val);
    },
    [rangeMax]
  );

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = amount ? parseInt(amount, 10) : 0;
  const isValid =
    phoneDigits.length === 10 &&
    amountNum >= rangeMin &&
    amountNum <= rangeMax &&
    confirmed &&
    agreedTerms;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading carrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            All Carriers
          </Link>
        </div>
      </nav>

      {/* Hero card */}
      <section className="max-w-3xl mx-auto px-4 pt-6 pb-2">
        <div className="bg-card rounded-xl border border-border shadow-lg p-6 flex items-center gap-6">
          <div className="shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border border-border flex items-center justify-center bg-background p-2">
              <span className="text-lg font-bold text-foreground text-center leading-tight">{carrierName}</span>
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">{h1}</h1>
            {h2 && <p className="text-sm text-muted-foreground mt-1">{h2}</p>}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-3xl mx-auto px-4 pt-4 pb-4">
        <div className="bg-card rounded-xl border border-border shadow-lg p-6">
          {/* Phone input */}
          <div className="relative mb-4">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XXX) XXX-XXXX"
              className="w-full h-12 pl-11 pr-4 rounded-lg border border-input bg-background text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Amount */}
          <label className="block text-sm font-bold text-foreground mb-2">
            Recharge Amount
          </label>
          <div className="relative mb-2">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder={`Enter an amount between ${rangeMin} - ${rangeMax}`}
              className="w-full h-12 pl-11 pr-4 rounded-lg border border-input bg-background text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          {!isRangeBased && plans.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2">Or select a plan below</p>
          )}

          {/* Checkboxes */}
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I have confirmed that I entered the correct phone number. I understand that this sale is final.
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Agree with {carrierName} Product Policies and Sales.
              </span>
            </label>
          </div>

          {/* Pay button */}
          <div className="flex justify-center mt-6">
            <button
              type="button"
              disabled={!isValid}
              className="h-12 px-14 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-colors active:scale-[0.97]"
            >
              PAY NOW
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Secure payment. Instant refill sent directly to your phone.
          </p>
        </div>
      </section>

      {/* Plan grid (plan-based carriers only) */}
      {!isRangeBased && plans.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <PlanGrid
            plans={plans}
            brandColor={brandColor}
            onSelect={(plan) => setAmount(plan.price.replace("$", ""))}
          />
        </div>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-10">
          <h2 className="text-xl sm:text-2xl font-extrabold text-center mb-6 text-primary">
            FAQs
          </h2>
          <div className="divide-y divide-border border-t border-b border-border">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between py-4 px-2 text-left text-sm sm:text-base font-medium text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-2 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <PaymentBar />

      <footer className="bg-cellpay-dark text-muted-foreground py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs">© 2026 All rights reserved.</p>
          <p className="text-[10px] opacity-50 mt-2">
            All carrier names and trademarks are property of their respective owners.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CarrierDetail;
