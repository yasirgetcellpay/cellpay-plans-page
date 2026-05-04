import { t, type Language } from "@/lib/i18n";

export const PaymentBar = ({ lang = "en" }: { lang?: Language }) => {
  const tr = t(lang);
  return (
  <div className="bg-card py-8 border-t border-border">
    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
      <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">{tr.weAccept}</span>
      <div className="flex items-center space-x-4">
        <svg className="h-8 w-12" viewBox="0 0 50 30" aria-label="Visa">
          <rect width="50" height="30" rx="4" fill="hsl(var(--payment-visa))" />
          <text x="25" y="19" textAnchor="middle" fill="hsl(var(--primary-foreground))" fontSize="11" fontWeight="bold" fontFamily="sans-serif">VISA</text>
        </svg>
        <svg className="h-8 w-12" viewBox="0 0 50 30" aria-label="Mastercard">
          <rect width="50" height="30" rx="4" fill="hsl(var(--payment-mastercard-bg))" />
          <circle cx="20" cy="15" r="9" fill="hsl(var(--payment-mastercard-red))" />
          <circle cx="30" cy="15" r="9" fill="hsl(var(--payment-mastercard-orange))" />
          <circle cx="25" cy="15" r="5.5" fill="hsl(var(--payment-mastercard-center))" />
        </svg>
        <svg className="h-8 w-12" viewBox="0 0 50 30" aria-label="American Express">
          <rect width="50" height="30" rx="4" fill="hsl(var(--payment-amex))" />
          <text x="25" y="19" textAnchor="middle" fill="hsl(var(--primary-foreground))" fontSize="8" fontWeight="bold" fontFamily="sans-serif">AMEX</text>
        </svg>
        <svg className="h-7 w-[93px]" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg" aria-label="Discover">
          <rect width="200" height="60" rx="6" fill="#fff" stroke="#ddd"/>
          <text x="20" y="38" fontFamily="Arial" fontSize="15" fill="#231F20" fontWeight="800">DISCOVER</text>
          <circle cx="170" cy="30" r="20" fill="#F76F20"/>
        </svg>
        <svg className="h-8 w-14" viewBox="0 0 56 30" aria-label="PayPal">
          <rect width="56" height="30" rx="4" fill="hsl(var(--payment-paypal-dark))" />
          <text x="12" y="19" fill="hsl(var(--payment-paypal-light))" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Pay</text>
          <text x="29" y="19" fill="hsl(var(--primary-foreground))" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Pal</text>
        </svg>
      </div>
    </div>
  </div>
  );
};
