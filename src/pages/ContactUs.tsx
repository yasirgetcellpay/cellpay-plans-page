import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";

const ContactUs = () => {
  useEffect(() => {
    applySeoHead({
      title: "Contact CellPay Support — Help With Your Prepaid Refill",
      description:
        "Need help with a CellPay refill? Email support@getcellpay.com. Business hours, response times, and tips for resolving common refill issues.",
      path: "/contact-us",
    });
  }, []);
  return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">Contact Us</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>
          Have a question, concern, or need assistance with your refill? We're here to help!
        </p>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <h3 className="font-bold text-foreground">Email Support</h3>
            <p>support@getcellpay.com</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground">Business Hours</h3>
            <p>Monday – Friday: 9:00 AM – 6:00 PM (EST)</p>
            <p>Saturday – Sunday: 10:00 AM – 4:00 PM (EST)</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground">Response Time</h3>
            <p>We typically respond within 24 hours on business days.</p>
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground pt-4">Before You Contact Us</h2>
        <p>
          Check our <a href="/faq" className="text-primary underline font-semibold">FAQ page</a> — your question may already be answered there.
        </p>
        <p>
          When reaching out, please include your phone number, carrier name, and transaction details (if applicable) so we can assist you faster.
        </p>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
  </div>
);

export default ContactUs;
