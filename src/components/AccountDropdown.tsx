import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, ShoppingBag, User, UserCog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
export const AccountDropdown = () => {
  const { isLoggedIn, user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (!isLoggedIn) {
    return null;
  }

  const handleNavigate = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate("/");
  };

  return (
    <>
      <div className="absolute right-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((open) => !open)}
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
              <p className="text-sm font-semibold text-foreground truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>

            <div className="py-1">
              <button
                onClick={() => handleNavigate("/profile")}
                className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-3"
              >
                <UserCog className="h-4 w-4 text-muted-foreground" />
                My Profile
              </button>
              <button
                onClick={() => handleNavigate("/orders")}
                className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-3"
              >
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                My Orders
              </button>
            </div>

            <div className="border-t border-border py-1">
              <button
                onClick={handleLogoutClick}
                className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-3"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-foreground">Confirm Logout</h2>
            <p className="text-sm text-muted-foreground mt-2">Are you sure you want to log out of your account?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};