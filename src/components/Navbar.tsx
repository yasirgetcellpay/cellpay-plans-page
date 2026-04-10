import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";
import { AuthDialogs } from "@/components/AuthDialogs";
import simpleMobileLogo from "@/assets/simple-mobile-logo.png";

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  return (
    <>
      {/* Top utility bar — matches cellpay.us */}
      <div className="w-full bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end items-center h-9">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
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
            </div>
          ) : (
            <button
              onClick={() => setAuthMode("login")}
              className="px-5 py-1 rounded text-sm font-bold text-primary-foreground"
              style={{ background: "hsl(0 72% 55%)" }}
            >
              LOGIN
            </button>
          )}
        </div>
      </div>

      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-20 items-center">
            <Link to="/">
              <img
                src={simpleMobileLogo}
                alt="Simple Mobile"
                className="w-[100px] sm:w-[140px]"
              />
            </Link>
          </div>
        </div>
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
