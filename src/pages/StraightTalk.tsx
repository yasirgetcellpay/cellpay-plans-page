import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { fetchCarrierView, verifyPhone } from "@/services/apiWrapper";
import { useToast } from "@/hooks/use-toast";
import { applySeoHead } from "@/lib/seo";

const brandColor = "hsl(72,74%,44%)";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

interface ApiPlan {
  planId: string;
  amount: number;
  description: string;
  carrierId: number;
  category: "wireless" | "broadband" | "addon";
}

interface DisplayPlan {
  price: string;
  highlight: string;
  planId: string;
  carrierId: number;
}

const shortName = (desc: string, fallback: string): string => {
  const first = desc.split(",")[0]?.trim() || fallback;
  return first.length > 28 ? first.slice(0, 28) + "…" : first;
};

const StraightTalk = () => {
  useEffect(() => {
    const isEs = typeof window !== "undefined" && window.location.pathname.startsWith("/es");
    applySeoHead(isEs
      ? { title: 'Recarga Straight Talk en Línea | CellPay', description: 'Recarga tu plan Straight Talk Wireless en línea con CellPay. Recarga instantánea y segura enviada directamente a tu número.' }
      : { title: 'Straight Talk Prepaid Refill Online | CellPay', description: 'Refill Straight Talk Wireless plans online with CellPay. Secure, instant top-up delivered directly to your Straight Talk phone.' });
  }, []);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [apiPlans, setApiPlans] = useState<ApiPlan[]>([]);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCarrierView("straight-talk");
        const dataObj = data as Record<string, unknown>;
        const cp = dataObj.carrier_plans;
        if (!Array.isArray(cp)) return;
        const normalized: ApiPlan[] = cp
          .map((p) => {
            const o = p as Record<string, unknown>;
            const planId = String(o.planId ?? o.plan_id ?? o.id ?? o.ID ?? "");
            const amount = Number(o.amount ?? 0);
            const carrierId = Number(o.carrier ?? 0);
            const description = String(o.description ?? "");
            let category: ApiPlan["category"] = "wireless";
            if (/^broadband-/i.test(planId)) category = "broadband";
            else if (/^addon-/i.test(planId)) category = "addon";
            return { planId, amount, description, carrierId, category };
          })
          .filter((p) => p.planId && p.amount > 0);
        setApiPlans(normalized);
      } catch (e) {
        console.error("Straight Talk plan fetch failed", e);
      }
    })();
  }, []);

  const wirelessPlans = useMemo<DisplayPlan[]>(
    () =>
      apiPlans
        .filter((p) => p.category === "wireless")
        .map((p) => ({
          price: `$${p.amount}`,
          highlight: shortName(p.description, `$${p.amount} Refill`),
          planId: p.planId,
          carrierId: p.carrierId,
        })),
    [apiPlans]
  );
  const broadbandPlans = useMemo<DisplayPlan[]>(
    () =>
      apiPlans
        .filter((p) => p.category === "broadband")
        .map((p) => ({
          price: `$${p.amount}`,
          highlight: shortName(p.description, `$${p.amount} Broadband`),
          planId: p.planId,
          carrierId: p.carrierId,
        })),
    [apiPlans]
  );
  const addonPlans = useMemo<DisplayPlan[]>(
    () =>
      apiPlans
        .filter((p) => p.category === "addon")
        .map((p) => ({
          price: `$${p.amount}`,
          highlight: shortName(p.description, `$${p.amount} Add-On`),
          planId: p.planId,
          carrierId: p.carrierId,
        })),
    [apiPlans]
  );

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const goToCheckout = async (plan: DisplayPlan) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast({ title: "Phone required", description: "Enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    setVerifying(true);
    const verify = await verifyPhone("straight-talk", digits);
    setVerifying(false);
    if (!verify.success) {
      toast({ title: "Invalid phone", description: verify.message || "Please check the phone number.", variant: "destructive" });
      return;
    }
    const amount = Number(plan.price.replace("$", ""));
    navigate("/checkout", {
      state: {
        phone,
        amount,
        carrierSlug: "straight-talk",
        carrierName: "Straight Talk",
        brandColor,
        carrierId: plan.carrierId,
        planId: plan.planId,
        planName: plan.highlight,
      },
    });
  };

  // PlanGrid passes back the full plan object — adapter keeps planId/carrierId.
  const onSelect = (p: { price: string; highlight: string }) => {
    const dp = [...wirelessPlans, ...broadbandPlans, ...addonPlans].find(
      (x) => x.price === p.price && x.highlight === p.highlight
    );
    if (dp) goToCheckout(dp);
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img src={straightTalkLogo} alt="Straight Talk" className="h-[32px] sm:h-[44px] w-auto object-contain" />
          </div>
        </div>
      </nav>
      <section className="text-foreground" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">Straight Talk Prepaid Refill</h1>
        </div>
      </section>
      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your Straight Talk Phone Number</label>
          <div className="relative mb-1 sm:mb-2">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(72,74%,44%)] focus:border-transparent text-center" />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>
          {verifying && <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">Verifying…</p>}
        </div>
      </div>

      {wirelessPlans.length > 0 && (
        <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mb-4">
          <div className="bg-muted/40 border border-border rounded-xl p-3 sm:p-5">
            <h2 className="text-sm sm:text-base font-extrabold text-foreground mb-3 px-1">Wireless Plans</h2>
            <PlanGrid plans={wirelessPlans} brandColor={brandColor} textOnBrand="text-foreground" onSelect={onSelect} />
          </div>
        </section>
      )}

      {broadbandPlans.length > 0 && (
        <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mb-4">
          <div className="bg-muted/40 border border-border rounded-xl p-3 sm:p-5">
            <h2 className="text-sm sm:text-base font-extrabold text-foreground mb-3 px-1">Broadband Plans</h2>
            <PlanGrid plans={broadbandPlans} brandColor={brandColor} textOnBrand="text-foreground" onSelect={onSelect} />
          </div>
        </section>
      )}

      {addonPlans.length > 0 && (
        <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mb-4">
          <div className="bg-muted/40 border border-border rounded-xl p-3 sm:p-5">
            <h2 className="text-sm sm:text-base font-extrabold text-foreground mb-3 px-1">Add-On Plans</h2>
            <PlanGrid plans={addonPlans} brandColor={brandColor} textOnBrand="text-foreground" onSelect={onSelect} />
          </div>
        </section>
      )}

      <PaymentBar />
      <CarrierFooter brandColor={brandColor} carrierName="Straight Talk" />
    </div>
  );
};

export default StraightTalk;
