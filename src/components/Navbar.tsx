import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";
import { AuthDialogs } from "@/components/AuthDialogs";

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

  return (
    <>
      {/* Top utility bar — matching cellpay.us reference */}
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

      {/* Auth dialogs */}
      <AuthDialogs
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitchMode={setAuthMode}
      />
    </>
  );
};
