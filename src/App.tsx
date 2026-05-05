import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { captureTrackingIdsFromUrl } from "@/lib/tracking";
import { usePresence } from "@/hooks/usePresence";
import Home from "./pages/Home.tsx";
import DynamicCarrier from "./pages/DynamicCarrier.tsx";
import Checkout from "./pages/Checkout.tsx";
import PaymentCallback from "./pages/PaymentCallback.tsx";
import OrderConfirmation from "./pages/OrderConfirmation.tsx";
import CashAppReturn from "./pages/CashAppReturn.tsx";
import Profile from "./pages/Profile.tsx";
import Orders from "./pages/Orders.tsx";
import AboutUs from "./pages/AboutUs.tsx";
import ContactUs from "./pages/ContactUs.tsx";
import FAQ from "./pages/FAQ.tsx";
import HowToUse from "./pages/HowToUse.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsAndConditions from "./pages/TermsAndConditions.tsx";
import ReturnsPolicy from "./pages/ReturnsPolicy.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import StraightTalk from "./pages/StraightTalk.tsx";
import USCellular from "./pages/USCellular.tsx";
import Verizon from "./pages/Verizon.tsx";
import ATT from "./pages/ATT.tsx";
import { Toaster } from "@/components/ui/toaster";

import simpleMobileLogo from "@/assets/simple-mobile-logo.png";
import cricketLogo from "@/assets/cricket-logo.webp";
import metroLogo from "@/assets/metro-logo.svg";
import tmobileLogo from "@/assets/tmobile-logo.svg";
import attLogo from "@/assets/att-prepaid-logo.webp";
import verizonLogo from "@/assets/verizon-logo.png";
import boostLogo from "@/assets/boost-logo.png";
import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import h2oLogo from "@/assets/h2o-logo.png";
import lycaLogo from "@/assets/lyca-logo.webp";
import net10Logo from "@/assets/net10-logo.png";
import pageplusLogo from "@/assets/pageplus-logo.png";
import tracfoneLogo from "@/assets/tracfone-logo.svg";
import ultraLogo from "@/assets/ultra-mobile-logo.png";
import uscellularLogo from "@/assets/uscellular-logo.png";

interface CarrierRouteDef {
  path: string;            // English path (without leading /es)
  name: string;
  slug: string;
  carrierId: number;
  brandColor: string;
  logo?: string;
}

// Single source of truth for every carrier route. English path + auto /es/ mirror.
const carrierRoutes: CarrierRouteDef[] = [
  { path: "/s1.html", name: "Simple Mobile", slug: "s1", carrierId: 15, brandColor: "hsl(101,67%,44%)", logo: simpleMobileLogo },
  { path: "/topup-crc.html", name: "Cricket Wireless", slug: "topup-crc", carrierId: 45, brandColor: "hsl(82,60%,42%)", logo: cricketLogo },
  { path: "/metropcs.html", name: "Metro PCS", slug: "metropcs", carrierId: 38, brandColor: "hsl(270,60%,32%)", logo: metroLogo },
  { path: "/metro-pcs.html", name: "Metro PCS", slug: "metropcs", carrierId: 38, brandColor: "hsl(270,60%,32%)", logo: metroLogo },
  { path: "/tmobile-flexi.html", name: "T-Mobile", slug: "tmobile", carrierId: 43, brandColor: "hsl(330,100%,45%)", logo: tmobileLogo },
  { path: "/topup-at.html", name: "AT&T Prepaid", slug: "topup-at", carrierId: 3, brandColor: "hsl(196,100%,44%)", logo: attLogo },
  { path: "/verizon", name: "Verizon Wireless Prepaid", slug: "verizon", carrierId: 14, brandColor: "hsl(0,100%,45%)", logo: verizonLogo },
  { path: "/boost.html", name: "Boost Mobile", slug: "boost", carrierId: 36, brandColor: "hsl(27,100%,50%)", logo: boostLogo },
  // Straight Talk intentionally omitted — backend has no carrier entry, served by static StraightTalk.tsx below.
  { path: "/h2o.html", name: "H2O Wireless", slug: "h2o", carrierId: 6, brandColor: "hsl(195,85%,50%)", logo: h2oLogo },
  { path: "/lyca.html", name: "Lyca Mobile", slug: "lyca", carrierId: 29, brandColor: "hsl(220,50%,22%)", logo: lycaLogo },
  { path: "/net10.html", name: "Net10 Wireless", slug: "net10", carrierId: 7, brandColor: "hsl(195,100%,50%)", logo: net10Logo },
  { path: "/pageplus.html", name: "Page Plus", slug: "pageplus", carrierId: 1, brandColor: "hsl(0,70%,50%)", logo: pageplusLogo },
  { path: "/tracfone.html", name: "TracFone", slug: "tracfone", carrierId: 10, brandColor: "hsl(230,70%,30%)", logo: tracfoneLogo },
  { path: "/ultra-mobile.html", name: "Ultra Mobile", slug: "ultra-mobile", carrierId: 25, brandColor: "hsl(270,50%,40%)", logo: ultraLogo },
  // US Cellular intentionally omitted — backend has no carrier entry, served by static USCellular.tsx below.
  // AT&T FirstNet intentionally omitted — backend has no carrier entry, served by static ATT.tsx below.
  { path: "/pageplus-addon", name: "Page Plus Addon Balance", slug: "pageplusadd", carrierId: 50, brandColor: "hsl(0,70%,50%)", logo: pageplusLogo },
  { path: "/red-pocket", name: "Red Pocket Mobile", slug: "red-pocket-mobile", carrierId: 2, brandColor: "hsl(0,80%,45%)" },
  { path: "/total-wireless", name: "Total Wireless", slug: "total-wireless", carrierId: 79, brandColor: "hsl(200,70%,40%)" },
  // Verizon Wireless Flexi intentionally omitted — backend has no carrier entry, served by static Verizon.tsx below.
  { path: "/xbox", name: "XBOX", slug: "xbox", carrierId: 76, brandColor: "hsl(120,60%,40%)" },
];

