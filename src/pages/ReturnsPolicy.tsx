import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";

const ReturnsPolicy = () => {
  useEffect(() => {
    applySeoHead({
      title: "Returns & Refunds Policy — CellPay",
      description:
        "CellPay's returns policy: completed refill payments are final and can't be refunded. How to contact support about a duplicate charge or a missing refill.",
      path: "/returns-policy",
    });
  }, []);
  return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Returns &amp; Refunds Policy</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">
        <p><strong className="text-foreground">Effective Date:</strong> January 1, 2026</p>

        <h2 className="text-lg font-bold text-foreground pt-3">General Policy</h2>
        <p>All payments made through CellPay are final. Once a payment is completed, it can't be refunded or cancelled. Please double-check the phone number, carrier, and plan or amount before you pay.</p>
        <p>This includes a refill sent to an incorrect phone number provided by the user, selecting the wrong carrier or plan amount, a change of mind after a successful refill, and carrier-side issues (account suspension, porting, etc.).</p>

        <h2 className="text-lg font-bold text-foreground pt-3">Auto Pay</h2>
        <p>Auto Pay can be cancelled at <a href="/faq" className="underline font-semibold text-foreground">cellpay.us/faq</a> with <strong className="text-foreground">Unsubscribe From Autopay</strong>; completed payments can't be refunded.</p>

        <h2 className="text-lg font-bold text-foreground pt-3">Problems With a Payment</h2>
        <p>If something went wrong with a payment, for example you were charged more than once for the same order or your refill didn't arrive on the phone number, email <strong>support@getcellpay.com</strong> and CellPay's support team will review it.</p>

        <p>Please include the following information in your email:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Your phone number</li>
          <li>Carrier name</li>
          <li>Transaction ID or order number</li>
          <li>Date of purchase</li>
          <li>Description of the issue</li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-3">Contact</h2>
        <p>For questions about a payment, email <strong>support@getcellpay.com</strong>.</p>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
  </div>
  );
};

export default ReturnsPolicy;
