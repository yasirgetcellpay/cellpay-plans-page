import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";
import simpleMobileLogo from "@/assets/simple-mobile-logo.png";

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
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

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  <User className="inline w-4 h-4 mr-1" />
                  {user?.first_name || user?.email}
                </span>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-5 py-2 rounded-full text-sm font-semibold text-primary-foreground transition-colors"
                style={{
                  background: "linear-gradient(135deg, hsl(0 72% 55%), hsl(15 80% 55%))",
                }}
              >
                LOGIN
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
