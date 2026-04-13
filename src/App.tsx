import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.tsx";
import Index from "./pages/Index.tsx";
import Cricket from "./pages/Cricket.tsx";
import Metro from "./pages/Metro.tsx";
import TMobile from "./pages/TMobile.tsx";
import ATT from "./pages/ATT.tsx";
import Verizon from "./pages/Verizon.tsx";
import Boost from "./pages/Boost.tsx";
import StraightTalk from "./pages/StraightTalk.tsx";
import H2O from "./pages/H2O.tsx";
import Lyca from "./pages/Lyca.tsx";
import Net10 from "./pages/Net10.tsx";
import PagePlus from "./pages/PagePlus.tsx";
import Tracfone from "./pages/Tracfone.tsx";
import UltraMobile from "./pages/UltraMobile.tsx";
import USCellular from "./pages/USCellular.tsx";
import DynamicCarrier from "./pages/DynamicCarrier.tsx";
import Checkout from "./pages/Checkout.tsx";
import PaymentCallback from "./pages/PaymentCallback.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Toaster } from "@/components/ui/toaster";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/simple-mobile" element={<Index />} />
      <Route path="/cricket" element={<Cricket />} />
      <Route path="/metro" element={<Metro />} />
      <Route path="/tmobile" element={<TMobile />} />
      <Route path="/att" element={<ATT />} />
      <Route path="/verizon" element={<Verizon />} />
      <Route path="/boost" element={<Boost />} />
      <Route path="/straight-talk" element={<StraightTalk />} />
      <Route path="/h2o" element={<H2O />} />
      <Route path="/lyca" element={<Lyca />} />
      <Route path="/net10" element={<Net10 />} />
      <Route path="/pageplus" element={<PagePlus />} />
      <Route path="/tracfone" element={<Tracfone />} />
      <Route path="/ultra-mobile" element={<UltraMobile />} />
      <Route path="/uscellular" element={<USCellular />} />

      {/* New carriers from API without dedicated pages */}
      <Route path="/att-firstnet" element={<DynamicCarrier carrierName="AT&T FirstNet" carrierSlug="topup-af" carrierId={81} brandColor="hsl(196,100%,44%)" />} />
      <Route path="/pageplus-addon" element={<DynamicCarrier carrierName="Page Plus Addon Balance" carrierSlug="pageplusadd" carrierId={50} brandColor="hsl(0,70%,50%)" />} />
      <Route path="/red-pocket" element={<DynamicCarrier carrierName="Red Pocket Mobile" carrierSlug="red-pocket-mobile" carrierId={2} brandColor="hsl(0,80%,45%)" />} />
      <Route path="/total-wireless" element={<DynamicCarrier carrierName="Total Wireless" carrierSlug="total-wireless" carrierId={79} brandColor="hsl(200,70%,40%)" />} />
      <Route path="/verizon-flexi" element={<DynamicCarrier carrierName="Verizon Wireless Flexi" carrierSlug="verizon-wireless-flexi" carrierId={75} brandColor="hsl(0,100%,45%)" />} />
      <Route path="/xbox" element={<DynamicCarrier carrierName="XBOX" carrierSlug="xbox" carrierId={76} brandColor="hsl(120,60%,40%)" />} />

      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment-callback" element={<PaymentCallback />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <Toaster />
  </BrowserRouter>
);

export default App;
