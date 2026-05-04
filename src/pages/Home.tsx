import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "@/components/AuthDialog";
import { User, LogOut, ChevronDown, ShoppingBag, UserCog } from "lucide-react";
import { LegalBar } from "@/components/LegalBar";
import { PaymentBar } from "@/components/PaymentBar";
import { fetchCarriers, type Carrier } from "@/services/apiWrapper";
import { applySeoHead } from "@/lib/seo";
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
import redPocketLogo from "@/assets/red-pocket-logo.png";
import totalWirelessLogo from "@/assets/total-wireless-logo.png";
import { ShieldCheck, Zap, Headphones, Star, Smartphone, MousePointerClick, ListChecks, CreditCard } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ── API slug → local logo ── */
const localLogos: Record<string, string> = {
  "topup-at": attLogo,
  "topup-af": attLogo,
  boost: boostLogo,
  "topup-crc": cricketLogo,
  h2o: h2oLogo,
  lyca: lycaLogo,
  metropcs: metroLogo,
  net10: net10Logo,
  pageplus: pageplusLogo,
  pageplusadd: pageplusLogo,
  s1: simpleMobileLogo,
  tmobile: tmobileLogo,
  tracfone: tracfoneLogo,
  "ultra-mobile": ultraLogo,
  "us-cellular": uscellularLogo,
  verizon: verizonLogo,
  "verizon-wireless-flexi": verizonLogo,
  "straight-talk": straightTalkLogo,
  straighttalk: straightTalkLogo,
  "red-pocket-mobile": redPocketLogo,
  "total-wireless": totalWirelessLogo,
};

/* ── API slug → app route ── */
const slugToPath: Record<string, string> = {
  "topup-at": "/att",
  "topup-af": "/att-firstnet",
  boost: "/boost",
  "topup-crc": "/cricket",
  h2o: "/h2o",
  lyca: "/lyca",
  metropcs: "/metro",
  net10: "/net10",
  pageplus: "/pageplus",
  pageplusadd: "/pageplus-addon",
  "red-pocket-mobile": "/red-pocket",
  s1: "/simple-mobile",
  tmobile: "/tmobile",
  "total-wireless": "/total-wireless",
  tracfone: "/tracfone",
  "ultra-mobile": "/ultra-mobile",
  "us-cellular": "/uscellular",
  verizon: "/verizon",
  "verizon-wireless-flexi": "/verizon-flexi",
  xbox: "/xbox",
  "straight-talk": "/straight-talk",
  straighttalk: "/straight-talk",
};

/* ── API slug → brand colour ── */
const slugToColor: Record<string, string> = {
  "topup-at": "bg-[hsl(196,100%,44%)]",
  "topup-af": "bg-[hsl(196,100%,44%)]",
  boost: "bg-[hsl(27,100%,50%)]",
  "topup-crc": "bg-[hsl(82,60%,42%)]",
  h2o: "bg-[hsl(195,85%,50%)]",
  lyca: "bg-[hsl(220,50%,22%)]",
  metropcs: "bg-[hsl(270,60%,32%)]",
  net10: "bg-[hsl(195,100%,50%)]",
  pageplus: "bg-[hsl(0,70%,50%)]",
  pageplusadd: "bg-[hsl(0,70%,50%)]",
  "red-pocket-mobile": "bg-[hsl(0,80%,45%)]",
  s1: "bg-[hsl(101,67%,44%)]",
  tmobile: "bg-[hsl(330,100%,45%)]",
  "total-wireless": "bg-[hsl(200,70%,40%)]",
  tracfone: "bg-[hsl(230,70%,30%)]",
  "ultra-mobile": "bg-[hsl(270,50%,40%)]",
  "us-cellular": "bg-[hsl(220,80%,35%)]",
  verizon: "bg-[hsl(0,100%,45%)]",
  "verizon-wireless-flexi": "bg-[hsl(0,100%,45%)]",
  xbox: "bg-[hsl(120,60%,40%)]",
  "straight-talk": "bg-[hsl(72,74%,44%)]",
  straighttalk: "bg-[hsl(72,74%,44%)]",
};

