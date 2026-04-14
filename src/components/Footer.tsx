import { useState } from "react";
import { AuthDialog } from "@/components/AuthDialog";

interface FooterProps {
  onLoginClick?: () => void;
  onSignupClick?: () => void;
}

export const Footer = ({ onLoginClick, onSignupClick }: FooterProps) => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

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
                <li><a href="https://www.cellpay.us/about-us/" className="hover:text-primary-foreground">About Us</a></li>
                <li><a href="https://www.cellpay.us/contact-us.html" className="hover:text-primary-foreground">Contact Us</a></li>
                <li><a href="https://www.cellpay.us/faq" className="hover:text-primary-foreground">FAQ</a></li>
                <li><a href="https://www.cellpay.us/how-to-use/" className="hover:text-primary-foreground">How to Use</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">My Account</h5>
              <ul className="space-y-4 text-sm">
                <li><button onClick={handleLogin} className="hover:text-primary-foreground">Log In</button></li>
                <li><button onClick={handleSignup} className="hover:text-primary-foreground">Sign Up</button></li>
                <li><a href="/" className="hover:text-primary-foreground">Recharge Now</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Check Balance</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Auto Recharge</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">Legal</h5>
              <ul className="space-y-4 text-sm">
                <li><a href="https://www.cellpay.us/privacy-policy.html" className="hover:text-primary-foreground">Privacy Policy</a></li>
                <li><a href="https://www.cellpay.us/terms-and-conditions.html" className="hover:text-primary-foreground">Terms &amp; Conditions</a></li>
                <li><a href="https://www.cellpay.us/returns-refunds-policy.html" className="hover:text-primary-foreground">Returns &amp; Refunds Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-8 text-center">
            <p className="text-xs mb-4">
              © 2026 CellPay. All rights reserved. |{" "}
              <a href="https://www.cellpay.us/privacy-policy.html" className="hover:text-primary-foreground">Privacy Policy</a> |{" "}
              <a href="https://www.cellpay.us/terms-and-conditions.html" className="hover:text-primary-foreground">Terms &amp; Conditions</a> |{" "}
              <a href="https://www.cellpay.us/contact-us.html" className="hover:text-primary-foreground">Contact Us</a>
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
