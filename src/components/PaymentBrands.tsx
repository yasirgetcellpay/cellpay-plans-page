// Inline SVG brand marks for payment methods.
// UI-only — used in place of generic icons on the checkout page.

type IconProps = { className?: string };

export const VisaMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 16" className={className} aria-label="Visa" role="img">
    <rect width="48" height="16" rx="2" fill="#1A1F71" />
    <text x="24" y="12" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fontStyle="italic" fill="#fff">VISA</text>
  </svg>
);

export const MastercardMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 32 20" className={className} aria-label="Mastercard" role="img">
    <circle cx="12" cy="10" r="7" fill="#EB001B" />
    <circle cx="20" cy="10" r="7" fill="#F79E1B" />
    <path d="M16 5.2a7 7 0 010 9.6 7 7 0 010-9.6z" fill="#FF5F00" />
  </svg>
);

export const AmexMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 16" className={className} aria-label="American Express" role="img">
    <rect width="48" height="16" rx="2" fill="#1F72CD" />
    <text x="24" y="11" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="7" fill="#fff">AMEX</text>
  </svg>
);

export const DiscoverMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 16" className={className} aria-label="Discover" role="img">
    <rect width="48" height="16" rx="2" fill="#fff" stroke="#e5e7eb" />
    <text x="20" y="11" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="7" fill="#000">DISC</text>
    <circle cx="38" cy="8" r="4" fill="#FF6000" />
  </svg>
);

// Combined card brands strip (used for the "Credit Card" tile)
export const CardBrandsStrip = ({ className }: IconProps) => (
  <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
    <VisaMark className="h-3.5 w-auto" />
    <MastercardMark className="h-3.5 w-auto" />
    <AmexMark className="h-3.5 w-auto" />
    <DiscoverMark className="h-3.5 w-auto" />
  </span>
);

export const PayPalMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 64 16" className={className} aria-label="PayPal" role="img">
    <text x="0" y="12" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="13" fontStyle="italic" fill="#003087">Pay</text>
    <text x="22" y="12" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="13" fontStyle="italic" fill="#009cde">Pal</text>
  </svg>
);

export const ApplePayMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 20" className={className} aria-label="Apple Pay" role="img">
    <rect width="48" height="20" rx="4" fill="#000" />
    <path d="M11.4 7.1c-.4.5-1 .9-1.6.8-.1-.6.2-1.3.6-1.7.4-.5 1.1-.8 1.6-.9.1.7-.2 1.3-.6 1.8zm.6.9c-.9-.1-1.6.5-2 .5s-1-.5-1.7-.5c-.9 0-1.7.5-2.1 1.3-.9 1.6-.2 4 .7 5.3.4.6.9 1.3 1.6 1.3.6 0 .9-.4 1.7-.4s1 .4 1.7.4c.7 0 1.2-.6 1.6-1.3.5-.7.7-1.4.7-1.5-.1 0-1.4-.5-1.4-2.1 0-1.3 1.1-1.9 1.1-2-.6-.9-1.5-1-1.9-1z" fill="#fff"/>
    <text x="17" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#fff">Pay</text>
  </svg>
);

export const GooglePayMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 56 20" className={className} aria-label="Google Pay" role="img">
    <rect width="56" height="20" rx="4" fill="#fff" stroke="#dadce0" />
    <text x="4" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#5f6368">G</text>
    <text x="11" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#ea4335">o</text>
    <text x="17" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#fbbc04">o</text>
    <text x="23" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#4285f4">g</text>
    <text x="29" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#34a853">l</text>
    <text x="32" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#ea4335">e</text>
    <text x="40" y="14" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#5f6368">Pay</text>
  </svg>
);

export const KlarnaMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 56 20" className={className} aria-label="Klarna" role="img">
    <rect width="56" height="20" rx="4" fill="#FFA8CD" />
    <text x="28" y="14" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#0A0A0A">Klarna.</text>
  </svg>
);

export const CashAppMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" className={className} aria-label="Cash App" role="img">
    <rect width="20" height="20" rx="4" fill="#00D632" />
    <text x="10" y="14.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="13" fill="#fff">$</text>
  </svg>
);

export const BankMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-label="Bank" role="img" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
  </svg>
);
