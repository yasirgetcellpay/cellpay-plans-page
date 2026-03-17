import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { SmartphonePlans } from "@/components/SmartphonePlans";
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
      <SmartphonePlans />
      <AddOnPlans />
      <FCCLabels />
      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Index;
