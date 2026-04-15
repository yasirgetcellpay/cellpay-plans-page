import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/contexts/AuthContext";

interface FooterProps {
  onLoginClick?: () => void;
  onSignupClick?: () => void;
}

export const Footer = ({ onLoginClick, onSignupClick }: FooterProps) => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    if (onLoginClick) { onLoginClick(); return; }
    setAuthMode("login");
    setAuthOpen(true);
  };

  const handleSignup = () => {
    if (onSignupClick) { onSignupClick(); return; }
    setAuthMode("register");
    setAuthOpen(true);
  };

  return (
    <>
      <footer className="bg-cellpay-dark text-muted-foreground py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">Company</h5>
              <ul className="space-y-4 text-sm">
                <li><button onClick={() => navigate("/about-us")} className="hover:text-primary-foreground">About Us</button></li>
                <li><button onClick={() => navigate("/contact-us")} className="hover:text-primary-foreground">Contact Us</button></li>
                <li><button onClick={() => navigate("/faq")} className="hover:text-primary-foreground">FAQ</button></li>
                <li><button onClick={() => navigate("/how-to-use")} className="hover:text-primary-foreground">How to Use</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">My Account</h5>
              <ul className="space-y-4 text-sm">
                {isLoggedIn ? (
                  <>
                    <li><button onClick={() => navigate("/profile")} className="hover:text-primary-foreground">My Profile</button></li>
                    <li><button onClick={() => navigate("/orders")} className="hover:text-primary-foreground">My Orders</button></li>
                  </>
                ) : (
                  <>
                    <li><button onClick={handleLogin} className="hover:text-primary-foreground">Log In</button></li>
                    <li><button onClick={handleSignup} className="hover:text-primary-foreground">Sign Up</button></li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">Legal</h5>
              <ul className="space-y-4 text-sm">
                <li><button onClick={() => navigate("/privacy-policy")} className="hover:text-primary-foreground">Privacy Policy</button></li>
                <li><button onClick={() => navigate("/terms-and-conditions")} className="hover:text-primary-foreground">Terms &amp; Conditions</button></li>
                <li><button onClick={() => navigate("/returns-policy")} className="hover:text-primary-foreground">Returns &amp; Refunds Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-8 text-center">
            <p className="text-xs mb-4">
              © 2026 CellPay. All rights reserved. |{" "}
              <button onClick={() => navigate("/privacy-policy")} className="hover:text-primary-foreground">Privacy Policy</button> |{" "}
              <button onClick={() => navigate("/terms-and-conditions")} className="hover:text-primary-foreground">Terms &amp; Conditions</button> |{" "}
              <button onClick={() => navigate("/contact-us")} className="hover:text-primary-foreground">Contact Us</button>
            </p>
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50">
              CellPay is an authorized payment processor for Simple Mobile services. Simple Mobile® is a registered trademark of Simple Mobile / Verizon Value. CellPay is not affiliated with Simple Mobile or Verizon. All carrier names and trademarks are property of their respective owners and are referenced solely to identify the services for which CellPay processes payments.
            </p>
          </div>
        </div>
      </footer>
      {!onLoginClick && <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />}
    </>
  );
};
