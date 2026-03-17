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
          <rect width="50" height="30" rx="4" fill="#FFFFFF" stroke="#ccc" />
          <circle cx="32" cy="15" r="8" fill="#F76B1C" />
          <text x="18" y="18" textAnchor="middle" fill="#333" fontSize="7" fontWeight="bold" fontFamily="sans-serif">DISC</text>
        </svg>
        {/* PayPal */}
        <svg className="h-8 w-12" viewBox="0 0 50 30">
          <rect width="50" height="30" rx="4" fill="#003087" />
          <text x="25" y="18" textAnchor="middle" fill="#009CDE" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Pay</text>
          <text x="25" y="18" textAnchor="middle" fill="#012169" fontSize="9" fontWeight="bold" fontFamily="sans-serif" dx="11">Pal</text>
        </svg>
      </div>
    </div>
  </div>
);
