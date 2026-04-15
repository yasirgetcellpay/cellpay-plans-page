import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";

const steps = [
  { num: "1", title: "Choose Your Carrier", desc: "Browse our home page and select your prepaid wireless carrier from the list of supported providers." },
  { num: "2", title: "Enter Your Phone Number", desc: "Type in the 10-digit phone number associated with your prepaid account. Make sure it's correct — refills cannot be reversed." },
  { num: "3", title: "Select a Plan or Amount", desc: "Choose from available plans or enter a custom top-up amount. Pricing is shown upfront with no hidden fees." },
  { num: "4", title: "Complete Payment", desc: "Pay securely using your credit/debit card or Apple Pay. Your payment is processed through our encrypted payment gateway." },
  { num: "5", title: "Instant Recharge", desc: "Your prepaid account is topped up instantly. You'll receive a confirmation with your transaction details." },
];

const HowToUse = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">How to Use CellPay</h1>
      <p className="text-muted-foreground mb-8">Recharging your prepaid phone is quick and easy. Follow these simple steps:</p>
      <div className="space-y-6">
        {steps.map((s) => (
          <div key={s.num} className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              {s.num}
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">{s.title}</h3>
              <p className="text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-3">Tips</h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Double-check your phone number before paying — refills are non-reversible.</li>
          <li>Create an account to track your orders and speed up future refills.</li>
          <li>Contact us at support@cellpay.us if you experience any issues.</li>
        </ul>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
  </div>
);

export default HowToUse;
