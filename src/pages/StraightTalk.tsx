import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import { PaymentBar } from "@/components/PaymentBar";

interface Plan { price: string; highlight: string; category: string; }

const plans: Plan[] = [
  { price: "$65", highlight: "Platinum Unlimited", category: "Wireless" },
  { price: "$55", highlight: "Gold Unlimited", category: "Wireless" },
  { price: "$45", highlight: "Silver Unlimited", category: "Wireless" },
  { price: "$35", highlight: "Bronze 10GB", category: "Wireless" },
  { price: "$65", highlight: "Platinum Unlimited", category: "Broadband" },
  { price: "$55", highlight: "Gold Unlimited", category: "Broadband" },
  { price: "$45", highlight: "Silver Unlimited", category: "Broadband" },
  { price: "$35", highlight: "10 GB", category: "Broadband" },
  { price: "$10", highlight: "2GB Data Add-On", category: "Add-On" },
  { price: "$10", highlight: "Global Calling Add-On", category: "Add-On" },
];

const brandColor = "hsl(72,74%,44%)";
const textOnBrand = "text-foreground";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const StraightTalk = () => {
  const [phone, setPhone] = useState("");

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const wirelessPlans = plans.filter(p => p.category === "Wireless");
  const broadbandPlansList = plans.filter(p => p.category === "Broadband");
  const addonPlansList = plans.filter(p => p.category === "Add-On");

  const PlanCard = ({ plan }: { plan: Plan }) => (
    <div className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden flex flex-col">
      <div className="h-[14px] sm:h-[24px]" />
      <div className={`px-2 py-1.5 sm:p-6 ${textOnBrand} text-center`} style={{ backgroundColor: brandColor }}>
        <span className="text-base sm:text-4xl font-extrabold">{plan.price}</span>
        <span className="text-[8px] sm:text-sm font-semibold opacity-90"> / 30 Days</span>
      </div>
      <div className="p-1.5 sm:p-6 flex-grow flex flex-col">
        <div className="bg-muted p-1 sm:p-3 rounded text-center font-bold text-[9px] sm:text-base mb-1.5 sm:mb-6" style={{ color: brandColor }}>
          {plan.highlight}
        </div>
        <div className="flex justify-center mb-1.5 sm:mb-6">
          <a href="#" className={`${textOnBrand} text-center py-1 sm:py-3 px-4 sm:px-8 rounded font-bold text-[10px] sm:text-base hover:opacity-90 inline-block active:scale-[0.97] transition-all`} style={{ backgroundColor: brandColor }}>
            Pay Now
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-14 sm:h-20 items-center">
            <img src={straightTalkLogo} alt="Straight Talk" className="h-[36px] sm:h-[50px] w-auto" />
          </div>
        </div>
      </nav>

      <section className={`${textOnBrand}`} style={{ backgroundColor: brandColor }}>
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
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-6">
        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2 px-2">Wireless Plans</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4">
          {wirelessPlans.map((plan, i) => <PlanCard key={`w-${i}`} plan={plan} />)}
        </div>

        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2 px-2">Broadband Plans</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4">
          {broadbandPlansList.map((plan, i) => <PlanCard key={`b-${i}`} plan={plan} />)}
        </div>

        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2 px-2">Add-On Plans</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {addonPlansList.map((plan, i) => <PlanCard key={`a-${i}`} plan={plan} />)}
        </div>
      </section>

      <PaymentBar />
      <footer className="bg-cellpay-dark text-muted-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div><h5 className="text-primary-foreground font-bold mb-5 uppercase tracking-widest text-sm">Company</h5><ul className="space-y-3 text-sm"><li><a href="#" className="hover:text-primary-foreground">About Us</a></li><li><a href="#" className="hover:text-primary-foreground">Contact Us</a></li></ul></div>
            <div><h5 className="text-primary-foreground font-bold mb-5 uppercase tracking-widest text-sm">Policy</h5><ul className="space-y-3 text-sm"><li><a href="#" className="hover:text-primary-foreground">Privacy Policy</a></li><li><a href="#" className="hover:text-primary-foreground">Terms &amp; Conditions</a></li><li><a href="#" className="hover:text-primary-foreground">Returns &amp; Refunds Policy</a></li></ul></div>
            <div><h5 className="text-primary-foreground font-bold mb-5 uppercase tracking-widest text-sm">Help &amp; FAQ</h5><ul className="space-y-3 text-sm"><li><a href="#" className="hover:text-primary-foreground">How to Use</a></li><li><a href="#" className="hover:text-primary-foreground">FAQ</a></li></ul></div>
          </div>
          <div className="border-t border-muted pt-6 text-center">
            <p className="text-xs">© 2026 All rights reserved.</p>
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">Straight Talk® is a registered trademark of TracFone Wireless, Inc. All carrier names and trademarks are property of their respective owners.</p>
          </div>
        </div>
      </footer>
      <div className={`${textOnBrand} py-3 text-[10px] md:text-xs`} style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">All prices shown are full retail prices. Taxes and fees are additional and vary by location. Service plans are non-refundable.</div>
      </div>
    </div>
  );
};

export default StraightTalk;
