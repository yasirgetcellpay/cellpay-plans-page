import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/contexts/AuthContext";
import { t, type Language } from "@/lib/i18n";

interface CarrierFooterProps {
  brandColor: string;
  carrierName: string;
  textOnBrand?: string;
  lang?: Language;
}

export const CarrierFooter = ({ brandColor, carrierName, textOnBrand = "text-primary-foreground", lang = "en" }: CarrierFooterProps) => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const tr = t(lang);

  return (
    <>
      <footer className="bg-cellpay-dark text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>{tr.company}</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => navigate("/about-us")} className="hover:text-primary-foreground">{tr.aboutUs}</button></li>
                <li><button onClick={() => navigate("/contact-us")} className="hover:text-primary-foreground">{tr.contactUs}</button></li>
                <li><button onClick={() => navigate("/faq")} className="hover:text-primary-foreground">{tr.faq}</button></li>
                <li><button onClick={() => navigate("/how-to-use")} className="hover:text-primary-foreground">{tr.howToUse}</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>{tr.myAccount}</h5>
              <ul className="space-y-3 text-sm">
                {isLoggedIn ? (
                  <>
                    <li><button onClick={() => navigate("/profile")} className="hover:text-primary-foreground">{tr.myProfile}</button></li>
                    <li><button onClick={() => navigate("/orders")} className="hover:text-primary-foreground">{tr.myOrders}</button></li>
                  </>
                ) : (
                  <>
                    <li><button onClick={() => { setAuthMode("login"); setAuthOpen(true); }} className="hover:text-primary-foreground">{tr.logIn}</button></li>
                    <li><button onClick={() => { setAuthMode("register"); setAuthOpen(true); }} className="hover:text-primary-foreground">{tr.signUp}</button></li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-5 uppercase tracking-widest text-sm" style={{ color: brandColor }}>{tr.legal}</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => navigate("/privacy-policy")} className="hover:text-primary-foreground">{tr.privacyPolicy}</button></li>
                <li><button onClick={() => navigate("/terms-and-conditions")} className="hover:text-primary-foreground">{tr.termsAndConditions}</button></li>
                <li><button onClick={() => navigate("/returns-policy")} className="hover:text-primary-foreground">{tr.returnsPolicy}</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-6 text-center">
            <p className="text-xs">{tr.copyright}</p>
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50 mt-3">
              {tr.trademarkDisclaimer(carrierName)}
            </p>
          </div>
        </div>
      </footer>
      <div className={`${textOnBrand} py-3 text-[10px] md:text-xs`} style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">
          {tr.retailDisclaimer}{" "}
          <a href="https://www.cellpay.us/terms-and-conditions.html" className="underline font-bold ml-1">{tr.viewFullTerms}</a>
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </>
  );
};
