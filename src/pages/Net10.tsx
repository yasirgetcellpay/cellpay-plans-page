import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import net10Logo from "@/assets/net10-logo.png";
import { PaymentBar } from "@/components/PaymentBar";
import { PlanGrid } from "@/components/PlanGrid";

const plans = [
  { price: "$75", highlight: "Unlimited + 10GB Data" },
  { price: "$65", highlight: "Intl Talk, Text, 3GB Data" },
  { price: "$60", highlight: "10GB 4G LTE Data" },
  { price: "$50", highlight: "8GB 4G LTE Data" },
  { price: "$40", highlight: "4GB 4G LTE Data" },
  { price: "$35", highlight: "2GB 4G LTE Data" },
  { price: "$25", highlight: "3GB High Speed Data" },
];

const brandColor = "hsl(195,100%,50%)";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const Net10 = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handlePlanSelect = (plan: { price: string }) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return;
    navigate("/checkout", { state: { phone, amount: plan.price.replace("$", ""), carrierSlug: "net10", carrierName: "Net10 Wireless", brandColor } });
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img src={net10Logo} alt="Net10 Wireless" className="h-[24px] sm:h-[36px] w-auto" />
          </div>
        </div>
      </nav>
      <section className="text-primary-foreground" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">Net10 Wireless Prepaid Refill</h1>
        </div>
      </section>
      <div className="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
        <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
          <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your Net10 Phone Number</label>
          <div className="relative mb-1 sm:mb-2">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX"
              className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(195,100%,50%)] focus:border-transparent text-center" />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>
        </div>
      </div>
      <PlanGrid plans={plans} brandColor={brandColor} onSelect={handlePlanSelect} />
      <PaymentBar />
      <CarrierFooter brandColor={brandColor} carrierName="Net10 Wireless" />
    </div>
  );
};

export default Net10;
