import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { AccountDropdown } from "@/components/AccountDropdown";
import { useState, useCallback, useEffect } from "react";
import { Phone, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { FAQSection } from "@/components/FAQSection";
import { fetchCarrierView, verifyPhone, type CarrierViewData } from "@/services/apiWrapper";
import { applySeoHead } from "@/lib/seo";
import { t, type Language } from "@/lib/i18n";

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
  lang?: Language;
}

interface NormalizedPlan {
  plan_id: string;
  price: string;
  highlight: string;
  amount: number;
  name: string;
  carrierId?: number; // per-plan carrier id (used for fixed_plans entries)
}

// Strip non-printable / replacement chars (e.g. Ultra Mobile sometimes returns U+FFFD) — feedback #40
const sanitizeText = (s: string): string =>
  s.replace(/[\uFFFD\u0000-\u001F\u007F-\u009F]/g, "").replace(/\s+/g, " ").trim();

// Normalize "Topup $80" / "Topup 70.00 USD" → "$80" / "$70" — feedback #17
const normalizeHighlight = (raw: string, amount: number): string => {
  const cleaned = sanitizeText(raw);
  if (!cleaned) return amount > 0 ? `$${amount} Refill` : "Prepaid Refill";
  // If the description is just a Topup label, replace with clean dollar amount
  if (/^topup/i.test(cleaned)) return amount > 0 ? `$${amount} Refill` : cleaned;
  return cleaned;
};

function normalizePlans(plans: Array<Record<string, unknown>>): NormalizedPlan[] {
  return plans.map((p) => {
    const id = String(p.plan_id || p.planId || p.id || p.ID || "");
    const amt = Number(p.amount || p.price || p.Amount || 0);
    const rawName = String(p.name || p.Name || p.description || "");
    const carrier = p.carrier;
    const carrierIdNum =
      typeof carrier === "number"
        ? carrier
        : typeof carrier === "string" && carrier !== ""
        ? Number(carrier)
        : undefined;
    const cleanName = normalizeHighlight(rawName, amt);
    return {
      plan_id: id,
      price: `$${amt}`,
      highlight: cleanName,
      amount: amt,
      name: cleanName,
      carrierId: Number.isFinite(carrierIdNum) ? (carrierIdNum as number) : undefined,
    };
  });
}

