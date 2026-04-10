import { useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Phone, DollarSign, Loader2 } from "lucide-react";
import { useCarrierData } from "@/hooks/use-carrier-data";
import { validatePlan } from "@/services/apiWrapper";
import { getCarrierBrandColor } from "@/lib/carrier-colors";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialogs } from "@/components/AuthDialogs";
import { toast } from "sonner";
import cellpayLogo from "@/assets/cellpay-logo.webp";

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
  const navigate = useNavigate();
  const { plans, loading, range, seoCarrier, data } = useCarrierData(slug || "", []);
  const { isAuthenticated, logout } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [validating, setValidating] = useState(false);

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

  const h2 = seoCarrier?.recommended?.h2 ?? "Mobile Bill Pay and Prepaid Plan Refill Payments";
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
  const hasPlanSelection = !isRangeBased && plans.length > 0;
  const isValid =
    phoneDigits.length === 10 &&
    (hasPlanSelection ? !!selectedPlanId : amountNum > 0) &&
    (!isRangeBased || (amountNum >= rangeMin && amountNum <= rangeMax)) &&
    confirmed &&
    agreedTerms;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: brandColor }} />
          <p className="text-sm text-muted-foreground">Loading carrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      {/* Per-carrier branded navbar — white bg, brand-color bottom border */}
      <nav className="w-full bg-card" style={{ borderBottom: `4px solid ${brandColor}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex-shrink-0">
            <img src={cellpayLogo} alt="CellPay" className="h-10" />
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="text-sm font-medium text-destructive hover:underline"
              >
                Log Out
              </button>
            ) : (
              <>
                <button
                  onClick={() => setAuthMode("login")}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  Log In
                </button>
                <Link
                  to="/"
                  className="px-5 py-2 rounded text-sm font-bold text-primary-foreground transition-colors"
                  style={{ backgroundColor: brandColor }}
                >
                  Recharge Now
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero with carrier brand color */}
      <section className="pb-20 pt-8 sm:pt-12 text-center text-primary-foreground" style={{ backgroundColor: brandColor }}>
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-card rounded-2xl shadow-lg flex items-center justify-center p-3">
            <img
              src={logoUrl}
              alt={carrierName}
              className="max-h-20 sm:max-h-24 max-w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector("span")) {
                  const span = document.createElement("span");
                  span.className = "text-sm font-bold text-foreground text-center";
                  span.textContent = carrierName;
                  parent.appendChild(span);
                }
              }}
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold">
            {carrierName} Bill Pay
          </h1>
          <p className="text-sm text-primary-foreground/80">{h2}</p>
        </div>
      </section>

      {/* Form card — overlaps hero */}
      <main className="flex-1 relative z-10 px-4 -mt-14 pb-8">
        <div className="max-w-xl mx-auto bg-card rounded-xl border border-border shadow-sm p-6 sm:p-8">
          {/* Phone input */}
          <label className="block text-sm font-bold text-foreground mb-2">Phone Number</label>
          <div className="relative mb-6">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XXX) XXX-XXXX"
              className="w-full h-14 pl-12 pr-4 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
            />
          </div>

          {/* Range-based or no-plan amount input */}
          {(isRangeBased || (!isRangeBased && plans.length === 0)) && (
            <>
              <label className="block text-sm font-bold text-foreground mb-2">
                Recharge Amount
              </label>
              <div className="relative mb-6">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder={isRangeBased ? `Enter amount ($${rangeMin} - $${rangeMax})` : "Enter recharge amount"}
                  className="w-full h-14 pl-12 pr-4 rounded-lg border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
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
              <span className="text-xs text-muted-foreground leading-relaxed">
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
              <span className="text-xs text-muted-foreground leading-relaxed">
                Agree with {carrierName} Product Policies and Sales.
              </span>
            </label>
          </div>

          {/* Pay button */}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={!isValid || validating}
              onClick={async () => {
                setValidating(true);
                try {
                  const resolvedPlanId = selectedPlanId || range?.planId || "";
                  const validateRes = await validatePlan(
                    carrierSlug,
                    phoneDigits,
                    resolvedPlanId || undefined,
                    amountNum || undefined
                  );
                  if (!validateRes.success || !validateRes.data) {
                    toast.error(validateRes.error || "Validation failed. Please try again.");
                    return;
                  }
                  const pricing = (validateRes.data as any)?.data ?? validateRes.data;
                  navigate("/checkout", {
                    state: {
                      phone: phoneDigits,
                      amount: pricing.amount ?? amountNum,
                      fee: pricing.fee ?? 0,
                      tax: pricing.tax ?? 0,
                      total: pricing.total ?? (amountNum + (pricing.fee ?? 0)),
                      planId: resolvedPlanId,
                      carrierId: pricing.carrierId ?? pricing.carrier_id ?? data?.carrier?.id ?? 0,
                      carrierName,
                      carrierSlug,
                    },
                  });
                } catch {
                  toast.error("Something went wrong. Please try again.");
                } finally {
                  setValidating(false);
                }
              }}
              className="h-14 px-20 rounded-full text-primary-foreground font-bold text-lg uppercase tracking-wide transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              {validating && <Loader2 className="h-5 w-5 animate-spin" />}
              {validating ? "VERIFYING..." : "PAY NOW"}
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Secure payment. Instant refill sent directly to your phone.
          </p>
        </div>
      </main>

      {/* Support text */}
      {supportText && (
        <section className="max-w-xl mx-auto px-4 pb-8">
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground leading-relaxed">{supportText}</p>
          </div>
        </section>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="max-w-xl mx-auto px-4 pb-12">
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-center mb-8"
            style={{ color: brandColor }}
          >
            FAQs
          </h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between py-5 px-6 text-left text-sm sm:text-base font-semibold text-foreground hover:bg-muted transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="pr-4">{faq.question}</span>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-primary-foreground text-lg font-bold transition-transform"
                    style={{
                      backgroundColor: brandColor,
                      transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <PaymentBar />
      <Footer />

      <AuthDialogs
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitchMode={setAuthMode}
      />
    </div>
  );
};

export default CarrierDetail;
