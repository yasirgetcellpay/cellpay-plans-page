import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";

const TermsAndConditions = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Terms &amp; Conditions</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">
        <p><strong className="text-foreground">Effective Date:</strong> January 1, 2026</p>

        <h2 className="text-lg font-bold text-foreground pt-3">1. Acceptance of Terms</h2>
        <p>By using CellPay, you agree to these Terms & Conditions. If you do not agree, please do not use our services.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">2. Services</h2>
        <p>CellPay provides an online platform for purchasing prepaid wireless refills and top-ups for supported U.S. carriers. We act as an authorized payment processor and are not affiliated with any wireless carrier.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">3. Pricing & Fees</h2>
        <p>All prices are displayed at the time of purchase. A service fee may be applied and will be shown before you confirm payment. Taxes and carrier-specific fees may vary by location.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">4. Payment</h2>
        <p>We accept Visa, Mastercard, American Express, Discover, and Apple Pay. Payment is processed at the time of purchase. You are responsible for ensuring your payment method is valid and has sufficient funds.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">5. Refills & Delivery</h2>
        <p>Refills are processed instantly upon successful payment. You are responsible for entering the correct phone number. CellPay is not liable for refills sent to incorrect numbers.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">6. No Refunds</h2>
        <p>All prepaid refill purchases are final and non-refundable once processed. Please verify your phone number and plan selection before completing your purchase. See our Returns & Refunds Policy for exceptions.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">7. Account Responsibility</h2>
        <p>If you create an account, you are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized use.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">8. Limitation of Liability</h2>
        <p>CellPay is not liable for any carrier service outages, delays in refill processing by the carrier, or issues arising from incorrect information provided by the user.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">9. Changes to Terms</h2>
        <p>We reserve the right to update these terms at any time. Continued use of CellPay after changes constitutes acceptance of the updated terms.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">10. Contact</h2>
        <p>Questions about these terms? Email us at <strong>support@getcellpay.com</strong>.</p>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
  </div>
);

export default TermsAndConditions;
