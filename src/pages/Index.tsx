import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { PaymentForm } from "@/components/PaymentForm";
import { SmartphonePlans } from "@/components/SmartphonePlans";
import { FAQSection } from "@/components/FAQSection";
import { AddOnPlans } from "@/components/AddOnPlans";
import { FCCLabels } from "@/components/FCCLabels";
import { PaymentBar } from "@/components/PaymentBar";
import { Footer } from "@/components/Footer";
import { LegalBar } from "@/components/LegalBar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Navbar />
      <HeroSection />
      {/* Page intro */}
      <div className="text-center pt-10 pb-6 px-4">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">
          30-Day Smartphone Plans
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Select your plan, enter your phone number and recharge instantly. Available 24/7.
        </p>
      </div>
      <PaymentForm />
      <SmartphonePlans />
      <FAQSection />
      <AddOnPlans />
      <FCCLabels />
      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Index;
