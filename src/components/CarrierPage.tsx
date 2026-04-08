import { useState, useCallback } from "react";
import { Phone, DollarSign, Loader2, ChevronDown } from "lucide-react";
import { useCarrierData, type CarrierPlan } from "@/hooks/use-carrier-data";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";

interface CarrierPageProps {
  /** CellPay API slug (e.g. "topup-at", "boost") */
  apiSlug: string;
  /** Display name (e.g. "AT&T Prepaid") */
  name: string;
  /** Logo image import */
  logo: string;
  /** Brand HSL color string (e.g. "hsl(196,100%,44%)") */
  brandColor: string;
  /** Static fallback plans */
  staticPlans: CarrierPlan[];
  /** Default amount range for manual input (fallback if API doesn't provide range) */
  defaultRange?: { min: number; max: number };
  /** Terms/policy URL */
  termsUrl?: string;
  /** Trademark disclaimer */
  trademark?: string;
}

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const CarrierPage = ({
  apiSlug,
  name,
  logo,
  brandColor,
  staticPlans,
  defaultRange = { min: 5, max: 300 },
  termsUrl,
  trademark,
}: CarrierPageProps) => {
  const { plans, loading, range, seoCarrier } = useCarrierData(apiSlug, staticPlans);

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const rangeMin = range?.rangeMin ?? defaultRange.min;
  const rangeMax = range?.rangeMax ?? defaultRange.max;
  const isRangeBased = !!range?.rangePlan;

  const h1 = seoCarrier?.recommended?.h1 ?? `${name} Bill Pay`;
  const h2 = seoCarrier?.recommended?.h2;
  const faqs = seoCarrier?.faqs ?? [];

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      if (val === "") {
        setAmount("");
        return;
      }
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

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 bg-card border-b-4 shadow-sm"
        style={{ borderColor: brandColor }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-14 sm:h-20 items-center">
            <img
              src={logo}
              alt={name}
              className="h-[40px] sm:h-[56px] w-auto object-contain"
            />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="text-primary-foreground"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-7xl mx-auto px-5 py-3 sm:py-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">{h1}</h1>
          {h2 && (
            <p className="text-sm md:text-base opacity-90 mt-1">{h2}</p>
          )}
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{ color: brandColor }}
          />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Input card */}
          <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
            <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
              {/* Phone input */}
              <div className="relative mb-3">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(XXX) XXX-XXXX"
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                  style={
                    { "--tw-ring-color": brandColor } as React.CSSProperties
                  }
                />
              </div>

              {/* Amount input */}
              <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                Recharge Amount
              </label>
              <div className="relative mb-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder={`Enter an amount between ${rangeMin} - ${rangeMax}`}
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                  style={
                    { "--tw-ring-color": brandColor } as React.CSSProperties
                  }
                />
              </div>
              {!isRangeBased && plans.length > 0 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Or select a plan below
                </p>
              )}
            </div>
          </div>

          {/* Plan grid (only for plan-based carriers) */}
          {!isRangeBased && plans.length > 0 && (
            <PlanGrid
              plans={plans}
              brandColor={brandColor}
              onSelect={(plan) => setAmount(plan.price.replace("$", ""))}
            />
          )}

          {/* Confirm + Pay */}
          <div className="max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
            <p className="text-xs sm:text-sm font-bold text-foreground mb-2 mt-2">
              Important
            </p>
            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
                style={{ accentColor: brandColor }}
              />
              <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                I have confirmed that I entered the correct phone number. I
                understand that this sale is final as the minutes cannot be
                removed nor transferred once loaded to the phone number I have
                provided above.
              </span>
            </label>
            <label className="flex items-start gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
                style={{ accentColor: brandColor }}
              />
              <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                Agree with {name} Product Policies and Sales.{" "}
                {termsUrl && (
                  <a
                    href={termsUrl}
                    className="underline font-semibold"
                    style={{ color: brandColor }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View More
                  </a>
                )}
              </span>
            </label>
            <div className="flex justify-center">
              <button
                type="button"
                disabled={!isValid}
                className="h-[44px] sm:h-[48px] px-10 sm:px-14 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97]"
                style={{ backgroundColor: brandColor }}
              >
                PAY NOW
              </button>
            </div>
            <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
              Secure payment. Instant refill sent directly to your phone.
            </p>
          </div>

          {/* FAQ Section */}
          {faqs.length > 0 && (
            <section className="max-w-3xl mx-auto px-4 pb-10">
              <h2
                className="text-xl sm:text-2xl font-extrabold text-center mb-6"
                style={{ color: brandColor }}
              >
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
                        className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${
                          openFaq === i ? "rotate-180" : ""
                        }`}
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
        </>
      )}

      {/* Payment Bar */}
      <PaymentBar />

      {/* Footer */}
      <footer className="bg-cellpay-dark text-muted-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h5 className="text-primary-foreground font-bold mb-5 uppercase tracking-widest text-sm">
                Company
              </h5>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-primary-foreground">About Us</a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground">Contact Us</a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-5 uppercase tracking-widest text-sm">
                Policy
              </h5>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-primary-foreground">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground">Terms &amp; Conditions</a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground">Returns &amp; Refunds Policy</a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-5 uppercase tracking-widest text-sm">
                Help &amp; FAQ
              </h5>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-primary-foreground">How to Use</a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary-foreground">FAQ</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-6 text-center">
            <p className="text-xs">© 2026 All rights reserved.</p>
            {trademark && (
              <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">
                {trademark}
              </p>
            )}
          </div>
        </div>
      </footer>

      {/* Legal bar */}
      <div
        className="text-primary-foreground py-3 text-[10px] md:text-xs"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">
          All prices shown are full retail prices. Taxes and fees are additional
          and vary by location. Service plans are non-refundable.
        </div>
      </div>
    </div>
  );
};
