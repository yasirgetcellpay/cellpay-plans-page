import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "What is CellPay?", a: "CellPay is an online platform that lets you instantly recharge prepaid wireless accounts for major U.S. carriers like AT&T, T-Mobile, Verizon, Cricket, Metro, Boost, and more." },
  { q: "How does CellPay work?", a: "Simply select your carrier, enter your phone number, choose a plan or amount, and complete your payment. Your account will be recharged instantly." },
  { q: "Which carriers does CellPay support?", a: "We support 15+ major prepaid carriers including AT&T, T-Mobile, Verizon, Cricket Wireless, Metro by T-Mobile, Boost Mobile, Straight Talk, TracFone, H2O Wireless, Lyca Mobile, Net10, Page Plus, Ultra Mobile, and US Cellular." },
  { q: "Is CellPay safe and secure?", a: "Yes. We use industry-standard encryption and secure payment processing. Your financial information is never stored on our servers." },
  { q: "How long does a refill take?", a: "Most refills are processed instantly. In rare cases, it may take up to 5 minutes for the carrier to apply the credit to your account." },
  { q: "What payment methods do you accept?", a: "We accept Visa, Mastercard, American Express, Discover, and Apple Pay." },
  { q: "Do I need to create an account?", a: "No, you can recharge as a guest. However, creating an account lets you track your order history and speeds up future transactions." },
  { q: "Can I get a refund?", a: "Once a refill is processed, it cannot be reversed. Please double-check your phone number and plan before confirming. See our Returns & Refunds Policy for more details." },
  { q: "I didn't receive my refill. What should I do?", a: "First, wait 5 minutes and check your account balance. If the credit hasn't been applied, contact us at support@getcellpay.com with your transaction details." },
  { q: "Is CellPay affiliated with any carrier?", a: "No. CellPay is an independent authorized payment processor. All carrier names and trademarks are property of their respective owners." },
];

const FAQ = () => {
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
      <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
    </div>
  );
};

export default FAQ;
