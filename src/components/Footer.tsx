import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, t, langPath } from "@/lib/i18n";

interface FooterProps {
  onLoginClick?: () => void;
  onSignupClick?: () => void;
}

export const Footer = ({ onLoginClick, onSignupClick }: FooterProps) => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const lang = useLang();
  const tr = t(lang);
  const go = (p: string) => navigate(langPath(p, lang));

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
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">{tr.company}</h5>
              <ul className="space-y-4 text-sm">
                <li><button onClick={() => go("/about-us")} className="hover:text-primary-foreground">{tr.aboutUs}</button></li>
                <li><button onClick={() => go("/contact-us")} className="hover:text-primary-foreground">{tr.contactUs}</button></li>
                <li><button onClick={() => go("/faq")} className="hover:text-primary-foreground">{tr.faq}</button></li>
                <li><button onClick={() => go("/how-to-use")} className="hover:text-primary-foreground">{tr.howToUse}</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">{tr.myAccount}</h5>
              <ul className="space-y-4 text-sm">
                {isLoggedIn ? (
                  <>
                    <li><button onClick={() => go("/profile")} className="hover:text-primary-foreground">{tr.myProfile}</button></li>
                    <li><button onClick={() => go("/orders")} className="hover:text-primary-foreground">{tr.myOrders}</button></li>
                  </>
                ) : (
                  <>
                    <li><button onClick={handleLogin} className="hover:text-primary-foreground">{tr.logIn}</button></li>
                    <li><button onClick={handleSignup} className="hover:text-primary-foreground">{tr.signUp}</button></li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h5 className="text-primary-foreground font-bold mb-6 uppercase tracking-widest text-sm">{tr.legal}</h5>
              <ul className="space-y-4 text-sm">
                <li><button onClick={() => go("/privacy-policy")} className="hover:text-primary-foreground">{tr.privacyPolicy}</button></li>
                <li><button onClick={() => go("/terms-and-conditions")} className="hover:text-primary-foreground">{tr.termsAndConditions}</button></li>
                <li><button onClick={() => go("/returns-policy")} className="hover:text-primary-foreground">{tr.returnsPolicy}</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-muted pt-8 text-center">
            <p className="text-xs mb-4">
              {tr.copyright} |{" "}
              <button onClick={() => go("/privacy-policy")} className="hover:text-primary-foreground">{tr.privacyPolicy}</button> |{" "}
              <button onClick={() => go("/terms-and-conditions")} className="hover:text-primary-foreground">{tr.termsAndConditions}</button> |{" "}
              <button onClick={() => go("/contact-us")} className="hover:text-primary-foreground">{tr.contactUs}</button>
            </p>
            <p className="text-[10px] leading-relaxed max-w-4xl mx-auto opacity-50">
              {lang === "es"
                ? "CellPay es un procesador de pagos autorizado independiente para servicios inalámbricos prepagados. Todos los nombres de operadores, logotipos y marcas comerciales (incluyendo AT&T, Verizon, T-Mobile, Cricket, Simple Mobile, Boost, Metro, Straight Talk, H2O, Lyca, Net10, Page Plus, TracFone, Ultra Mobile, US Cellular, Red Pocket y Total Wireless) son propiedad de sus respectivos dueños y se mencionan únicamente para identificar los servicios para los cuales CellPay procesa pagos. CellPay no está afiliado, respaldado ni patrocinado por ningún operador."
                : "CellPay is an independent authorized payment processor for prepaid wireless services. All carrier names, logos, and trademarks (including AT&T, Verizon, T-Mobile, Cricket, Simple Mobile, Boost, Metro, Straight Talk, H2O, Lyca, Net10, Page Plus, TracFone, Ultra Mobile, US Cellular, Red Pocket, and Total Wireless) are the property of their respective owners and are referenced solely to identify the services for which CellPay processes payments. CellPay is not affiliated with, endorsed by, or sponsored by any carrier."}
            </p>
          </div>
        </div>
      </footer>
      {!onLoginClick && <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />}
    </>
  );
};
