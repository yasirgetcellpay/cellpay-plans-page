import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Phone, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";

/**
 * Cricket-specific long-form content for /topup-crc.html.
 * Designed to lift the page from position 2 → 1 for "cricket quick pay":
 *  - Keyword-rich H2/H3 copy
 *  - Step-by-step payment guide (HowTo-friendly markup)
 *  - Expanded FAQ section targeting related queries
 */
export const CricketQuickPayContent = ({ brandColor }: { brandColor: string }) => {
  const steps = [
    {
      icon: Phone,
      title: "Step 1 — Enter Your Cricket Phone Number",
      body:
        "Type the 10-digit Cricket Wireless number you want to refill. No login or Cricket account password is required — CellPay is a Cricket quick pay shortcut that works for any active Cricket prepaid line.",
    },
    {
      icon: DollarSign,
      title: "Step 2 — Choose Your Refill Amount or Plan",
      body:
        "Pick from Cricket's standard monthly plans ($30, $40, $55, $60) or enter a custom top-up amount between $5 and $250. Plans renew your service for 30 days; top-ups add airtime to your existing balance.",
    },
    {
      icon: CreditCard,
      title: "Step 3 — Pay Securely With Any Card or Wallet",
      body:
        "Check out in seconds with debit, credit, Apple Pay, Google Pay, PayPal, Cash App, Klarna, or your bank account. Every Cricket quick pay transaction is encrypted and processed in real time.",
    },
    {
      icon: CheckCircle2,
      title: "Step 4 — Instant Refill, Instant Confirmation",
      body:
        "Your Cricket line is recharged within seconds. You'll receive an email receipt and an SMS from Cricket confirming the new balance or plan renewal — usually before you close the tab.",
    },
  ];

  const faqs = [
    {
      q: "What is Cricket Quick Pay?",
      a: "Cricket Quick Pay is the fastest way to pay your Cricket Wireless bill online without signing into your Cricket account. On CellPay, just enter your phone number, pick an amount, and pay — your refill posts to your line instantly.",
    },
    {
      q: "How do I pay my Cricket bill online without logging in?",
      a: "Use this Cricket Wireless quick pay page. Type the Cricket phone number you want to refill, choose a $30, $40, $55, or $60 plan (or a custom top-up amount), and complete payment with a card, Apple Pay, Google Pay, PayPal, or Cash App. No Cricket username or password needed.",
    },
    {
      q: "How long does a Cricket quick pay refill take?",
      a: "Refills are applied within seconds of payment. Cricket usually sends an SMS confirmation to the refilled phone number once your new plan is active.",
    },
    {
      q: "What payment methods can I use for Cricket Wireless?",
      a: "CellPay accepts Visa, Mastercard, American Express, Discover, JCB, Diners, Apple Pay, Google Pay, PayPal, Cash App Pay, Klarna, and direct bank payment via Plaid.",
    },
    {
      q: "Can I pay someone else's Cricket bill?",
      a: "Yes. You don't need to own the Cricket line to use Cricket Quick Pay on CellPay. Just enter the recipient's 10-digit Cricket phone number and the refill will apply to their account.",
    },
    {
      q: "What Cricket Wireless plans can I pay for here?",
      a: "All current Cricket prepaid plans, including the $30 Unlimited Talk & Text + 5GB, $40 Unlimited 10GB, $55 Unlimited Smartphone, and $60 Unlimited + 15GB hotspot plan. You can also add airtime in any custom amount from $5 to $250.",
    },
    {
      q: "Is there a fee to use Cricket Quick Pay on CellPay?",
      a: "No hidden fees. You pay the full retail price of the Cricket plan or top-up — the same amount you'd pay at a Cricket store.",
    },
    {
      q: "Will Cricket Quick Pay restore my service if it's suspended?",
      a: "Yes. Paying your Cricket bill through CellPay reactivates your line as soon as Cricket processes the refill, typically within a minute.",
    },
  ];

  // FAQPage JSON-LD for richer search snippets is emitted from DynamicCarrier
  // alongside the API schema via applySeoHead's schemaSecondary slot.
  return (
    <>
      {/* Intro paragraph — keyword-anchored, single H2 about Cricket Quick Pay */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-2">
        <h2 className="text-2xl font-extrabold text-foreground mb-3 text-left">
          Cricket Quick Pay — Refill Your Cricket Wireless Bill Online
        </h2>
        <p className="text-sm sm:text-base text-foreground leading-relaxed">
          CellPay's Cricket Quick Pay lets you refill any Cricket Wireless prepaid
          line in under 60 seconds — no Cricket login, no app download, no waiting
          in line at a store. Just enter the Cricket phone number, choose a plan
          or custom top-up amount, and pay with the card or wallet you already use.
          Your Cricket service is restored instantly.
        </p>
      </section>

      {/* Step-by-step payment guide */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-4 text-left">
          How to Pay Your Cricket Bill in 4 Steps
        </h2>
        <ol className="space-y-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className="flex gap-3 sm:gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div
                  className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground"
                  style={{ backgroundColor: brandColor }}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Extended FAQ — Cricket-specific */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-2xl font-extrabold text-foreground mb-4 text-left">
          Cricket Quick Pay FAQs
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`crc-faq-${i}`}>
              <AccordionTrigger
                className="text-left font-bold text-foreground"
                style={{ color: brandColor }}
              >
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
};

/** FAQPage JSON-LD payload that mirrors the on-page FAQ above. */
export const CRICKET_QUICK_PAY_FAQ_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Cricket Quick Pay?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cricket Quick Pay is the fastest way to pay your Cricket Wireless bill online without signing into your Cricket account. On CellPay, just enter your phone number, pick an amount, and pay — your refill posts to your line instantly.",
      },
    },
    {
      "@type": "Question",
      name: "How do I pay my Cricket bill online without logging in?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use the Cricket Wireless quick pay page on CellPay. Enter the Cricket phone number, choose a $30, $40, $55, or $60 plan or a custom top-up, and pay with a card, Apple Pay, Google Pay, PayPal, or Cash App. No Cricket login required.",
      },
    },
    {
      "@type": "Question",
      name: "How long does a Cricket quick pay refill take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Refills are applied within seconds of payment, and Cricket sends an SMS confirmation to the refilled line as soon as the new plan is active.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods can I use for Cricket Wireless?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "CellPay accepts Visa, Mastercard, American Express, Discover, JCB, Diners, Apple Pay, Google Pay, PayPal, Cash App Pay, Klarna, and bank payment via Plaid.",
      },
    },
    {
      "@type": "Question",
      name: "Can I pay someone else's Cricket bill?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You don't have to own the Cricket line. Enter the recipient's 10-digit Cricket phone number and the refill applies to their account.",
      },
    },
    {
      "@type": "Question",
      name: "What Cricket Wireless plans can I pay for here?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All current Cricket prepaid plans, including $30 Unlimited Talk & Text + 5GB, $40 Unlimited 10GB, $55 Unlimited Smartphone, and $60 Unlimited + 15GB hotspot. Custom top-ups from $5 to $250 are also supported.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a fee to use Cricket Quick Pay on CellPay?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No hidden fees. You pay the full retail price of the Cricket plan or top-up — the same amount you'd pay at a Cricket store.",
      },
    },
    {
      "@type": "Question",
      name: "Will Cricket Quick Pay restore my service if it's suspended?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Paying through CellPay reactivates your Cricket line as soon as Cricket processes the refill, typically within a minute.",
      },
    },
  ],
});
