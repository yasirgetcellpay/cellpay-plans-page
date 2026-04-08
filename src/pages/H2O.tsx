import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import h2oLogo from "@/assets/h2o-logo.png";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";
import { useCarrierData } from "@/hooks/use-carrier-data";

const staticPlans = [
  { price: "$100", highlight: "Unlimited Talk/Text/Data" },
  { price: "$60", highlight: "Unlimited LTE + Hotspot" },
  { price: "$50", highlight: "6GB Data + Intl Calling" },
  { price: "$40", highlight: "15GB Data" },
  { price: "$35", highlight: "500MB 4G Data" },
  { price: "$30", highlight: "6GB Data" },
  { price: "$20", highlight: "2GB Data" },
  { price: "$10", highlight: "PayGo Recharge" },
];

const brandColor = "hsl(195,85%,50%)";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const H2O = () => {
  const [phone, setPhone] = useState("");
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-14 sm:h-20 items-center">
            <img src={h2oLogo} alt="H2O Wireless" className="h-[24px] sm:h-[32px] w-auto" />
          </div>
        </div>
      </nav>
      <section className="text-primary-foreground" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">H2O Wireless Recharge</h1>
        </div>
      </section>
      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your H2O Wireless Phone Number</label>
          <div className="relative mb-1 sm:mb-2">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(195,85%,50%)] focus:border-transparent text-center" />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>
        </div>
      </div>
      <PlanGrid plans={plans} brandColor={brandColor} />
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
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">H2O Wireless® is a trademark of Locus Telecommunications, Inc. All carrier names and trademarks are property of their respective owners.</p>
          </div>
        </div>
      </footer>
      <div className="text-primary-foreground py-3 text-[10px] md:text-xs" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">All prices shown are full retail prices. Taxes and fees are additional and vary by location. Service plans are non-refundable.</div>
      </div>
    </div>
  );
};

export default H2O;
