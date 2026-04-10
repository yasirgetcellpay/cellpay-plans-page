import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Menu, X } from "lucide-react";
import { AuthDialogs } from "@/components/AuthDialogs";
import cellpayLogo from "@/assets/cellpay-logo.webp";

const NAV_LINKS = [
  { label: "Domestic Payments", href: "/" },
  { label: "Bill Payments", href: "#" },
  { label: "International Topups", href: "#" },
  { label: "SIM Cards", href: "#" },
  { label: "Postpaid", href: "#" },
  { label: "Promotions", href: "#" },
  { label: "Accessories", href: "#" },
];

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Top utility bar */}
      <div className="w-full border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-10">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Pay By Phone :{" "}
              <a href="tel:2566676054" className="underline text-foreground">
                256 667 6054
              </a>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:flex text-sm text-muted-foreground items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {user?.first_name || user?.email}
                </span>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthMode("login")}
                className="px-6 py-1.5 rounded text-sm font-bold text-primary-foreground"
                style={{ background: "hsl(0 72% 55%)" }}
              >
                LOGIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main navbar — dark teal like cellpay.us */}
      <nav className="sticky top-0 z-50 shadow-sm bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img
              src={cellpayLogo}
              alt="CellPay"
              className="h-8 sm:h-10"
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-3 py-2 text-sm font-medium transition-colors rounded ${
                  location.pathname === link.href && link.href !== "#"
                    ? "text-primary-foreground bg-white/15"
                    : "text-primary-foreground/85 hover:text-primary-foreground hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-primary-foreground p-1"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile nav menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 pb-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-6 py-3 text-sm font-medium text-primary-foreground/85 hover:text-primary-foreground hover:bg-white/10 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Auth dialogs */}
      <AuthDialogs
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitchMode={setAuthMode}
      />
    </>
  );
};
