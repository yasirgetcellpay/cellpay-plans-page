import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback, useEffect } from "react";
import { Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { fetchCarrierView, verifyPhone } from "@/services/apiWrapper";
import { useToast } from "@/hooks/use-toast";

const wirelessPlans = [
  { price: "$65", highlight: "Platinum Unlimited" },
  { price: "$55", highlight: "Gold Unlimited" },
  { price: "$45", highlight: "Silver Unlimited" },
  { price: "$35", highlight: "Bronze 10GB" },
];

const broadbandPlans = [
  { price: "$65", highlight: "Platinum Unlimited" },
  { price: "$55", highlight: "Gold Unlimited" },
  { price: "$45", highlight: "Silver Unlimited" },
  { price: "$35", highlight: "10 GB" },
];

const addonPlans = [
  { price: "$10", highlight: "2GB Data Add-On" },
  { price: "$10", highlight: "Global Calling Add-On" },
];

const brandColor = "hsl(72,74%,44%)";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

interface ApiPlan {
  plan_id: string;
  amount: number;
  name: string;
  carrierId?: number;
}

const collectPlans = (data: unknown): Array<Record<string, unknown>> => {
  const out: Array<Record<string, unknown>> = [];
  const visit = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    const o = n as Record<string, unknown>;
    if (Array.isArray(o.plans)) o.plans.forEach((p) => out.push(p as Record<string, unknown>));
    Object.values(o).forEach(visit);
  };
  visit(data);
  return out;
};

const StraightTalk = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [apiPlans, setApiPlans] = useState<ApiPlan[]>([]);
  const [carrierId, setCarrierId] = useState<number | undefined>(undefined);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCarrierView("straight-talk");
        const raw = collectPlans(data);
        const seen = new Set<number>();
        const normalized: ApiPlan[] = [];
        for (const p of raw) {
          const amt = Number(p.amount ?? p.price ?? p.Amount ?? 0);
          if (!amt || seen.has(amt)) continue;
          const carrier = p.carrier;
          const carrierIdNum =
            typeof carrier === "number" ? carrier
            : typeof carrier === "string" && carrier !== "" ? Number(carrier)
            : undefined;
          normalized.push({
            plan_id: String(p.plan_id ?? p.planId ?? p.id ?? p.ID ?? ""),
            amount: amt,
            name: String(p.name ?? p.Name ?? p.description ?? ""),
            carrierId: Number.isFinite(carrierIdNum) ? (carrierIdNum as number) : undefined,
          });
          seen.add(amt);
        }
        setApiPlans(normalized);
        const dataObj = data as Record<string, unknown>;
        const cp = dataObj?.carrier_plans as Record<string, unknown> | undefined;
        const carrierObj = (cp?.carrier ?? dataObj?.carrier) as Record<string, unknown> | undefined;
        const cid = Number(carrierObj?.id ?? carrierObj?.ID ?? 0);
        if (cid) setCarrierId(cid);
      } catch (e) {
        // Silent — fallback to legacy direct checkout without planId
        console.error("Straight Talk plan fetch failed", e);
      }
    })();
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handlePlanSelect = async (plan: { price: string }) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast({ title: "Phone required", description: "Enter a valid 10-digit phone number.", variant: "destructive" });
      return;
    }
    const amount = Number(plan.price.replace("$", ""));
    setVerifying(true);
    const verify = await verifyPhone("straight-talk", digits);
    setVerifying(false);
    if (!verify.success) {
      toast({ title: "Invalid phone", description: verify.message || "Please check the phone number.", variant: "destructive" });
      return;
    }
    const matched = apiPlans.find((p) => p.amount === amount);
    navigate("/checkout", {
      state: {
        phone,
        amount,
        carrierSlug: "straight-talk",
        carrierName: "Straight Talk",
        brandColor,
        carrierId: matched?.carrierId ?? carrierId,
        planId: matched?.plan_id || undefined,
        planName: matched?.name,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img src={straightTalkLogo} alt="Straight Talk" className="h-[36px] sm:h-[50px] w-auto" />
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

      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2 px-2">Wireless Plans</h3>
      </div>
      <PlanGrid plans={wirelessPlans} brandColor={brandColor} textOnBrand="text-foreground" onSelect={handlePlanSelect} />

      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2 px-2">Broadband Plans</h3>
      </div>
      <PlanGrid plans={broadbandPlans} brandColor={brandColor} textOnBrand="text-foreground" onSelect={handlePlanSelect} />

      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2 px-2">Add-On Plans</h3>
      </div>
      <PlanGrid plans={addonPlans} brandColor={brandColor} textOnBrand="text-foreground" onSelect={handlePlanSelect} />

      <PaymentBar />
      <CarrierFooter brandColor={brandColor} carrierName="Straight Talk" />
    </div>
  );
};

export default StraightTalk;
