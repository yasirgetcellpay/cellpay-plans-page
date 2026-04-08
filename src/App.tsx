import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import CarrierDetail from "./pages/CarrierDetail";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:slug" element={<CarrierDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