const DynamicCarrier = ({
  carrierName: initialName,
  carrierSlug,
  carrierId: initialCarrierId,
  brandColor,
  logo,
  lang = "en",
}: DynamicCarrierProps) => {
  const navigate = useNavigate();
  const tr = t(lang);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  // Persistent inline error message — visible until the user changes input.
  const [inlineError, setInlineError] = useState<string | null>(null);

  // API-loaded state
  const [carrierName, setCarrierName] = useState(initialName);
  const [carrierId, setCarrierId] = useState(initialCarrierId);
  const [showRange, setShowRange] = useState(false); // custom amount input from carrier_plans.rangePlan
  const [showFixedPlans, setShowFixedPlans] = useState(false); // fixed plan buttons from fixed_plans.rangePlan
  const [rangeMin, setRangeMin] = useState(5);
  const [rangeMax, setRangeMax] = useState(300);
  const [rangePlanId, setRangePlanId] = useState<string>("");
  const [rangeCarrierId, setRangeCarrierId] = useState<number | undefined>(undefined); // carrier_plans.carrier.id
  const [plans, setPlans] = useState<NormalizedPlan[]>([]);
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  const [heading, setHeading] = useState("");
  const [subheading, setSubheading] = useState("");

  // Postpaid carriers — show "Postpaid Account?" link to corporate site (feedback)
  const postpaidUrls: Record<string, string> = {
    "topup-at": "https://www.att.com/wireless/",
    "topup-af": "https://www.att.com/firstnet/",
    verizon: "https://www.verizon.com/plans/",
    "verizon-wireless-flexi": "https://www.verizon.com/plans/",
    tmobile: "https://www.t-mobile.com/cell-phone-plans",
  };
  const postpaidUrl = postpaidUrls[carrierSlug];

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPhone(formatPhone(e.target.value));
      setInlineError(null);
    },
    []
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      setInlineError(null);
      if (val === "") { setAmount(""); return; }
      const num = parseInt(val, 10);
      if (num <= rangeMax) setAmount(val);
    },
    [rangeMax]
  );

  useEffect(() => {
    document.body.classList.add("hide-chat-mobile");
    return () => document.body.classList.remove("hide-chat-mobile");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data: CarrierViewData = await fetchCarrierView(carrierSlug);
        if (cancelled) return;

        // Carrier info
        if (data.carrier?.name) setCarrierName(data.carrier.name);
        if (data.carrier?.carrierId) setCarrierId(data.carrier.carrierId);

        // SEO / FAQ
        if (data.seo_carrier?.faqs) setFaqs(data.seo_carrier.faqs);
        if (data.seo_carrier?.recommended?.h1) setHeading(data.seo_carrier.recommended.h1);
        if (data.seo_carrier?.recommended?.h2) setSubheading(data.seo_carrier.recommended.h2);

        // Dynamic <head> SEO tags from API (fall back to seo_carrier nested fields)
        const seoSrc = (data.seo_carrier ?? {}) as Record<string, unknown>;
        const title =
          (data.title_for_layout as string) ||
          (seoSrc.title_for_layout as string) ||
          "";
        const description =
          (data.seo_description as string) ||
          (seoSrc.seo_description as string) ||
          "";
        const keywords =
          (data.seo_keywords as string) ||
          (seoSrc.seo_keywords as string) ||
          "";
        const schema =
          (data.seo_schema as string) ||
          (seoSrc.seo_schema as string) ||
          "";
        applySeoHead({ title, description, keywords, schema });

        // Plans: support both `carrier_plans` (range/custom amount) and `fixed_plans` (fixed buttons).
        // `fixed_plans` may live at the response root OR nested inside `carrier_plans.fixed_plans`.
        const cp = data.carrier_plans;
        const rootFp = (data as Record<string, unknown>).fixed_plans;
        const nestedFp =
          cp && !Array.isArray(cp) ? (cp as Record<string, unknown>).fixed_plans : undefined;
        const fp = (rootFp ?? nestedFp) as
          | Array<Record<string, unknown>>
          | { rangePlan?: boolean | string; plans?: Array<Record<string, unknown>>; [k: string]: unknown }
          | undefined;

        const cpRange =
          cp && !Array.isArray(cp) &&
          (cp.rangePlan === true || (typeof cp.rangePlan === "string" && cp.rangePlan !== ""));

        // For root/nested arrays of fixed_plans, presence of items means "show fixed buttons".
        const fpRange =
          (Array.isArray(fp) && fp.length > 0) ||
          (fp && !Array.isArray(fp) &&
            (fp.rangePlan === true || (typeof fp.rangePlan === "string" && fp.rangePlan !== "")));

        // 1) Custom Range: carrier_plans.rangePlan === true → show amount input.
        //    Capture carrier_plans.carrier.id (or .ID) as the carrier id used for range purchases.
        if (cpRange && cp && !Array.isArray(cp)) {
          setShowRange(true);
          setRangeMin(cp.carrier?.rangeMin ?? 5);
          setRangeMax(cp.carrier?.rangeMax ?? 300);
          if (typeof cp.rangePlan === "string" && cp.rangePlan !== "") {
            setRangePlanId(cp.rangePlan);
          } else if (cp.carrier?.rangePlan) {
            setRangePlanId(String(cp.carrier.rangePlan));
          }
          const rcRaw =
            (cp.carrier as Record<string, unknown> | undefined)?.id ??
            (cp.carrier as Record<string, unknown> | undefined)?.ID;
          const rcNum = typeof rcRaw === "number" ? rcRaw : rcRaw != null ? Number(rcRaw) : NaN;
          if (Number.isFinite(rcNum)) setRangeCarrierId(rcNum);
        } else {
          setShowRange(false);
        }

        // 2) Fixed Options: fixed_plans.rangePlan === true → show fixed plan buttons.
        //    Each entry's `carrier` field holds the carrier id to send for that plan.
        if (fpRange && fp && !Array.isArray(fp) && Array.isArray(fp.plans) && fp.plans.length > 0) {
          setShowFixedPlans(true);
          setPlans(normalizePlans(fp.plans));
        } else if (Array.isArray(fp) && fp.length > 0) {
          setShowFixedPlans(true);
          setPlans(normalizePlans(fp as Array<Record<string, unknown>>));
        } else if (cp && !cpRange) {
          // Fallback to carrier_plans for fixed plan list when fixed_plans is absent
          if (Array.isArray(cp)) {
            setShowFixedPlans(true);
            setPlans(normalizePlans(cp as Array<Record<string, unknown>>));
          } else if (Array.isArray(cp.plans) && cp.plans.length > 0) {
            setShowFixedPlans(true);
            setPlans(normalizePlans(cp.plans));
          }
        } else {
          setShowFixedPlans(false);
        }
      } catch (err) {
        console.warn("Failed to load carrier view for", carrierSlug, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [carrierSlug]);

  const phoneDigits = phone.replace(/\D/g, "");
  const amountNum = amount ? parseInt(amount, 10) : 0;
  const rangeAmountValid = amountNum >= rangeMin && amountNum <= rangeMax;

  const handlePlanSelect = (plan: { price: string; highlight: string }) => {
    setAmount(plan.price.replace("$", ""));
  };

  // Direct checkout from plan card "Pay Now" button (fixed_plans → use that plan's carrier id)
  const handlePlanPayNow = async (plan: { price: string; highlight: string }) => {
    if (phoneDigits.length !== 10) {
      toast({ title: tr.phoneRequired, description: tr.phoneRequired, variant: "destructive" });
      return;
    }
    setVerifying(true);
    const verify = await verifyPhone(carrierSlug, phoneDigits);
    setVerifying(false);
    if (!verify.success) {
      toast({ title: tr.invalidPhone, description: verify.message || tr.invalidPhone, variant: "destructive" });
      return;
    }
    const planAmount = Number(plan.price.replace("$", ""));
    const selectedPlan = plans.find((p) => p.amount === planAmount);
    navigate(lang === "es" ? "/es/checkout" : "/checkout", {
      state: {
        phone,
        amount: planAmount,
        carrierSlug,
        carrierId: selectedPlan?.carrierId ?? carrierId,
        carrierName,
        brandColor,
        planId: selectedPlan?.plan_id,
        planName: selectedPlan?.name,
      },
    });
  };

  const { toast } = useToast();

  const handlePay = async () => {
    setInlineError(null);
    if (phoneDigits.length !== 10) {
      const msg = tr.phoneRequired;
      setInlineError(msg);
      toast({ title: msg, description: msg, variant: "destructive" });
      return;
    }
    if (amountNum < rangeMin || amountNum > rangeMax) {
      const msg = tr.invalidAmount(rangeMin, rangeMax);
      setInlineError(msg);
      toast({ title: msg, description: msg, variant: "destructive" });
      return;
    }
    setVerifying(true);
    const verify = await verifyPhone(carrierSlug, phoneDigits);
    setVerifying(false);
    if (!verify.success) {
      const msg = verify.message || tr.invalidPhone;
      setInlineError(msg);
      toast({ title: tr.invalidPhone, description: msg, variant: "destructive" });
      return;
    }
    // Custom amount path → use carrier_plans.carrier.id when available
    const selectedPlan = plans.find((p) => p.amount === amountNum);
    navigate(lang === "es" ? "/es/checkout" : "/checkout", {
      state: {
        phone,
        amount: amountNum,
        carrierSlug,
        carrierId: selectedPlan?.carrierId ?? rangeCarrierId ?? carrierId,
        carrierName,
        brandColor,
        planId: selectedPlan?.plan_id || rangePlanId || undefined,
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
              <img src={logo} alt={carrierName} className="h-[32px] sm:h-[44px] w-auto object-contain" />
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold" style={{ color: bc }}>{carrierName}</span>
            )}
            <AccountDropdown />
          </div>
        </div>
      </nav>

      <section style={{ backgroundColor: bc }} className="text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-4 sm:py-5 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">
            {(lang === "es" || !heading) ? tr.heroH1(carrierName) : heading}
          </h1>
          <p className="text-sm opacity-90 mt-1">
            {(lang === "es" || !subheading) ? tr.heroH2(carrierName) : subheading}
          </p>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Phone + Amount */}
          <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
            <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
              <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                {tr.enterPhoneLabel(carrierName)}
              </label>
              <div className="relative mb-3">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={tr.phonePlaceholder}
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                  style={{ "--tw-ring-color": bc } as React.CSSProperties}
                />
              </div>
              {phoneDigits.length === 10 && (
                <p className="text-[10px] sm:text-xs text-cellpay-green font-semibold mb-2 -mt-1">
                  ✓ {tr.refilling}: {phone}
                </p>
              )}
              {phoneDigits.length > 0 && phoneDigits.length < 10 && (
                <p className="text-[10px] sm:text-xs text-destructive mb-2 -mt-1">
                  {tr.enterAll10}
                </p>
              )}


              {showRange && (
                <>
                  <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                    {tr.selectAmount}
                  </label>
                  <div className="relative mb-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder={tr.amountPlaceholder(rangeMin, rangeMax)}
                      className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                      style={{ "--tw-ring-color": bc } as React.CSSProperties}
                    />
                  </div>
                  {rangeAmountValid && (
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={verifying}
                      className="mt-3 w-full h-10 sm:h-11 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm sm:text-base transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                      style={{ backgroundColor: bc }}
                    >
                      {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                      {verifying ? tr.verifying : tr.payNow}
                    </button>
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {showFixedPlans ? tr.orSelectPlanBelow : tr.enterAmount}
                  </p>
                </>
              )}

              {/* Persistent inline error — feedback: "error message quickly flashes away" */}
              {inlineError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] sm:text-xs text-destructive font-semibold text-left"
                >
                  {inlineError}
                </div>
              )}
            </div>
          </div>

          {/* Plan grid (fixed_plans) */}
          {showFixedPlans && plans.length > 0 && (
            <PlanGrid
              plans={plans.map((p) => ({ price: p.price, highlight: p.highlight }))}
              brandColor={bc}
              onSelect={handlePlanPayNow}
              popularIndex={Math.min(plans.length - 1, Math.floor(plans.length / 2))}
            />
          )}

          {/* Terms + Pay (custom amount path) */}
          {showRange && (
          <div className="max-w-[420px] mx-auto px-4 pb-24 sm:pb-12">
            <p className="text-xs sm:text-sm font-bold text-foreground mb-2 mt-2">{tr.importantLabel}</p>
            <label className="flex items-start gap-2 mb-6 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: bc }} />
              <span className="text-[11px] sm:text-xs text-foreground leading-relaxed">
                {tr.confirmText}
              </span>
            </label>
            {/* Desktop / tablet Pay button (mobile uses sticky bar below) */}
            <div className="hidden sm:flex justify-center">
              <button
                type="button"
                onClick={handlePay}
                disabled={verifying}
                className="h-[48px] px-14 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: bc }}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? tr.verifying : tr.payNow}
              </button>
            </div>
            <p className="hidden sm:block text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
              {tr.securePayment}
            </p>
          </div>
          )}

          {/* Mobile sticky Pay bar — keeps CTA visible above numeric keyboard
              on open denomination flows (feedback Page 2 #4) */}
          {showRange && (
            <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-3 py-2 flex items-center gap-2"
                 style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}>
              <div className="flex-1 text-left leading-tight">
                <p className="text-[10px] text-muted-foreground">{tr.total}</p>
                <p className="text-base font-extrabold text-foreground">
                  ${amountNum > 0 ? amountNum : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={handlePay}
                disabled={verifying}
                className="flex-[2] h-[46px] rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: bc }}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? tr.verifying : tr.payNow}
              </button>
            </div>
          )}

          {/* FAQs from API */}
          {faqs.length > 0 && (
            <DynamicFAQ faqs={faqs} carrierName={carrierName} brandColor={bc} lang={lang} />
          )}
        </>
      )}

      <PaymentBar lang={lang} />
      <CarrierFooter brandColor={bc} carrierName={carrierName} lang={lang} />
    </div>
  );
};

/* ── FAQ sub-component ── */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DynamicFAQ = ({
  faqs,
  carrierName,
  brandColor,
  lang = "en",
}: {
  faqs: Array<{ question: string; answer: string }>;
  carrierName: string;
  brandColor: string;
  lang?: Language;
}) => {
  const tr = t(lang);
  return (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <h2 className="text-2xl font-extrabold text-foreground mb-4 text-center">
      {tr.faqsTitle(carrierName)}
    </h2>
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="text-left font-bold text-foreground" style={{ color: brandColor }}>
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
  );
};

export default DynamicCarrier;
