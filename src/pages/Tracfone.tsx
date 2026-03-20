import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import tracfoneLogo from "@/assets/tracfone-logo.svg";
import { PaymentBar } from "@/components/PaymentBar";

interface Plan { price: string; highlight: string; }

const plans: Plan[] = [
  { price: "$19.99", highlight: "60 Min Talk/Text/Web" },
  { price: "$29.99", highlight: "120 Min Talk/Text/Web" },
  { price: "$39.99", highlight: "200 Min Talk/Text/Web" },
  { price: "$99.99", highlight: "400 Min (365 Days)" },
  { price: "$20", highlight: "Unlimited + 1GB Data" },
  { price: "$25", highlight: "Unlimited + 2GB Data" },
  { price: "$30", highlight: "Unlimited + 3GB Data" },
  { price: "$15", highlight: "500 Min / 500 Text" },
  { price: "$125", highlight: "365 Days + 1GB/Mo" },
];

const brandColor = "hsl(230,70%,30%)";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const Tracfone = () => {
  const [phone, setPhone] = useState("");

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-14 sm:h-20 items-center">
            <img src={tracfoneLogo} alt="TracFone" className="h-[28px] sm:h-[40px] w-auto" />
          </div>
        </div>
      </nav>

      <section className="text-primary-foreground" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">TracFone Prepaid Refill</h1>
        </div>
      </section>

      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your TracFone Phone Number</label>
          <div className="relative mb-1 sm:mb-2">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {plans.map((plan, i) => (
            <div key={i} className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden flex flex-col">
              <div className="h-[14px] sm:h-[24px]" />
              <div className="px-2 py-1.5 sm:p-6 text-primary-foreground text-center" style={{ backgroundColor: brandColor }}>
                <span className="text-base sm:text-4xl font-extrabold">{plan.price}</span>
              </div>
              <div className="p-1.5 sm:p-6 flex-grow flex flex-col">
                <div className="bg-muted p-1 sm:p-3 rounded text-center font-bold text-[9px] sm:text-base mb-1.5 sm:mb-6" style={{ color: brandColor }}>
                  {plan.highlight}
                </div>
                <div className="flex justify-center mb-1.5 sm:mb-6">
                  <a href="#" className="text-primary-foreground text-center py-1 sm:py-3 px-4 sm:px-8 rounded font-bold text-[10px] sm:text-base hover:opacity-90 inline-block active:scale-[0.97] transition-all" style={{ backgroundColor: brandColor }}>
                    Pay Now
                  </a>
                </div>
              </div>
            </div>
          ))}
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
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">TracFone® is a registered trademark of TracFone Wireless, Inc. All carrier names and trademarks are property of their respective owners.</p>
          </div>
        </div>
      </footer>
      <div className="text-primary-foreground py-3 text-[10px] md:text-xs" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">All prices shown are full retail prices. Taxes and fees are additional and vary by location. Service plans are non-refundable.</div>
      </div>
    </div>
  );
};

export default Tracfone;
