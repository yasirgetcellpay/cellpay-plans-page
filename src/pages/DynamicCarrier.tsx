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
import { fetchCarrierView, type CarrierViewData } from "@/services/apiWrapper";
import { applySeoHead } from "@/lib/seo";

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
}

interface NormalizedPlan {
  plan_id: string;
  price: string;
  highlight: string;
  amount: number;
  name: string;
  carrierId?: number; // per-plan carrier id (used for fixed_plans entries)
}

function normalizePlans(plans: Array<Record<string, unknown>>): NormalizedPlan[] {
  return plans.map((p) => {
    const id = String(p.plan_id || p.planId || p.id || p.ID || "");
    const amt = Number(p.amount || p.price || p.Amount || 0);
    const name = String(p.name || p.Name || p.description || "");
    const carrier = p.carrier;
    const carrierIdNum =
      typeof carrier === "number"
        ? carrier
        : typeof carrier === "string" && carrier !== ""
        ? Number(carrier)
        : undefined;
    return {
      plan_id: id,
      price: `$${amt}`,
      highlight: name || "Prepaid Refill",
      amount: amt,
      name: name || "Prepaid Refill",
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
}: DynamicCarrierProps) => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPhone(formatPhone(e.target.value)),
    []
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      if (val === "") { setAmount(""); return; }
      const num = parseInt(val, 10);
      if (num <= rangeMax) setAmount(val);
    },
    [rangeMax]
  );

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

  const handlePlanSelect = (plan: { price: string; highlight: string }) => {
    setAmount(plan.price.replace("$", ""));
  };

  // Direct checkout from plan card "Pay Now" button (fixed_plans → use that plan's carrier id)
  const handlePlanPayNow = (plan: { price: string; highlight: string }) => {
    if (phoneDigits.length !== 10) {
      toast({ title: "Phone number required", description: "Please enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    const planAmount = Number(plan.price.replace("$", ""));
    const selectedPlan = plans.find((p) => p.amount === planAmount);
    navigate("/checkout", {
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

  const handlePay = () => {
    if (phoneDigits.length !== 10) {
      toast({ title: "Phone number required", description: "Please enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    if (amountNum < rangeMin || amountNum > rangeMax) {
      toast({ title: "Invalid amount", description: `Please enter an amount between $${rangeMin} and $${rangeMax}.`, variant: "destructive" });
      return;
    }
    if (!confirmed) {
      toast({ title: "Confirmation required", description: "Please confirm that the phone number is correct.", variant: "destructive" });
      return;
    }
    if (!agreedTerms) {
      toast({ title: "Terms required", description: "Please agree to the product policies.", variant: "destructive" });
      return;
    }
    // Custom amount path → use carrier_plans.carrier.id when available
    const selectedPlan = plans.find((p) => p.amount === amountNum);
    navigate("/checkout", {
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
              <img src={logo} alt={carrierName} className="h-[40px] sm:h-[56px] w-auto" />
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold" style={{ color: bc }}>{carrierName}</span>
            )}
            <AccountDropdown />
          </div>
        </div>
      </nav>

      <section style={{ backgroundColor: bc }} className="text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">
            {heading || `${carrierName} Bill Pay`}
          </h1>
          {subheading && (
            <p className="text-sm opacity-90 mt-1">{subheading}</p>
          )}
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

              {showRange && (
                <>
                  <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                    Select Amount
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
                      style={{ "--tw-ring-color": bc } as React.CSSProperties}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {showFixedPlans ? "Or select a plan below" : "Enter the amount you want to recharge"}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Plan grid (fixed_plans) */}
          {showFixedPlans && plans.length > 0 && (
            <PlanGrid
              plans={plans.map((p) => ({ price: p.price, highlight: p.highlight }))}
              brandColor={bc}
              onSelect={handlePlanPayNow}
            />
          )}

          {/* Terms + Pay (custom amount path) */}
          {showRange && (
          <div className="max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
            <p className="text-xs sm:text-sm font-bold text-foreground mb-2 mt-2">Important</p>
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
                onClick={handlePay}
                className="h-[44px] sm:h-[48px] px-10 sm:px-14 rounded-lg hover:opacity-90 text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97]"
                style={{ backgroundColor: bc }}
              >
                PAY NOW
              </button>
            </div>
            <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
              Secure payment. Instant refill sent directly to your phone.
            </p>
          </div>
          )}

          {/* FAQs from API */}
          {faqs.length > 0 && (
            <DynamicFAQ faqs={faqs} carrierName={carrierName} brandColor={bc} />
          )}
        </>
      )}

      <PaymentBar />
      <CarrierFooter brandColor={bc} carrierName={carrierName} />
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
}: {
  faqs: Array<{ question: string; answer: string }>;
  carrierName: string;
  brandColor: string;
}) => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <h2 className="text-2xl font-extrabold text-foreground mb-4 text-center">
      {carrierName} FAQs
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

export default DynamicCarrier;
