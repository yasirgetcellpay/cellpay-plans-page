import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import CarrierList from "./pages/CarrierList";
import CarrierDetail from "./pages/CarrierDetail";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/carriers" element={<CarrierList />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/:slug" element={<CarrierDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
