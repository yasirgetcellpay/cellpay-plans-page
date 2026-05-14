import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";

const PrivacyPolicy = () => {
  useEffect(() => {
    applySeoHead({
      title: "Privacy Policy — CellPay",
      description:
        "How CellPay collects, uses, and protects customer information when you purchase a prepaid mobile refill: data we collect, how we share it, and your choices.",
      path: "/privacy-policy",
    });
  }, []);
  return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Privacy Policy</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">
        <p><strong className="text-foreground">Effective Date:</strong> January 1, 2026</p>

        <h2 className="text-lg font-bold text-foreground pt-3">1. Information We Collect</h2>
        <p>When you use CellPay, we may collect the following information:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Phone number (for processing your refill)</li>
          <li>Email address (for account creation and order confirmations)</li>
          <li>Payment information (processed securely through our payment provider — we do not store card details)</li>
          <li>Transaction history (order amounts, carriers, dates)</li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-3">2. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>To process and complete your prepaid refill transactions</li>
          <li>To send order confirmations and receipts</li>
          <li>To provide customer support</li>
          <li>To improve our services and user experience</li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-3">3. Information Sharing</h2>
        <p>We do not sell, rent, or trade your personal information. We may share data only with:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Payment processors to complete your transactions</li>
          <li>Carrier networks to process your refill</li>
          <li>Law enforcement if required by law</li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-3">4. Data Security</h2>
        <p>We use industry-standard encryption (SSL/TLS) to protect your data during transmission. Payment information is handled by PCI-compliant payment processors.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">5. Cookies</h2>
        <p>We use essential cookies to maintain your session and improve site functionality. We do not use tracking cookies for advertising purposes.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">6. Your Rights</h2>
        <p>You may request access to, correction of, or deletion of your personal data by contacting us at support@getcellpay.com.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">7. Contact</h2>
        <p>For privacy-related inquiries, email us at <strong>support@getcellpay.com</strong>.</p>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
  </div>
);

export default PrivacyPolicy;
