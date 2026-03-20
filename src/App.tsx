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
import NotFound from "./pages/NotFound.tsx";

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
