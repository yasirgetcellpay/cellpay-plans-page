import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Phone, DollarSign, Loader2, Plus, Minus } from "lucide-react";
import { useCarrierData } from "@/hooks/use-carrier-data";
import { getCarrierBrandColor } from "@/lib/carrier-colors";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";

const LOGO_BASE = "https://www.cellpay.us/webp/v4/home";
const NAV_GREEN = "hsl(160, 40%, 25%)";

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

  const carrierName = String(data?.carrier?.name || data?.carrier?.title || slug || "");
  const carrierSlug = data?.carrier?.slug || slug || "";
  const logoUrl = `${LOGO_BASE}/${carrierSlug}.webp`;
  const brandColor = getCarrierBrandColor(carrierSlug);

  const rangeMin = range?.rangeMin ?? 5;
  const rangeMax = range?.rangeMax ?? 300;
  const isRangeBased = !!range?.rangePlan;

  const h1 = seoCarrier?.recommended?.h1 ?? `${carrierName} Recharge`;
  const h2 = seoCarrier?.recommended?.h2 ?? `Mobile Bill Pay and Prepaid Plan Refill Payments`;
  const supportText = (seoCarrier?.support_text as Record<string, string>)?.option1;
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
    amountNum > 0 &&
    (!isRangeBased || (amountNum >= rangeMin && amountNum <= rangeMax)) &&
    confirmed &&
    agreedTerms;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: brandColor }} />
          <p className="text-sm text-gray-500">Loading carrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased flex flex-col">
      {/* Top nav bar - always green */}
      <nav className="sticky top-0 z-50 text-white" style={{ backgroundColor: NAV_GREEN }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link to="/" className="text-xl font-bold tracking-tight">
            cellpay<span className="align-super text-[10px]">®</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="hover:underline">Domestic Payments</Link>
            <span className="opacity-70 cursor-default">Bill Payments</span>
            <span className="opacity-70 cursor-default">International Topups</span>
          </div>
        </div>
      </nav>

      {/* Hero with carrier brand color */}
      <section className="py-10 sm:py-14 text-center text-white" style={{ backgroundColor: NAV_GREEN }}>
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center gap-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-2xl shadow-lg flex items-center justify-center p-3">
            <img
              src={logoUrl}
              alt={carrierName}
              className="max-h-20 sm:max-h-24 max-w-full object-contain"
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
          <h1 className="text-xl sm:text-2xl font-extrabold">
            {carrierName} Recharge - Fast Prepaid Refill
          </h1>
        </div>
      </section>

      {/* Form card */}
      <main className="flex-1 relative z-10 px-4 py-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {/* Carrier info row */}
          <div className="flex items-center gap-5 mb-8 p-5 border border-gray-200 rounded-lg">
            <div className="w-20 h-20 border border-gray-200 rounded-lg flex items-center justify-center p-2 bg-white shrink-0">
              <img
                src={logoUrl}
                alt={carrierName}
                className="max-h-16 max-w-full object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">{carrierName} Recharge</h2>
              <p className="text-sm text-gray-500 mt-0.5">{carrierName} {h2}</p>
            </div>
          </div>

          {/* Phone input */}
          <div className="relative mb-6">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XXX) XXX-XXXX"
              className="w-full h-14 pl-12 pr-4 rounded-lg border border-gray-300 bg-white text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
            />
          </div>

          {/* Range-based amount input */}
          {isRangeBased && (
            <>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Recharge Amount
              </label>
              <div className="relative mb-6">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder={`Enter an amount between ${rangeMin} - ${rangeMax}`}
                  className="w-full h-14 pl-12 pr-4 rounded-lg border border-gray-300 bg-white text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                />
              </div>
            </>
          )}

          {/* Plan grid (plan-based carriers only) */}
          {!isRangeBased && plans.length > 0 && (
            <div className="mb-6">
              <PlanGrid
                plans={plans}
                brandColor={brandColor}
                selectedPlanId={selectedPlanId || undefined}
                onSelect={(plan) => {
                  setAmount(plan.price.replace("$", ""));
                  setSelectedPlanId(plan.plan_id || null);
                }}
              />
            </div>
          )}

          {/* Checkboxes */}
          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded"
                style={{ accentColor: brandColor }}
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                I have confirmed that I entered the correct phone number. I understand that this sale is final.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded"
                style={{ accentColor: brandColor }}
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                Agree with {carrierName} Product Policies and Sales.
              </span>
            </label>
          </div>

          {/* Pay button - uses carrier brand color */}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={!isValid}
              className="h-14 px-20 rounded-full text-white font-bold text-lg uppercase tracking-wide transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              PAY NOW
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">
            Secure payment. Instant refill sent directly to your phone.
          </p>
        </div>
      </main>

      {/* Support text */}
      {supportText && (
        <section className="max-w-3xl mx-auto px-4 pb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600 leading-relaxed">{supportText}</p>
          </div>
        </section>
      )}

      {/* FAQs - matching cellpay.us design */}
      {faqs.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-center mb-8"
            style={{ color: brandColor }}
          >
            FAQs
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-200">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between py-5 px-6 text-left text-sm sm:text-base font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="pr-4">{faq.question}</span>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-lg font-bold transition-transform"
                    style={{
                      backgroundColor: brandColor,
                      transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
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
