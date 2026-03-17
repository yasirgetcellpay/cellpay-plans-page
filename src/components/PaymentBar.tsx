export const PaymentBar = () => (
  <div className="bg-card py-8 border-t border-border">
    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
      <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">We Accept:</span>
      <div className="flex space-x-4 items-center">
        {/* Visa */}
        <svg className="h-8 w-12" viewBox="0 0 50 30">
          <rect width="50" height="30" rx="4" fill="#1434CB" />
          <text x="25" y="19" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">VISA</text>
        </svg>
        {/* Mastercard */}
        <svg className="h-8 w-12" viewBox="0 0 50 30">
          <rect width="50" height="30" rx="4" fill="#252525" />
          <circle cx="20" cy="15" r="9" fill="#EB001B" />
          <circle cx="30" cy="15" r="9" fill="#F79E1B" />
          <circle cx="25" cy="15" r="5.5" fill="#FF5F00" />
        </svg>
        {/* Amex */}
        <svg className="h-8 w-12" viewBox="0 0 50 30">
          <rect width="50" height="30" rx="4" fill="#006FCF" />
          <text x="25" y="19" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">AMEX</text>
        </svg>
        {/* Discover */}
        <svg className="h-8 w-12" viewBox="0 0 50 30">
          <rect width="50" height="30" rx="4" fill="#FFFFFF" stroke="#ccc" strokeWidth="1" />
          <text x="4" y="18" fill="#333" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">DISCOVER</text>
          <circle cx="40" cy="15" r="7" fill="#F76B1C" />
        </svg>
        {/* PayPal */}
        <svg className="h-8 w-12" viewBox="0 0 50 30">
          <rect width="50" height="30" rx="4" fill="#003087" />
          <text x="14" y="19" fill="#009CDE" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Pay</text>
          <text x="30" y="19" fill="#00B4E6" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Pal</text>
        </svg>
      </div>
    </div>
  </div>
);