// Legacy `-espanol.html` URLs (kept as redirects to /es/* for backward compatibility)
const legacyEspanolRedirects: Array<[string, string]> = [
  ["/s1-espanol.html", "/es/s1.html"],
  ["/topup-crc-espanol.html", "/es/topup-crc.html"],
  ["/metropcs-espanol.html", "/es/metropcs.html"],
  ["/tmobile-flexi-espanol.html", "/es/tmobile-flexi.html"],
  ["/topup-at-espanol.html", "/es/topup-at.html"],
  ["/verizon-espanol", "/es/verizon"],
  ["/boost-espanol.html", "/es/boost.html"],
  ["/straight-talk-espanol.html", "/es/straight-talk.html"],
  ["/h2o-espanol.html", "/es/h2o.html"],
  ["/lyca-espanol.html", "/es/lyca.html"],
  ["/net10-espanol.html", "/es/net10.html"],
  ["/pageplus-espanol.html", "/es/pageplus.html"],
  ["/tracfone-espanol.html", "/es/tracfone.html"],
  ["/ultra-mobile-espanol.html", "/es/ultra-mobile.html"],
  ["/us-cellular-espanol.html", "/es/us-cellular.html"],
  ["/verizon-wireless-flexi-espanol.html", "/es/verizon-wireless-flexi.html"],
];

const TrackingCapture = () => {
  const location = useLocation();
  useEffect(() => {
    captureTrackingIdsFromUrl();
  }, [location.search]);
  usePresence();
  return null;
};

/** Spanish fallback: if no /es/* route matched, strip the `/es` prefix and redirect to English. */
const EsFallback = () => {
  const { pathname, search, hash } = useLocation();
  const stripped = pathname.replace(/^\/es(?=\/|$)/, "") || "/";
  return <Navigate to={`${stripped}${search}${hash}`} replace />;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TrackingCapture />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/es" element={<Home />} />

        {/* Carrier pages — English + /es/ mirrors, plus /{slug}/pay aliases */}
        {carrierRoutes.flatMap((c) => {
          // Derive a clean slug from the canonical path: strip leading "/" and trailing ".html"
          const cleanSlug = c.path.replace(/^\//, "").replace(/\.html$/, "");
          const payPath = `/${cleanSlug}/pay`;
          const renderEn = (
            <DynamicCarrier
              carrierName={c.name}
              carrierSlug={c.slug}
              carrierId={c.carrierId}
              brandColor={c.brandColor}
              logo={c.logo}
            />
          );
          const renderEs = (
            <DynamicCarrier
              lang="es"
              carrierName={c.name}
              carrierSlug={c.slug}
              carrierId={c.carrierId}
              brandColor={c.brandColor}
              logo={c.logo}
            />
          );
          return [
            <Route key={`en-${c.path}`} path={c.path} element={renderEn} />,
            <Route key={`es-${c.path}`} path={`/es${c.path}`} element={renderEs} />,
            <Route key={`en-pay-${c.path}`} path={payPath} element={renderEn} />,
            <Route key={`es-pay-${c.path}`} path={`/es${payPath}`} element={renderEs} />,
          ];
        })}

        {/* Straight Talk — static hardcoded page (no backend carrier entry). */}
        <Route path="/straight-talk.html" element={<StraightTalk />} />
        <Route path="/es/straight-talk.html" element={<StraightTalk />} />
        <Route path="/straight-talk/pay" element={<StraightTalk />} />
        <Route path="/es/straight-talk/pay" element={<StraightTalk />} />

        {/* US Cellular — static hardcoded page (no backend carrier entry). */}
        <Route path="/us-cellular.html" element={<USCellular />} />
        <Route path="/es/us-cellular.html" element={<USCellular />} />
        <Route path="/us-cellular/pay" element={<USCellular />} />
        <Route path="/es/us-cellular/pay" element={<USCellular />} />


        {/* Legacy `-espanol` URLs → redirect to canonical /es/* */}
        {legacyEspanolRedirects.map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        {/* Checkout / confirmation flow — English + /es/ mirrors. Same components,
            language is detected from URL pathname inside each page. */}
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/es/checkout" element={<Checkout />} />
        <Route path="/payment-callback" element={<PaymentCallback />} />
        <Route path="/es/payment-callback" element={<PaymentCallback />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/es/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/checkout/cashapp-return" element={<CashAppReturn />} />
        <Route path="/es/checkout/cashapp-return" element={<CashAppReturn />} />

        {/* Account & content pages */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/how-to-use" element={<HowToUse />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/returns-policy" element={<ReturnsPolicy />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Fallback: any unmatched /es/* path → strip /es and redirect to English. */}
        <Route path="/es/*" element={<EsFallback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
