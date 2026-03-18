import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { SmartphonePlans } from "@/components/SmartphonePlans";
import { FAQSection } from "@/components/FAQSection";
import { AddOnPlans } from "@/components/AddOnPlans";
import { FCCLabels } from "@/components/FCCLabels";
import { PaymentBar } from "@/components/PaymentBar";
import { Footer } from "@/components/Footer";
import { LegalBar } from "@/components/LegalBar";
import simpleMobileLogo from "@/assets/simple-mobile-logo.png";

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const Index = () => {
  const [phone, setPhone] = useState("");

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Navbar />
      <HeroSection />

      {/* Logo */}
      <div className="text-center pt-8 pb-4 px-4">
        <img
          src={simpleMobileLogo}
          alt="Simple Mobile"
          className="mx-auto w-[180px]"
        />
      </div>

      {/* Page intro */}
      <div className="text-center pb-6 px-4">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">
          30-Day Smartphone Plans
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Select your plan, enter your phone number and recharge instantly. Available 24/7.
        </p>
      </div>

      {/* Phone number input card */}
      <div className="max-w-[600px] mx-auto px-4 pb-8">
        <div className="bg-card rounded-xl shadow-lg border border-border p-6">
          <label className="block text-sm font-bold text-foreground mb-2">
            Enter Your Simple Mobile Phone Number
          </label>
          <div className="relative mb-2">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XXX) XXX-XXXX"
              className="w-full h-12 pl-11 pr-4 rounded-lg border border-input bg-background text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cellpay-green focus:border-transparent"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the phone number you want to recharge
          </p>
        </div>
      </div>

      <SmartphonePlans />
      <FAQSection />
      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Index;
