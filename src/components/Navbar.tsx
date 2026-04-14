import { useState } from "react";
import simpleMobileLogo from "@/assets/simple-mobile-logo.png";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "@/components/AuthDialog";
import { User, LogOut } from "lucide-react";

export const Navbar = () => {
  const { isLoggedIn, user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <img
              src={simpleMobileLogo}
              alt="Simple Mobile"
              className="w-[100px] sm:w-[140px]"
            />
            <div className="absolute right-0 flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[120px]">
                    {user?.first_name || user?.email}
                  </span>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    title="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Log In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
};
