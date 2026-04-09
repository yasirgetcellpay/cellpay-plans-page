import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Phone, DollarSign, Loader2, ChevronDown, Plus, Minus } from "lucide-react";
import { useCarrierData, type CarrierPlan } from "@/hooks/use-carrier-data";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";

const LOGO_BASE = "https://www.cellpay.us/webp/v4/home";

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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const carrierName = String(data?.carrier?.title || data?.carrier?.name || slug || "");
  const carrierSlug = data?.carrier?.slug || slug || "";
  const logoUrl = `${LOGO_BASE}/${carrierSlug}.webp`;

  const rangeMin = range?.rangeMin ?? 5;
  const rangeMax = range?.rangeMax ?? 300;
  const isRangeBased = !!range?.rangePlan;

  const h1 = seoCarrier?.recommended?.h1 ?? `${carrierName} Recharge`;
  const h2 = seoCarrier?.recommended?.h2 ?? `Mobile & Bill Pay and Prepaid Plan Refill Payments`;
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
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      {/* Top nav bar */}
      <nav className="sticky top-0 z-50 bg-[hsl(160,40%,25%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <Link to="/" className="text-lg font-bold tracking-tight">
            cellpay<span className="align-super text-[10px]">®</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="hover:underline">Domestic Payments</Link>
            <span className="opacity-60 cursor-default">Bill Payments</span>
            <span className="opacity-60 cursor-default">International Topups</span>
          </div>
        </div>
      </nav>

      {/* Orange hero with logo + title */}
      <section className="bg-gradient-to-b from-orange-500 to-orange-400 py-8 sm:py-12 text-center text-white">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-xl shadow-lg flex items-center justify-center p-2">
            <img
              src={logoUrl}
              alt={carrierName}
              className="max-h-16 sm:max-h-20 max-w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector("span")) {
                  const span = document.createElement("span");
                  span.className = "text-sm font-bold text-gray-700 text-center";
                  span.textContent = carrierName;
                  parent.appendChild(span);
                }
              }}
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold">{h1}</h1>
        </div>
      </section>

      {/* Form card */}
      <main className="flex-1 -mt-4 relative z-10 px-4 pb-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-xl p-6 sm:p-8">
          {/* Carrier info row */}
          <div className="flex items-center gap-4 mb-6 p-4 border border-orange-200 rounded-lg bg-orange-50/30">
            <div className="w-16 h-16 border border-orange-300 rounded-lg flex items-center justify-center p-1.5 bg-white shrink-0">
              <img
                src={logoUrl}
                alt={carrierName}
                className="max-h-12 max-w-full object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">{carrierName} Bill Pay</h2>
              <p className="text-sm text-gray-500">{h2}</p>
            </div>
          </div>

          {/* Phone input */}
          <div className="relative mb-5">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XXX) XXX-XXXX"
              className="w-full h-12 pl-12 pr-4 rounded-lg border border-gray-300 bg-white text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {/* Amount */}
          {isRangeBased && (
            <>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Recharge Amount
              </label>
              <div className="relative mb-5">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder={`Enter an amount between ${rangeMin} - ${rangeMax}`}
                  className="w-full h-12 pl-12 pr-4 rounded-lg border border-gray-300 bg-white text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Checkboxes */}
          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-orange-500"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                I have confirmed that I entered the correct phone number. I understand that this sale is final.
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-orange-500"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                Agree with {carrierName} Product Policies and Sales.
              </span>
            </label>
          </div>

          {/* Plan grid (plan-based carriers only) */}
          {!isRangeBased && plans.length > 0 && (
            <div className="mb-6">
              <PlanGrid
                plans={plans}
                brandColor="hsl(134, 40%, 40%)"
                selectedPlanId={selectedPlanId || undefined}
                onSelect={(plan) => {
                  setAmount(plan.price.replace("$", ""));
                  setSelectedPlanId(plan.plan_id || null);
                }}
              />
            </div>
          )}

          {/* Pay button */}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={!isValid}
              className="h-12 px-16 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base uppercase tracking-wide transition-colors active:scale-[0.97]"
            >
              PAY NOW
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">
            Secure payment. Instant refill sent directly to your phone.
          </p>
        </div>
      </main>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="max-w-2xl mx-auto px-4 pb-12">
          <h2 className="text-xl sm:text-2xl font-extrabold text-center mb-6 text-orange-500">
            FAQs
          </h2>
          <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between py-4 px-1 text-left text-sm sm:text-base font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.question}</span>
                  {openFaq === i ? (
                    <Minus className="h-5 w-5 text-orange-500 shrink-0" />
                  ) : (
                    <Plus className="h-5 w-5 text-orange-500 shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-1 pb-4 text-sm text-gray-500 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <PaymentBar />

      <footer className="bg-gray-900 text-gray-400 py-6 text-center text-xs">
        <p>© 2026 All rights reserved.</p>
        <p className="text-[10px] opacity-50 mt-2">
          All carrier names and trademarks are property of their respective owners.
        </p>
      </footer>
    </div>
  );
};

export default CarrierDetail;
