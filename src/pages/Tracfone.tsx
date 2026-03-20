import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import tracfoneLogo from "@/assets/tracfone-logo.svg";
import { PaymentBar } from "@/components/PaymentBar";

interface Plan { price: string; label: string; }

const plans: Plan[] = [
  { price: "$19.99", label: "60 Minutes for Talk, Text and Web (90 Days)" },
  { price: "$29.99", label: "120 Minutes for Talk, Text and Web (90 Days)" },
  { price: "$39.99", label: "200 Minutes for Talk, Text and Web (90 Days)" },
  { price: "$99.99", label: "400 Minutes for Talk, Text and Web (365 Days)" },
  { price: "$20", label: "TracFone Unltd Classic RTR $20 Data 1 GB" },
  { price: "$25", label: "TracFone Unltd Classic RTR $25 Data 2 GB" },
  { price: "$30", label: "TracFone Unltd Classic RTR $30 Data 3 GB" },
  { price: "$15", label: "TracFone Smartphone RTR $15 500 min 500 text n 500mb 30 days service" },
  { price: "$125", label: "TracFone Smartphone RTR $125 365 days service monthly 750 min 1000 text Data 1GB" },
];

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const Tracfone = () => {
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const phoneDigits = phone.replace(/\D/g, "");
  const isValid = phoneDigits.length === 10 && selectedPlan !== null && confirmed && agreedTerms;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-[hsl(230,70%,30%)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-14 sm:h-20 items-center">
            <img src={tracfoneLogo} alt="TracFone" className="h-[28px] sm:h-[40px] w-auto" />
          </div>
        </div>
      </nav>

      <section className="bg-[hsl(230,70%,30%)] text-primary-foreground">
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
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(230,70%,30%)] focus:border-transparent text-center" />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>
        </div>
      </div>

      <div className="max-w-[500px] mx-auto px-4 pb-4">
        <label className="block text-xs sm:text-sm font-bold text-foreground mb-3">Select Amount</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {plans.map((plan, i) => {
            const isSelected = selectedPlan === i;
            return (
              <button key={i} type="button" onClick={() => setSelectedPlan(i)}
                className={`rounded-lg border-2 text-left overflow-hidden transition-all active:scale-[0.97] ${isSelected ? "border-[hsl(230,70%,30%)]" : "border-border hover:border-[hsl(230,70%,30%)]/50"}`}>
                <div className={`px-3 py-1.5 text-center font-extrabold text-sm sm:text-base ${isSelected ? "bg-[hsl(230,70%,24%)] text-primary-foreground" : "bg-[hsl(230,70%,30%)] text-primary-foreground"}`}>{plan.price}</div>
                <div className="px-2 py-1.5">
                  <div className="text-[9px] sm:text-[11px] text-muted-foreground leading-tight text-center">{plan.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-[420px] mx-auto px-4 pb-8 sm:pb-12">
        <p className="text-xs sm:text-sm font-bold text-foreground mb-2 mt-2">Important</p>
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(230,70%,30%)]" />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">I have confirmed that I entered the correct phone number. I understand that this sale is final as the minutes cannot be removed nor transferred once loaded to the phone number I have provided above.</span>
        </label>
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(230,70%,30%)]" />
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">Agree with TracFone Product Policies and Sales.{" "}<a href="https://www.tracfone.com/termsandconditions" className="text-[hsl(230,70%,30%)] underline font-semibold">View More</a></span>
        </label>
        <div className="flex justify-center">
          <button type="button" disabled={!isValid} className="h-[44px] sm:h-[48px] px-10 sm:px-14 rounded-lg bg-[hsl(230,70%,30%)] hover:bg-[hsl(230,70%,24%)] disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base sm:text-lg transition-colors active:scale-[0.97]">PAY NOW</button>
        </div>
        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">Secure payment. Instant refill sent directly to your phone.</p>
      </div>

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
      <div className="bg-[hsl(230,70%,30%)] text-primary-foreground py-3 text-[10px] md:text-xs">
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">All prices shown are full retail prices. Taxes and fees are additional and vary by location. Service plans are non-refundable.</div>
      </div>
    </div>
  );
};

export default Tracfone;
