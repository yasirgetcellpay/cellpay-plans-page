import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCarriers, type Carrier } from "@/services/apiWrapper";
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

/* ── slug → local logo map (fallback & override) ── */
const localLogos: Record<string, string> = {
  "simple-mobile": simpleMobileLogo,
  simplemobile: simpleMobileLogo,
  cricket: cricketLogo,
  cricketwireless: cricketLogo,
  metro: metroLogo,
  metropcs: metroLogo,
  "metro-pcs": metroLogo,
  tmobile: tmobileLogo,
  "t-mobile": tmobileLogo,
  att: attLogo,
  "att-prepaid": attLogo,
  attprepaid: attLogo,
  verizon: verizonLogo,
  boost: boostLogo,
  boostmobile: boostLogo,
  "boost-mobile": boostLogo,
  "straight-talk": straightTalkLogo,
  straighttalk: straightTalkLogo,
  h2o: h2oLogo,
  h2owireless: h2oLogo,
  "h2o-wireless": h2oLogo,
  lyca: lycaLogo,
  lycamobile: lycaLogo,
  "lyca-mobile": lycaLogo,
  net10: net10Logo,
  net10wireless: net10Logo,
  "net10-wireless": net10Logo,
  pageplus: pageplusLogo,
  "page-plus": pageplusLogo,
  tracfone: tracfoneLogo,
  "ultra-mobile": ultraLogo,
  ultramobile: ultraLogo,
  uscellular: uscellularLogo,
  "us-cellular": uscellularLogo,
};

/* ── slug → route path map ── */
const slugToPath: Record<string, string> = {
  simplemobile: "/simple-mobile",
  "simple-mobile": "/simple-mobile",
  cricket: "/cricket",
  cricketwireless: "/cricket",
  metro: "/metro",
  metropcs: "/metro",
  "metro-pcs": "/metro",
  tmobile: "/tmobile",
  "t-mobile": "/tmobile",
  att: "/att",
  attprepaid: "/att",
  "att-prepaid": "/att",
  verizon: "/verizon",
  boost: "/boost",
  boostmobile: "/boost",
  "boost-mobile": "/boost",
  straighttalk: "/straight-talk",
  "straight-talk": "/straight-talk",
  h2o: "/h2o",
  h2owireless: "/h2o",
  "h2o-wireless": "/h2o",
  lyca: "/lyca",
  lycamobile: "/lyca",
  "lyca-mobile": "/lyca",
  net10: "/net10",
  net10wireless: "/net10",
  "net10-wireless": "/net10",
  pageplus: "/pageplus",
  "page-plus": "/pageplus",
  tracfone: "/tracfone",
  ultramobile: "/ultra-mobile",
  "ultra-mobile": "/ultra-mobile",
  uscellular: "/uscellular",
  "us-cellular": "/uscellular",
};

/* ── brand colour per slug ── */
const slugToColor: Record<string, string> = {
  simplemobile: "bg-[hsl(101,67%,44%)]",
  "simple-mobile": "bg-[hsl(101,67%,44%)]",
  cricket: "bg-[hsl(82,60%,42%)]",
  cricketwireless: "bg-[hsl(82,60%,42%)]",
  metro: "bg-[hsl(270,60%,32%)]",
  metropcs: "bg-[hsl(270,60%,32%)]",
  "metro-pcs": "bg-[hsl(270,60%,32%)]",
  tmobile: "bg-[hsl(330,100%,45%)]",
  "t-mobile": "bg-[hsl(330,100%,45%)]",
  att: "bg-[hsl(196,100%,44%)]",
  attprepaid: "bg-[hsl(196,100%,44%)]",
  "att-prepaid": "bg-[hsl(196,100%,44%)]",
  verizon: "bg-[hsl(0,100%,45%)]",
  boost: "bg-[hsl(27,100%,50%)]",
  boostmobile: "bg-[hsl(27,100%,50%)]",
  "boost-mobile": "bg-[hsl(27,100%,50%)]",
  straighttalk: "bg-[hsl(72,74%,44%)]",
  "straight-talk": "bg-[hsl(72,74%,44%)]",
  h2o: "bg-[hsl(195,85%,50%)]",
  h2owireless: "bg-[hsl(195,85%,50%)]",
  "h2o-wireless": "bg-[hsl(195,85%,50%)]",
  lyca: "bg-[hsl(220,50%,22%)]",
  lycamobile: "bg-[hsl(220,50%,22%)]",
  "lyca-mobile": "bg-[hsl(220,50%,22%)]",
  net10: "bg-[hsl(195,100%,50%)]",
  net10wireless: "bg-[hsl(195,100%,50%)]",
  "net10-wireless": "bg-[hsl(195,100%,50%)]",
  pageplus: "bg-[hsl(0,70%,50%)]",
  "page-plus": "bg-[hsl(0,70%,50%)]",
  tracfone: "bg-[hsl(230,70%,30%)]",
  ultramobile: "bg-[hsl(270,50%,40%)]",
  "ultra-mobile": "bg-[hsl(270,50%,40%)]",
  uscellular: "bg-[hsl(220,80%,35%)]",
  "us-cellular": "bg-[hsl(220,80%,35%)]",
};

