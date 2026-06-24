import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, ChevronDown, ShoppingBag, UserCog } from "lucide-react";
import cellpayLogo from "@/assets/cellpay-logo.svg";

export const Navbar = () => {
  const { isLoggedIn, user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNav = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  return (
    <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex justify-center h-14 sm:h-20 items-center">
          <BackButton />
          <a href="/" aria-label="CellPay home" className="flex items-center">
            <img src={cellpayLogo} alt="CellPay" className="h-8 sm:h-11 w-auto object-contain" />
          </a>
          {isLoggedIn && (
            <div className="absolute right-0" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((p) => !p)}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="hidden sm:inline truncate max-w-[100px]">
                  {user?.first_name || "Account"}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl py-0 z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-muted/40 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => handleNav("/profile")}
                      className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-3"
                    >
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      My Profile
                    </button>
                    <button
                      onClick={() => handleNav("/orders")}
                      className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-3"
                    >
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      My Orders
                    </button>
                  </div>
                  <div className="border-t border-border py-1">
                    <button
                      onClick={() => { logout(); setDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-3"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
