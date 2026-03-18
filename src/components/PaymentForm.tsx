import { useState, useCallback } from "react";
import { Phone } from "lucide-react";

interface Plan {
  price: string;
  label: string;
  description: string;
}

const plans: Plan[] = [
  { price: "$150", label: "Simple UN ILD RTR $150", description: "3-Month Plan — Unlimited Talk, Text & Data" },
  { price: "$60", label: "Unlimited World+", description: "Unlimited Talk, Text, Unlimited 5G Ultra Wideband" },
  { price: "$50", label: "Unlimited World", description: "Unlimited Talk, Text, Unlimited high-speed data" },
  { price: "$40", label: "30GB Plan", description: "Unlimited Talk, Text, 30GB high-speed" },
  { price: "$30", label: "20GB Plan", description: "Unlimited Talk, Text, 20GB high-speed" },
  { price: "$25", label: "15GB Plan", description: "Unlimited Talk, Text, 15GB high-speed" },
];

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const PaymentForm = () => {
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  return (
    <section className="max-w-[700px] mx-auto px-4 sm:px-6 pb-10">
      <div className="bg-card rounded-xl shadow-lg border border-border p-6 sm:p-8">
        {/* Step 1 — Phone Number */}
        <label className="block text-sm font-bold text-foreground mb-2">
          Enter Your Phone Number
        </label>
        <div className="relative mb-8">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="(XXX) XXX-XXXX"
            className="w-full h-12 pl-11 pr-4 rounded-lg border border-input bg-background text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* Step 2 — Plan Selection */}
        <label className="block text-sm font-bold text-foreground mb-4">
          Select Your Plan
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {plans.map((plan, i) => {
            const isSelected = selectedPlan === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedPlan(i)}
                className={`rounded-lg border-2 text-left overflow-hidden transition-all ${
                  isSelected
                    ? "border-cellpay-green"
                    : "border-border hover:border-cellpay-green/50"
                }`}
              >
                <div
                  className={`px-3 py-2 text-center font-extrabold text-lg ${
                    isSelected
                      ? "bg-cellpay-green text-primary-foreground"
                      : "bg-muted text-cellpay-green"
                  }`}
                >
                  {plan.price}
                </div>
                <div className="px-3 py-2">
                  <div className="font-bold text-xs text-foreground leading-tight">
                    {plan.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-1">
                    {plan.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step 3 — PAY NOW */}
        <button
          type="button"
          className="w-full h-[52px] rounded-lg bg-cellpay-green hover:bg-cellpay-green-hover text-primary-foreground font-bold text-lg transition-colors"
        >
          PAY NOW
        </button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Secure payment powered by CellPay. Instant refill sent directly to your phone.
        </p>
      </div>
    </section>
  );
};
