import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
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
import { Toaster } from "@/components/ui/toaster";

// Local logo imports
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

const TrackingCapture = () => {
  const location = useLocation();
  useEffect(() => {
    captureTrackingIdsFromUrl();
  }, [location.search]);
  usePresence();
  return null;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TrackingCapture />
      <Routes>
        <Route path="/" element={<Home />} />

        {/* All carrier pages — plans loaded dynamically from /carriers/view/{slug} */}
        <Route path="/simple-mobile" element={<DynamicCarrier carrierName="Simple Mobile" carrierSlug="s1" carrierId={15} brandColor="hsl(101,67%,44%)" logo={simpleMobileLogo} />} />
        <Route path="/cricket" element={<DynamicCarrier carrierName="Cricket Wireless" carrierSlug="topup-crc" carrierId={45} brandColor="hsl(82,60%,42%)" logo={cricketLogo} />} />
        <Route path="/metro" element={<DynamicCarrier carrierName="Metro PCS" carrierSlug="metropcs" carrierId={38} brandColor="hsl(270,60%,32%)" logo={metroLogo} />} />
        <Route path="/tmobile" element={<DynamicCarrier carrierName="T-Mobile" carrierSlug="tmobile" carrierId={43} brandColor="hsl(330,100%,45%)" logo={tmobileLogo} />} />
        <Route path="/att" element={<DynamicCarrier carrierName="AT&T Prepaid" carrierSlug="topup-at" carrierId={3} brandColor="hsl(196,100%,44%)" logo={attLogo} />} />
        <Route path="/verizon" element={<DynamicCarrier carrierName="Verizon Wireless Prepaid" carrierSlug="verizon" carrierId={14} brandColor="hsl(0,100%,45%)" logo={verizonLogo} />} />
        <Route path="/boost" element={<DynamicCarrier carrierName="Boost Mobile" carrierSlug="boost" carrierId={36} brandColor="hsl(27,100%,50%)" logo={boostLogo} />} />
        <Route path="/straight-talk" element={<DynamicCarrier carrierName="Straight Talk" carrierSlug="straight-talk" carrierId={0} brandColor="hsl(72,74%,44%)" logo={straightTalkLogo} />} />
        <Route path="/h2o" element={<DynamicCarrier carrierName="H2O Wireless" carrierSlug="h2o" carrierId={6} brandColor="hsl(195,85%,50%)" logo={h2oLogo} />} />
        <Route path="/lyca" element={<DynamicCarrier carrierName="Lyca Mobile" carrierSlug="lyca" carrierId={29} brandColor="hsl(220,50%,22%)" logo={lycaLogo} />} />
        <Route path="/net10" element={<DynamicCarrier carrierName="Net10 Wireless" carrierSlug="net10" carrierId={7} brandColor="hsl(195,100%,50%)" logo={net10Logo} />} />
        <Route path="/pageplus" element={<DynamicCarrier carrierName="Page Plus" carrierSlug="pageplus" carrierId={1} brandColor="hsl(0,70%,50%)" logo={pageplusLogo} />} />
        <Route path="/tracfone" element={<DynamicCarrier carrierName="TracFone" carrierSlug="tracfone" carrierId={10} brandColor="hsl(230,70%,30%)" logo={tracfoneLogo} />} />
        <Route path="/ultra-mobile" element={<DynamicCarrier carrierName="Ultra Mobile" carrierSlug="ultra-mobile" carrierId={25} brandColor="hsl(270,50%,40%)" logo={ultraLogo} />} />
        <Route path="/uscellular" element={<DynamicCarrier carrierName="US Cellular" carrierSlug="us-cellular" carrierId={88} brandColor="hsl(220,80%,35%)" logo={uscellularLogo} />} />

        {/* New carriers from API without dedicated logos */}
        <Route path="/att-firstnet" element={<DynamicCarrier carrierName="AT&T FirstNet" carrierSlug="topup-af" carrierId={81} brandColor="hsl(196,100%,44%)" logo={attLogo} />} />
        <Route path="/pageplus-addon" element={<DynamicCarrier carrierName="Page Plus Addon Balance" carrierSlug="pageplusadd" carrierId={50} brandColor="hsl(0,70%,50%)" logo={pageplusLogo} />} />
        <Route path="/red-pocket" element={<DynamicCarrier carrierName="Red Pocket Mobile" carrierSlug="red-pocket-mobile" carrierId={2} brandColor="hsl(0,80%,45%)" />} />
        <Route path="/total-wireless" element={<DynamicCarrier carrierName="Total Wireless" carrierSlug="total-wireless" carrierId={79} brandColor="hsl(200,70%,40%)" />} />
        <Route path="/verizon-flexi" element={<DynamicCarrier carrierName="Verizon Wireless Flexi" carrierSlug="verizon-wireless-flexi" carrierId={75} brandColor="hsl(0,100%,45%)" logo={verizonLogo} />} />
        <Route path="/xbox" element={<DynamicCarrier carrierName="XBOX" carrierSlug="xbox" carrierId={76} brandColor="hsl(120,60%,40%)" />} />

        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment-callback" element={<PaymentCallback />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/checkout/cashapp-return" element={<CashAppReturn />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
