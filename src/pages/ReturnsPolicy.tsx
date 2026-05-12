import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";

const ReturnsPolicy = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Returns &amp; Refunds Policy</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">
        <p><strong className="text-foreground">Effective Date:</strong> January 1, 2026</p>

        <h2 className="text-lg font-bold text-foreground pt-3">General Policy</h2>
        <p>All prepaid wireless refill purchases made through CellPay are final and non-refundable once the transaction has been successfully processed and the credit has been applied to the recipient's account.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">When a Refund May Be Considered</h2>
        <p>We may consider a refund or credit in the following situations:</p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong className="text-foreground">Failed Transaction:</strong> If your payment was charged but the refill was not applied to the phone number, please contact us within 24 hours with your transaction details.</li>
          <li><strong className="text-foreground">Duplicate Charge:</strong> If you were charged more than once for the same transaction, we will investigate and issue a refund for the duplicate charge.</li>
          <li><strong className="text-foreground">System Error:</strong> If a technical error on our end caused an incorrect refill, we will work to resolve the issue.</li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-3">Non-Refundable Scenarios</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Refill sent to an incorrect phone number provided by the user</li>
          <li>Selecting the wrong carrier or plan amount</li>
          <li>Change of mind after a successful refill</li>
          <li>Carrier-side issues (account suspension, porting, etc.)</li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-3">How to Request a Refund</h2>
        <p>Email us at <strong>support@getcellpay.com</strong> with the following information:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Your phone number</li>
          <li>Carrier name</li>
          <li>Transaction ID or order number</li>
          <li>Date of purchase</li>
          <li>Description of the issue</li>
        </ul>
        <p className="pt-2">Refund requests are reviewed within 3–5 business days. Approved refunds will be credited to the original payment method within 5–10 business days.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">Contact</h2>
        <p>For refund inquiries, email <strong>support@getcellpay.com</strong>.</p>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
  </div>
);

export default ReturnsPolicy;