/* ── static fallback (all carriers) ── */
const staticCarriers: DisplayCarrier[] = [
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
  
  { name: "Total Wireless", logo: totalWirelessLogo, path: "/total-wireless", bg: "bg-[hsl(200,70%,40%)]" },
  { name: "TracFone", logo: tracfoneLogo, path: "/tracfone", bg: "bg-[hsl(230,70%,30%)]" },
  { name: "Ultra Mobile", logo: ultraLogo, path: "/ultra-mobile", bg: "bg-[hsl(270,50%,40%)]" },
  { name: "US Cellular", logo: uscellularLogo, path: "/uscellular", bg: "bg-[hsl(220,80%,35%)]" },
];

interface DisplayCarrier {
  name: string;
  logo?: string;
  path: string;
  bg: string;
}

/** Deduplicate by path */
function dedup(list: DisplayCarrier[]): DisplayCarrier[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    if (seen.has(c.path)) return false;
    seen.add(c.path);
    return true;
  });
}

// Slugs to hide from the homepage grid (duplicate variants of carriers already shown)
const excludedSlugs = new Set<string>([
  "topup-af",                  // AT&T FirstNet (duplicate of AT&T)
  "verizon-wireless-flexi",    // Verizon Flexi (duplicate of Verizon)
  "pageplusadd",               // Page Plus Addon (duplicate of Page Plus)
  "red-pocket-mobile",         // Red Pocket Mobile (hidden from homepage)
]);

function mapApiCarrier(c: Carrier): DisplayCarrier | null {
  const slug = (c.slug || "").toLowerCase();
  if (excludedSlugs.has(slug)) return null;
  const path = slugToPath[slug];
  if (!path) return null;
  const logo = localLogos[slug] || (c.logo as string) || undefined;
  const bg = slugToColor[slug] || "bg-primary";
  return { name: c.name, logo, path, bg };
}

