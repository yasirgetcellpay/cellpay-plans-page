import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Phone, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";

/**
 * Generic long-form content block used by carrier pages that need
 * extended SEO copy (refill steps, supported plans, keyword-focused
 * headings, FAQ). Mirrors the pattern established by
 * CricketQuickPayContent for /topup-crc.html.
 */

export interface CarrierLongFormConfig {
  /** Page H2 + intro paragraph (keyword-anchored). */
  introH2: string;
  intro: string;
  /** "How to refill" heading + 4 step copy. */
  stepsH2: string;
  steps: { title: string; body: string }[];
  /** Supported plans heading + bullet list. */
  plansH2: string;
  plansIntro: string;
  plans: { name: string; description: string }[];
  /** FAQ heading + Q/A pairs. */
  faqH2: string;
  faqs: { q: string; a: string }[];
}

const STEP_ICONS = [Phone, DollarSign, CreditCard, CheckCircle2];

export const CarrierLongFormContent = ({
  brandColor,
  config,
  idPrefix,
}: {
  brandColor: string;
  config: CarrierLongFormConfig;
  idPrefix: string;
}) => {
  return (
    <>
      {/* Intro — single keyword-rich H2 */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-2">
        <h2 className="text-2xl font-extrabold text-foreground mb-3 text-left">
          {config.introH2}
        </h2>
        <p className="text-sm sm:text-base text-foreground leading-relaxed">
          {config.intro}
        </p>
      </section>

      {/* Step-by-step refill guide */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-4 text-left">
          {config.stepsH2}
        </h2>
        <ol className="space-y-3">
          {config.steps.map((s, i) => {
            const Icon = STEP_ICONS[i] || CheckCircle2;
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

      {/* Supported plans */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-3 text-left">
          {config.plansH2}
        </h2>
        <p className="text-sm sm:text-base text-foreground leading-relaxed mb-4">
          {config.plansIntro}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {config.plans.map((p) => (
            <li
              key={p.name}
              className="rounded-xl border border-border bg-card p-4 shadow-sm text-left"
            >
              <h3
                className="text-sm sm:text-base font-bold"
                style={{ color: brandColor }}
              >
                {p.name}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                {p.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Extended FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-2xl font-extrabold text-foreground mb-4 text-left">
          {config.faqH2}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {config.faqs.map((f, i) => (
            <AccordionItem key={i} value={`${idPrefix}-faq-${i}`}>
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

/** Build a FAQPage JSON-LD string from a long-form config's FAQ list. */
export const buildFaqSchema = (faqs: { q: string; a: string }[]): string =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

/* ───────── AT&T Prepaid ───────── */
export const ATT_PREPAID_CONFIG: CarrierLongFormConfig = {
  introH2: "AT&T Prepaid Refill — Pay Your AT&T Bill Online",
  intro:
    "Refill any AT&T Prepaid line in seconds with CellPay. No AT&T login, no app, no store visit — just enter the phone number, pick a plan or top-up amount, and pay with the card or wallet you already use. Your AT&T Prepaid service is restored instantly.",
  stepsH2: "How to Refill AT&T Prepaid in 4 Steps",
  steps: [
    {
      title: "Step 1 — Enter Your AT&T Prepaid Phone Number",
      body: "Type the 10-digit AT&T Prepaid number you want to refill. You don't need the account holder's password — CellPay refills any active AT&T Prepaid line.",
    },
    {
      title: "Step 2 — Choose an AT&T Plan or Custom Top-Up",
      body: "Pick from AT&T Prepaid's monthly plans ($30, $40, $50, $65, $75) or enter a custom airtime amount. Plans renew your service for 30 days; top-ups add balance to your existing AT&T account.",
    },
    {
      title: "Step 3 — Pay Securely With Card or Wallet",
      body: "Check out with debit, credit, Apple Pay, Google Pay, PayPal, Cash App, Klarna, or bank pay. Every AT&T Prepaid payment is encrypted and processed in real time.",
    },
    {
      title: "Step 4 — Instant AT&T Refill Confirmation",
      body: "Your AT&T Prepaid line is recharged within seconds. You'll get an email receipt and an SMS from AT&T confirming the new balance or plan renewal.",
    },
  ],
  plansH2: "Supported AT&T Prepaid Plans",
  plansIntro:
    "CellPay supports every current AT&T Prepaid monthly plan plus custom airtime top-ups. Prices shown are the standard 30-day retail price.",
  plans: [
    { name: "$30 — 5GB Plan", description: "Unlimited talk & text plus 5GB of high-speed data for 30 days." },
    { name: "$40 — 16GB Plan", description: "Unlimited talk & text plus 16GB of high-speed data, ideal for moderate users." },
    { name: "$50 — Unlimited Plan", description: "Unlimited talk, text & data with 5GB mobile hotspot for 30 days." },
    { name: "$65 — Unlimited Plus", description: "Unlimited talk, text & data, 15GB hotspot, and HD streaming." },
    { name: "$75 — Unlimited Max", description: "Unlimited everything with priority data, 25GB hotspot, and Mexico/Canada calling." },
    { name: "Custom Top-Up ($5–$300)", description: "Add airtime in any amount to your existing AT&T Prepaid balance." },
  ],
  faqH2: "AT&T Prepaid Refill FAQs",
  faqs: [
    {
      q: "How do I pay my AT&T Prepaid bill online without logging in?",
      a: "Use this AT&T Prepaid refill page on CellPay. Enter the AT&T phone number, choose a $30, $40, $50, $65, or $75 plan or a custom top-up, and pay with a card, Apple Pay, Google Pay, PayPal, or Cash App. No AT&T login required.",
    },
    {
      q: "How fast does an AT&T Prepaid refill post?",
      a: "Refills typically post within seconds of payment. AT&T sends an SMS to the refilled line as soon as the new plan or balance is active.",
    },
    {
      q: "Can I refill someone else's AT&T Prepaid line?",
      a: "Yes. You don't need to own the AT&T line. Enter the recipient's 10-digit AT&T Prepaid phone number and the refill applies to their account.",
    },
    {
      q: "What payment methods can I use for AT&T Prepaid?",
      a: "Visa, Mastercard, American Express, Discover, JCB, Diners, Apple Pay, Google Pay, PayPal, Cash App Pay, Klarna, and bank payment via Plaid.",
    },
    {
      q: "Are AT&T autopay discounts included?",
      a: "No. CellPay shows the standard retail 30-day price of each AT&T Prepaid plan. Autopay discounts only apply when you set autopay directly with AT&T.",
    },
    {
      q: "Will an AT&T Prepaid refill restore suspended service?",
      a: "Yes. Once AT&T processes the refill (usually within a minute), your line reactivates automatically.",
    },
    {
      q: "Is there a fee to refill AT&T Prepaid through CellPay?",
      a: "No hidden fees. You pay the same retail amount as you would at an AT&T store.",
    },
  ],
};

/* ───────── Straight Talk ───────── */
export const STRAIGHT_TALK_CONFIG: CarrierLongFormConfig = {
  introH2: "Straight Talk Refill — Pay Your Straight Talk Bill Online",
  intro:
    "Refill any Straight Talk Wireless phone in seconds with CellPay. Skip the Walmart line, the Straight Talk login, and the refill card scratch-off — just enter the phone number, pick a service plan, and pay with the card or wallet you already use. Your Straight Talk service is renewed instantly.",
  stepsH2: "How to Refill Straight Talk in 4 Steps",
  steps: [
    {
      title: "Step 1 — Enter Your Straight Talk Phone Number",
      body: "Type the 10-digit Straight Talk number you want to refill. No Straight Talk username or PIN required — CellPay refills any active Straight Talk line.",
    },
    {
      title: "Step 2 — Choose Your Straight Talk Service Plan",
      body: "Select a Straight Talk monthly plan ($35, $45, $55, $65) or one of the long-term plans (3-month, 6-month, 12-month). Each plan renews service for the full term you choose.",
    },
    {
      title: "Step 3 — Pay Securely With Card or Wallet",
      body: "Check out with debit, credit, Apple Pay, Google Pay, PayPal, Cash App, Klarna, or bank pay. Every Straight Talk payment is encrypted and processed in real time.",
    },
    {
      title: "Step 4 — Instant Straight Talk Refill Confirmation",
      body: "Your Straight Talk plan is applied within seconds. You'll get an email receipt and an SMS from Straight Talk confirming the new service period.",
    },
  ],
  plansH2: "Supported Straight Talk Service Plans",
  plansIntro:
    "CellPay supports every current Straight Talk Unlimited plan. Prices below are the standard retail price for the full service term.",
  plans: [
    { name: "$35 — Unlimited 30-Day", description: "Unlimited talk, text, and 10GB high-speed data plus 5GB hotspot." },
    { name: "$45 — Silver Unlimited", description: "Unlimited talk, text, and 25GB high-speed data with 10GB hotspot." },
    { name: "$55 — Gold Unlimited", description: "Unlimited talk, text, and unlimited high-speed data with 15GB hotspot." },
    { name: "$65 — Platinum Unlimited", description: "Unlimited everything with 20GB hotspot, international calling, and cloud storage." },
    { name: "3-Month Plan", description: "90 days of Straight Talk Unlimited service at a discounted long-term rate." },
    { name: "12-Month Plan", description: "A full year of Straight Talk service in a single payment — the best per-month value." },
  ],
  faqH2: "Straight Talk Refill FAQs",
  faqs: [
    {
      q: "How do I pay my Straight Talk bill online without logging in?",
      a: "Use this Straight Talk refill page on CellPay. Enter the Straight Talk phone number, choose a $35, $45, $55, or $65 plan (or a multi-month plan), and pay with a card, Apple Pay, Google Pay, PayPal, or Cash App. No Straight Talk login required.",
    },
    {
      q: "How fast does a Straight Talk refill post?",
      a: "Refills typically post within seconds. Straight Talk sends an SMS to the refilled line as soon as the new service period is active.",
    },
    {
      q: "Can I refill someone else's Straight Talk phone?",
      a: "Yes. You don't need to be the account holder. Enter the recipient's 10-digit Straight Talk number and the refill applies to their line.",
    },
    {
      q: "Do I need a Straight Talk refill card or PIN?",
      a: "No. CellPay charges your payment method directly and posts the refill to the phone number you enter — no scratch-off card or PIN needed.",
    },
    {
      q: "What payment methods can I use for Straight Talk?",
      a: "Visa, Mastercard, American Express, Discover, JCB, Diners, Apple Pay, Google Pay, PayPal, Cash App Pay, Klarna, and bank payment via Plaid.",
    },
    {
      q: "Will a Straight Talk refill restore suspended service?",
      a: "Yes. Once Straight Talk processes the refill, your line reactivates automatically — usually within a minute.",
    },
    {
      q: "Is there a fee to refill Straight Talk through CellPay?",
      a: "No hidden fees. You pay the full retail price of the Straight Talk plan — the same amount as Walmart or straighttalk.com.",
    },
  ],
};

/* ───────── Verizon Prepaid ───────── */
export const VERIZON_CONFIG: CarrierLongFormConfig = {
  introH2: "Verizon Prepaid Refill — Pay Your Verizon Bill Online",
  intro:
    "Refill any Verizon Prepaid phone in seconds with CellPay. No My Verizon login, no app, no store visit — just enter the phone number, pick a Verizon Prepaid plan, and pay with the card or wallet you already use. Your Verizon service is renewed instantly.",
  stepsH2: "How to Refill Verizon Prepaid in 4 Steps",
  steps: [
    {
      title: "Step 1 — Enter Your Verizon Prepaid Phone Number",
      body: "Type the 10-digit Verizon Prepaid number you want to refill. No My Verizon password required — CellPay refills any active Verizon Prepaid line.",
    },
    {
      title: "Step 2 — Choose Your Verizon Prepaid Plan",
      body: "Pick from Verizon Prepaid's monthly plans ($35, $45, $55, $65) or a custom top-up amount. Each plan renews your Verizon service for 30 days at the full retail price.",
    },
    {
      title: "Step 3 — Pay Securely With Card or Wallet",
      body: "Check out with debit, credit, Apple Pay, Google Pay, PayPal, Cash App, Klarna, or bank pay. Every Verizon Prepaid payment is encrypted and processed in real time.",
    },
    {
      title: "Step 4 — Instant Verizon Refill Confirmation",
      body: "Your Verizon Prepaid line is recharged within seconds. You'll get an email receipt and an SMS from Verizon confirming the new plan or balance.",
    },
  ],
  plansH2: "Supported Verizon Prepaid Plans",
  plansIntro:
    "CellPay supports every current Verizon Prepaid monthly plan and custom top-up. Prices below are the standard retail 30-day price.",
  plans: [
    { name: "$35 — 15GB Plan", description: "Unlimited talk & text plus 15GB of 5G/4G LTE high-speed data." },
    { name: "$45 — Unlimited Plan", description: "Unlimited talk, text & data on Verizon's 5G/4G LTE network." },
    { name: "$55 — Unlimited Plus", description: "Unlimited everything with mobile hotspot and unlimited Mexico/Canada talk & text." },
    { name: "$65 — Unlimited Premium", description: "Unlimited 5G Ultra Wideband, hotspot, and international calling." },
    { name: "Multi-Month & Loyalty Discounts", description: "Verizon Prepaid loyalty pricing kicks in automatically after 3, 9, and 12 on-time refills." },
    { name: "Custom Top-Up ($5–$300)", description: "Add airtime in any amount to your existing Verizon Prepaid balance." },
  ],
  faqH2: "Verizon Prepaid Refill FAQs",
  faqs: [
    {
      q: "How do I pay my Verizon Prepaid bill online without logging in?",
      a: "Use this Verizon Prepaid refill page on CellPay. Enter the Verizon phone number, choose a $35, $45, $55, or $65 plan or a custom top-up, and pay with a card, Apple Pay, Google Pay, PayPal, or Cash App. No My Verizon login required.",
    },
    {
      q: "How fast does a Verizon Prepaid refill post?",
      a: "Refills typically post within seconds of payment. Verizon sends an SMS to the refilled line as soon as the new plan is active.",
    },
    {
      q: "Can I refill someone else's Verizon Prepaid phone?",
      a: "Yes. You don't need to own the line. Enter the recipient's 10-digit Verizon Prepaid number and the refill applies to their account.",
    },
    {
      q: "What payment methods can I use for Verizon Prepaid?",
      a: "Visa, Mastercard, American Express, Discover, JCB, Diners, Apple Pay, Google Pay, PayPal, Cash App Pay, Klarna, and bank payment via Plaid.",
    },
    {
      q: "Do Verizon Prepaid autopay discounts apply on CellPay?",
      a: "No. CellPay shows the standard retail 30-day price. Verizon's autopay discount only applies when you enroll in autopay directly with Verizon.",
    },
    {
      q: "Will a Verizon Prepaid refill reactivate suspended service?",
      a: "Yes. Once Verizon processes the refill, your line reactivates automatically — usually within a minute.",
    },
    {
      q: "Is there a fee to refill Verizon Prepaid through CellPay?",
      a: "No hidden fees. You pay the same retail price as you would in a Verizon store or on the Verizon website.",
    },
  ],
};

export const ATT_FAQ_SCHEMA = buildFaqSchema(ATT_PREPAID_CONFIG.faqs);
export const STRAIGHT_TALK_FAQ_SCHEMA = buildFaqSchema(STRAIGHT_TALK_CONFIG.faqs);
export const VERIZON_FAQ_SCHEMA = buildFaqSchema(VERIZON_CONFIG.faqs);
