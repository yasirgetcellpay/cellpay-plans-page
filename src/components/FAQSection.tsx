import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Where Can I Pay My Simple Mobile Bill?",
    a: "You can pay your Simple Mobile bill instantly online through CellPay, available 24/7. No login required for guest payments.",
  },
  {
    q: "How Do I Pay My Simple Mobile Bill Through CellPay?",
    a: "Simply enter your Simple Mobile phone number above, select your plan amount, and click PAY NOW. Your account will be recharged instantly.",
  },
];

export const FAQSection = () => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <h2 className="text-2xl font-extrabold text-foreground mb-4 text-center">
      Simple Mobile FAQs
    </h2>
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="text-left font-bold text-foreground">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);