/* ── static fallback (identical to previous hardcoded list) ── */
const staticCarriers = [
  { name: "Simple Mobile", logo: simpleMobileLogo, path: "/simple-mobile", bg: "bg-[hsl(101,67%,44%)]" },
  { name: "Cricket Wireless", logo: cricketLogo, path: "/cricket", bg: "bg-[hsl(82,60%,42%)]" },
  { name: "Metro PCS", logo: metroLogo, path: "/metro", bg: "bg-[hsl(270,60%,32%)]" },
  { name: "T-Mobile", logo: tmobileLogo, path: "/tmobile", bg: "bg-[hsl(330,100%,45%)]" },
  { name: "AT&T Prepaid", logo: attLogo, path: "/att", bg: "bg-[hsl(196,100%,44%)]" },
  { name: "Verizon", logo: verizonLogo, path: "/verizon", bg: "bg-[hsl(0,100%,45%)]" },
  { name: "Boost Mobile", logo: boostLogo, path: "/boost", bg: "bg-[hsl(27,100%,50%)]" },
  { name: "Straight Talk", logo: straightTalkLogo, path: "/straight-talk", bg: "bg-[hsl(72,74%,44%)]" },
  { name: "H2O Wireless", logo: h2oLogo, path: "/h2o", bg: "bg-[hsl(195,85%,50%)]" },
  { name: "Lyca Mobile", logo: lycaLogo, path: "/lyca", bg: "bg-[hsl(220,50%,22%)]" },
  { name: "Net10 Wireless", logo: net10Logo, path: "/net10", bg: "bg-[hsl(195,100%,50%)]" },
  { name: "Page Plus", logo: pageplusLogo, path: "/pageplus", bg: "bg-[hsl(0,70%,50%)]" },
  { name: "TracFone", logo: tracfoneLogo, path: "/tracfone", bg: "bg-[hsl(230,70%,30%)]" },
  { name: "Ultra Mobile", logo: ultraLogo, path: "/ultra-mobile", bg: "bg-[hsl(270,50%,40%)]" },
  { name: "US Cellular", logo: uscellularLogo, path: "/uscellular", bg: "bg-[hsl(220,80%,35%)]" },
];

interface DisplayCarrier {
  name: string;
  logo: string;
  path: string;
  bg: string;
}

function mapApiCarrier(c: Carrier): DisplayCarrier | null {
  const slug = (c.slug || "").toLowerCase();
  const path = slugToPath[slug];
  if (!path) return null; // unknown carrier – skip
  const logo = localLogos[slug] || (c.logo as string) || "";
  const bg = slugToColor[slug] || "bg-primary";
  return { name: c.name, logo, path, bg };
}

const Home = () => {
  const [carriers, setCarriers] = useState<DisplayCarrier[]>(staticCarriers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiCarriers = await fetchCarriers();
        if (!cancelled && apiCarriers.length > 0) {
          const mapped = apiCarriers
            .map(mapApiCarrier)
            .filter((c): c is DisplayCarrier => c !== null);
          if (mapped.length > 0) {
            setCarriers(mapped);
          }
        }
      } catch (err) {
        console.warn("Carrier API unavailable, using static list", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="bg-cellpay-dark py-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground tracking-tight">
          Prepaid Phone Refill
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Select your carrier to get started</p>
      </header>

      {/* Carrier Grid */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          {carriers.map((carrier) => (
            <Link
              key={carrier.path}
              to={carrier.path}
              className="group bg-card rounded-xl border border-border shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden active:scale-[0.97]"
            >
              <div className="flex items-center justify-center h-32 sm:h-40 bg-background p-6">
                <img
                  src={carrier.logo}
                  alt={carrier.name}
                  className="max-h-12 sm:max-h-16 max-w-[80%] w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className={`${carrier.bg} py-3 text-center`}>
                <span className="text-primary-foreground font-bold text-sm sm:text-base">
                  {carrier.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-cellpay-dark text-muted-foreground py-6 text-center text-xs">
        <p>© 2026 All rights reserved.</p>
        <p className="text-[10px] opacity-50 mt-2 max-w-2xl mx-auto px-4">
          All carrier names and trademarks are property of their respective owners.
        </p>
      </footer>
    </div>
  );
};

export default Home;