const Home = () => {
  const [carriers, setCarriers] = useState<DisplayCarrier[]>(staticCarriers);
  const [authOpen, setAuthOpen] = useState(false);
  const { isLoggedIn, user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { carriers: apiCarriers, seo } = await fetchCarriers();
        if (cancelled) return;

        // Apply SEO from the same response — no extra request
        applySeoHead({
          title: seo.title_for_layout,
          description: seo.seo_description,
          keywords: seo.seo_keywords,
          schema: seo.seo_schema,
        });

        if (apiCarriers.length > 0) {
          const mapped = dedup(
            apiCarriers
              .map(mapApiCarrier)
              .filter((c): c is DisplayCarrier => c !== null)
          );
          if (mapped.length > 0) setCarriers(mapped);
        }
      } catch (err) {
        console.warn("Carrier API unavailable, using static list", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleNav = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            {/* CellPay wordmark — feedback Page 7 #2 */}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-cellpay-green text-primary-foreground shadow-sm">
                <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-cellpay-green tracking-tight">
                CellPay
              </span>
            </div>
            {isLoggedIn && (
              <div className="absolute right-0" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((p) => !p)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="hidden sm:inline truncate max-w-[100px]">
                    {user?.first_name || "Account"}
                  </span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl py-0 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-muted/40 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => handleNav("/profile")}
                        className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-3"
                      >
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        My Profile
                      </button>
                      <button
                        onClick={() => handleNav("/orders")}
                        className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-3"
                      >
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        My Orders
                      </button>
                    </div>
                    <div className="border-t border-border py-1">
                      <button
                        onClick={() => { logout(); setDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-3"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — unified green to match logo (feedback #2, #8) */}
      <section className="bg-cellpay-green text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-5 sm:py-6 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">
            Refill Any Prepaid Phone in Seconds
          </h1>
          <p className="text-sm sm:text-base opacity-95 mt-1.5">
            Instant top-ups for 15+ carriers · No account required
          </p>
          {/* Social proof — feedback #5, #12 */}
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-0.5">
              {[0,1,2,3,4].map(i => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <span className="font-bold">4.8/5</span>
            <span className="opacity-90">· 50,000+ customers served</span>
          </div>
        </div>
      </section>

      {/* Trust bar — feedback #4, #10, #11 */}
      <section className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-cellpay-green" />
              <span className="font-semibold">Secure Checkout</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-cellpay-green" />
              <span className="font-semibold">Instant Delivery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Headphones className="h-4 w-4 text-cellpay-green" />
              <span className="font-semibold">24/7 Support</span>
            </div>
            {/* Inline 'We accept' strip removed from top per feedback Page 6 (Non-blocker #1).
                Payment logos are still shown via <PaymentBar /> at the bottom. */}
          </div>
        </div>
      </section>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 max-w-3xl w-full">
          {carriers.map((carrier) => (
            <Link
              key={carrier.path}
              to={carrier.path}
              aria-label={`Refill ${carrier.name}`}
              className="group bg-card rounded-lg sm:rounded-xl border border-border shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden active:scale-[0.97]"
            >
              <div className="flex items-center justify-center h-24 sm:h-40 bg-background p-4 sm:p-6">
                {carrier.logo ? (
                  <img
                    src={carrier.logo}
                    alt={carrier.name}
                    loading="lazy"
                    className="max-h-10 sm:max-h-16 max-w-[80%] w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="text-sm sm:text-xl font-extrabold text-foreground group-hover:scale-105 transition-transform duration-300">
                    {carrier.name}
                  </span>
                )}
              </div>
              {/* Only show name strip when there is NO logo (avoid duplicate label) — feedback #7.
                  When a logo is present, show a neutral CTA strip instead. */}
              <div className={`${carrier.bg} py-2 sm:py-3 text-center`}>
                <span className="text-primary-foreground font-bold text-xs sm:text-base">
                  {carrier.logo ? "Refill Now" : carrier.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* How it works — feedback Page 7 #3 */}
      <section className="bg-muted/40 border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h2 className="text-center text-xl sm:text-2xl font-extrabold text-foreground mb-2">
            How it works in 4 easy steps
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-8">
            Refill any prepaid line in under 60 seconds — no account needed.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { n: "1", title: "Choose a Carrier", icon: ListChecks },
              { n: "2", title: "Enter your number", icon: Smartphone },
              { n: "3", title: "Select a plan", icon: MousePointerClick },
              { n: "4", title: "Pay", icon: CreditCard },
            ].map((s) => (
              <div key={s.n} className="bg-card rounded-xl border border-border p-4 sm:p-5 text-center shadow-sm">
                <div className="mx-auto mb-3 inline-flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-cellpay-green/10 text-cellpay-green font-extrabold text-sm sm:text-base">
                  Step {s.n}
                </div>
                <s.icon className="mx-auto h-6 w-6 sm:h-7 sm:w-7 text-cellpay-green mb-2" />
                <p className="text-sm sm:text-base font-bold text-foreground">{s.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — feedback Page 7 #3 */}
      <section className="bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h2 className="text-center text-xl sm:text-2xl font-extrabold text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: "What is CellPay?",
                a: "CellPay is a fast, secure online payment service that lets you refill any major US prepaid wireless line in seconds — no account required.",
              },
              {
                q: "How does CellPay work?",
                a: "Pick your carrier, enter the prepaid phone number, choose a refill amount or plan, and pay with card, Apple Pay, Google Pay, PayPal, Klarna, or Cash App. The refill is applied to the line instantly.",
              },
              {
                q: "Is CellPay for real?",
                a: "Yes. CellPay has processed payments for thousands of customers across 15+ carriers. Every transaction is processed through trusted, PCI-compliant payment networks.",
              },
              {
                q: "Is CellPay secure?",
                a: "Absolutely. All payment data is encrypted in transit with TLS, and card data is handled by PCI-DSS-compliant providers. CellPay never stores your full card number on our servers.",
              },
            ].map((f, i) => (
              <AccordionItem key={i} value={`home-faq-${i}`}>
                <AccordionTrigger className="text-left font-bold text-foreground">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Home;
