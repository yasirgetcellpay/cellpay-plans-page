import { useState, useRef, useEffect } from "react";
import simpleMobileLogo from "@/assets/simple-mobile-logo.png";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, ChevronDown } from "lucide-react";

export const Navbar = () => {
  const { isLoggedIn, user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex justify-center h-14 sm:h-20 items-center">
          <BackButton />
          <img
            src={simpleMobileLogo}
            alt="Simple Mobile"
            className="w-[100px] sm:w-[140px]"
          />
          {isLoggedIn && (
            <div className="absolute right-0" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((p) => !p)}
                className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline truncate max-w-[100px]">
                  {user?.first_name || "Account"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-md shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { logout(); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
