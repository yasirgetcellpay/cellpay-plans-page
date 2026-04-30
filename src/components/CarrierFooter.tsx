import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/contexts/AuthContext";

interface CarrierFooterProps {
  brandColor: string;
  carrierName: string;
  textOnBrand?: string;
}

export const CarrierFooter = ({ brandColor, carrierName, textOnBrand = "text-primary-foreground" }: CarrierFooterProps) => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <footer className="bg-cellpay-dark text-muted-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>Company</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => navigate("/about-us")} className="hover:text-primary-foreground">About Us</button></li>
                <li><button onClick={() => navigate("/contact-us")} className="hover:text-primary-foreground">Contact Us</button></li>
                <li><button onClick={() => navigate("/faq")} className="hover:text-primary-foreground">FAQ</button></li>
                <li><button onClick={() => navigate("/how-to-use")} className="hover:text-primary-foreground">How to Use</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>My Account</h5>
              <ul className="space-y-3 text-sm">
                {isLoggedIn ? (
                  <>
                    <li><button onClick={() => navigate("/profile")} className="hover:text-primary-foreground">My Profile</button></li>
                    <li><button onClick={() => navigate("/orders")} className="hover:text-primary-foreground">My Orders</button></li>
                  </>
                ) : (
                  <>
                    <li><button onClick={() => { setAuthMode("login"); setAuthOpen(true); }} className="hover:text-primary-foreground">Log In</button></li>
                    <li><button onClick={() => { setAuthMode("register"); setAuthOpen(true); }} className="hover:text-primary-foreground">Sign Up</button></li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>Legal</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => navigate("/privacy-policy")} className="hover:text-primary-foreground">Privacy Policy</button></li>
                <li><button onClick={() => navigate("/terms-and-conditions")} className="hover:text-primary-foreground">Terms &amp; Conditions</button></li>
                <li><button onClick={() => navigate("/returns-policy")} className="hover:text-primary-foreground">Returns &amp; Refunds Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-6 text-center">
            <p className="text-xs">© 2026 CellPay. All rights reserved.</p>
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">
              {carrierName}® and all carrier names, logos, and trademarks are the property of their respective owners and are referenced solely to identify the prepaid services for which CellPay processes payments. CellPay is an independent payment processor and is not affiliated with, endorsed by, or sponsored by {carrierName}.
            </p>
          </div>
        </div>
      </footer>
      <div className={`${textOnBrand} py-3 text-[10px] md:text-xs`} style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">
          All prices shown are full retail prices. Taxes and fees are additional and vary by location. Service plans are non-refundable.{" "}
          <a href="https://www.cellpay.us/terms-and-conditions.html" className="underline font-bold ml-1">[View full Terms &amp; Conditions]</a>
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </>
  );
};
