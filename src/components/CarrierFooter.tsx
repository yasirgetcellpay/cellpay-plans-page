import { useState } from "react";
import { AuthDialog } from "@/components/AuthDialog";

interface CarrierFooterProps {
  brandColor: string;
  carrierName: string;
  textOnBrand?: string;
}

export const CarrierFooter = ({ brandColor, carrierName, textOnBrand = "text-primary-foreground" }: CarrierFooterProps) => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  return (
    <>
      <footer className="bg-cellpay-dark text-muted-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>Company</h5>
              <ul className="space-y-3 text-sm">
                <li><a href="https://www.cellpay.us/about-us/" className="hover:text-primary-foreground">About Us</a></li>
                <li><a href="https://www.cellpay.us/contact-us.html" className="hover:text-primary-foreground">Contact Us</a></li>
                <li><a href="https://www.cellpay.us/faq" className="hover:text-primary-foreground">FAQ</a></li>
                <li><a href="https://www.cellpay.us/how-to-use/" className="hover:text-primary-foreground">How to Use</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>My Account</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => { setAuthMode("login"); setAuthOpen(true); }} className="hover:text-primary-foreground">Log In</button></li>
                <li><button onClick={() => { setAuthMode("register"); setAuthOpen(true); }} className="hover:text-primary-foreground">Sign Up</button></li>
                <li><a href="/" className="hover:text-primary-foreground">Recharge Now</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Check Balance</a></li>
                <li><a href="#" className="hover:text-primary-foreground">Auto Recharge</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>Legal</h5>
              <ul className="space-y-3 text-sm">
                <li><a href="https://www.cellpay.us/privacy-policy.html" className="hover:text-primary-foreground">Privacy Policy</a></li>
                <li><a href="https://www.cellpay.us/terms-and-conditions.html" className="hover:text-primary-foreground">Terms &amp; Conditions</a></li>
                <li><a href="https://www.cellpay.us/returns-and-refunds-policy.html/" className="hover:text-primary-foreground">Returns &amp; Refunds Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-6 text-center">
            <p className="text-xs">© 2026 CellPay. All rights reserved.</p>
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">
              {carrierName}® is a registered trademark of its respective owner. All carrier names and trademarks are property of their respective owners. CellPay is not affiliated with {carrierName}.
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
