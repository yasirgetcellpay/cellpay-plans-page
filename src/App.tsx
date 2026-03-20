import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.tsx";
import Index from "./pages/Index.tsx";
import Cricket from "./pages/Cricket.tsx";
import Metro from "./pages/Metro.tsx";
import TMobile from "./pages/TMobile.tsx";
import NotFound from "./pages/NotFound.tsx";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/simple-mobile" element={<Index />} />
      <Route path="/cricket" element={<Cricket />} />
      <Route path="/metro" element={<Metro />} />
      <Route path="/tmobile" element={<TMobile />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
