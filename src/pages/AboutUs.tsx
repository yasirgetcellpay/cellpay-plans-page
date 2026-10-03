import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";

const AboutUs = () => {
  useEffect(() => {
    applySeoHead({
      title: "About CellPay — Online Prepaid Wireless Refills",
      description:
        "Learn about CellPay, an independent online prepaid refill service supporting 15+ US wireless carriers with online top-ups, secure checkout, and a low service fee shown before you pay.",
      path: "/about-us",
    });
  }, []);
  return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">About CellPay</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>
          CellPay is a fast, reliable online platform for prepaid wireless top-ups and refills. We make it easy to recharge your phone from the comfort of your home — no store visits, no hassle.
        </p>
        <p>
          We support all major U.S. prepaid carriers including AT&T, T-Mobile, Verizon, Cricket, Metro, Boost Mobile, Straight Talk, TracFone, and many more. Whether you need a monthly plan refill or a quick data add-on, CellPay has you covered.
        </p>
        <h2 className="text-xl font-bold text-foreground pt-4">Why Choose CellPay?</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Online recharge — pay from your phone or computer</li>
          <li>Secure payments via credit/debit card and Apple Pay</li>
          <li>Customer support: Monday – Friday: 9:00 AM – 6:00 PM (EST); Saturday – Sunday: 10:00 AM – 4:00 PM (EST); support@getcellpay.com</li>
          <li>Low service fee shown before you pay</li>
          <li>Support for 15+ major prepaid carriers</li>
        </ul>
        <h2 className="text-xl font-bold text-foreground pt-4">Our Mission</h2>
        <p>
          Our mission is to simplify the prepaid wireless experience. We believe staying connected should be easy, affordable, and accessible to everyone. CellPay bridges the gap between carriers and customers by providing a seamless digital refill experience.
        </p>
        <p>
          Founded with a customer-first approach, we're committed to delivering a smooth, trustworthy service that keeps you connected without interruption.
        </p>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
    </div>
  );
};

export default AboutUs;
