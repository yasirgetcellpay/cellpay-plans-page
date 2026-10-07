import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { HelpQuickActions } from "@/components/HelpQuickActions";
import { applySeoHead } from "@/lib/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "What is CellPay?", a: "CellPay is an online platform that lets you recharge prepaid wireless accounts online for major U.S. carriers like AT&T, T-Mobile, Verizon, Cricket, Metro, Boost, and more." },
  { q: "How does CellPay work?", a: "Simply select your carrier, enter your phone number, choose a plan or amount, and complete your payment. It can take up to 30 min for a refill to reflect on your account." },
  { q: "Which carriers does CellPay support?", a: "We support 15+ major prepaid carriers including AT&T, T-Mobile, Verizon, Cricket Wireless, Metro by T-Mobile, Boost Mobile, Straight Talk, TracFone, H2O Wireless, Lyca Mobile, Net10, Page Plus, and Ultra Mobile." },
  { q: "Is CellPay safe and secure?", a: "Yes. Payment data is encrypted in transit with TLS (HTTPS) and processed by our payment processors." },
  { q: "How long does a refill take?", a: "It can take up to 30 min for a refill to reflect on your account." },
  { q: "What payment methods do you accept?", a: "We accept Visa, Mastercard, American Express, Discover, Apple Pay, Google Pay, PayPal, Klarna, and Cash App." },
  { q: "Do I need to create an account?", a: "No, you can recharge as a guest. However, creating an account lets you track your order history and speeds up future transactions." },
  { q: "Can I get a refund or cancel a payment?", a: "Completed payments can't be refunded or cancelled, so please double-check your phone number and plan before you pay. Auto Pay can be cancelled at cellpay.us/faq with 'Unsubscribe From Autopay'." },
  { q: "I didn't receive my refill. What should I do?", a: "First, wait 30 minutes and check your account balance. If the credit hasn't been applied, contact us at support@getcellpay.com with your transaction details." },
  { q: "Is CellPay affiliated with any carrier?", a: "No. CellPay is an independent payment processor. All carrier names and trademarks are property of their respective owners." },
];

const FAQ = () => {
  // APAP-1007: /faq#unsubscribe-autopay (Apple Pay Auto Pay managementURL) opens the existing "Unsubscribe From Autopay" form
  // and scrolls to it. FAQ page only: HelpQuickActions is not edited; this just clicks its existing button once.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== "#unsubscribe-autopay") return;
    let tries = 0; let done = false;
    const t = window.setInterval(() => {
      tries += 1;
      const box = document.getElementById("unsubscribe-autopay");
      const btn = box ? Array.from(box.querySelectorAll("button")).find((b) => /unsubscribe from autopay/i.test(b.textContent || "")) : undefined;
      if (btn && !done) {
        done = true; window.clearInterval(t);
        box!.scrollIntoView({ block: "start" });
        btn.click();
        window.setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('input[placeholder*="10-digit"]');
          if (input) { input.scrollIntoView({ block: "center" }); input.focus({ preventScroll: true }); }
        }, 250);
      } else if (tries > 40) window.clearInterval(t);
    }, 100);
    return () => window.clearInterval(t);
  }, [hash]);
  useEffect(() => {
    applySeoHead({
      title: "Prepaid Refill FAQ — CellPay Help & Answers",
      description:
        "Answers to the most common questions about CellPay prepaid refills: supported carriers, payment methods, delivery time, refunds, and account help.",
      path: "/faq",
      schema: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-extrabold text-foreground mb-6">Frequently Asked Questions</h1>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left font-bold text-foreground">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
      <div id="unsubscribe-autopay" style={{ scrollMarginTop: 80 }}>
        <HelpQuickActions />
      </div>
      <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
    </div>
  );
};

export default FAQ;
