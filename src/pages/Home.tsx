import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { fetchCarriers, type Carrier } from "@/services/apiWrapper";

type ApiCarrier = Carrier;

const LOGO_BASE = "https://www.cellpay.us/webp/v4/home";

const Home = () => {
  const [carriers, setCarriers] = useState<ApiCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchCarriers();
      if (cancelled) return;
      if (result.success && result.data) {
        const raw = result.data as unknown;
        const extract = (v: unknown): ApiCarrier[] => {
          if (Array.isArray(v)) return v;
          if (typeof v === "object" && v !== null) {
            const obj = v as Record<string, unknown>;
            if (Array.isArray(obj.carriers)) return obj.carriers;
            if (Array.isArray(obj.data)) return obj.data;
            if (typeof obj.data === "object" && obj.data !== null) return extract(obj.data);
          }
          return [];
        };
        const list = extract(raw);
        setCarriers(list.filter((c) => c.active !== false));
      } else {
        setError(result.error || "Failed to load carriers");
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      <Navbar />
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-red-500 to-red-600 py-10 sm:py-16 text-center text-white">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Instant Mobile Recharge & Bill Payment
          </h1>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-sm sm:text-base">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-400 text-white text-xs">✓</span>
              Easy & secure payments
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-400 text-white text-xs">✓</span>
              Online available 24/7
            </span>
          </div>
        </div>
      </section>

      {/* Carrier Grid */}
      <main className="flex-1 px-4 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold text-foreground mb-6">Choose a Carrier</h2>

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading carriers...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-16">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {carriers.map((carrier) => {
                const slug = carrier.slug || "";
                const displayName = carrier.name || slug;
                const logoUrl = `${LOGO_BASE}/${slug}.webp`;

                return (
                  <Link
                    key={carrier.id ?? slug}
                    to={`/${slug}`}
                    className="group flex items-center justify-center bg-white rounded-lg border border-gray-200 hover:border-red-400 hover:shadow-lg transition-all duration-200 p-4 h-24 sm:h-28"
                  >
                    <img
                      src={logoUrl}
                      alt={displayName}
                      className="max-h-14 sm:max-h-16 max-w-[90%] w-auto object-contain group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector("span")) {
                          const span = document.createElement("span");
                          span.className = "text-sm font-bold text-gray-700 text-center";
                          span.textContent = displayName;
                          parent.appendChild(span);
                        }
                      }}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* How it Works */}
      <section className="bg-muted py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            How it works in <span className="text-destructive">4 easy steps</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6">
            {[
              { step: 1, label: "Choose a Carrier", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon1.webp" },
              { step: 2, label: "Enter your number", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon2.webp" },
              { step: 3, label: "Select a plan", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon3.webp" },
              { step: 4, label: "Pay", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon4.webp" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center gap-3">
                <img src={s.icon} alt={s.label} className="w-28 h-28 sm:w-32 sm:h-32 object-contain" />
                <span className="text-xs text-muted-foreground font-medium mt-2">Step {s.step}</span>
                <span className="text-base sm:text-lg font-bold text-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Read More button */}
          <div className="flex justify-center mt-12">
            <button className="px-8 py-3 border border-foreground rounded text-sm font-medium text-foreground hover:bg-foreground hover:text-background transition-colors">
              Read More
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section - Card style like cellpay.us */}
      <section className="bg-muted pb-14 sm:pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-card rounded-xl border border-destructive/20 shadow-sm overflow-hidden px-6 sm:px-10 py-10 sm:py-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-destructive text-center mb-10">FAQ</h2>
            <div className="max-w-3xl mx-auto divide-y divide-border">
              {[
                {
                  q: "What is Cellpay?",
                  a: "Local and international calling made easy and secure. We make calling easy, safe, and secure based on the budget that works for you. Our method has optimized national and international calling that connects through the recipient's service provider using their local phone, saving money with a prepaid bill, and ensuring quality connection.",
                },
                {
                  q: "How does Cellpay work?",
                  a: "With the reliability of modern technology and traditional phone lines, our services allow you the flexibility to call any phone from anywhere. Connecting through your local phone line means there is no need for an internet connection and no dropped calls. To avoid extensive international rates, recharge online using prepaid bill pay or invest in one of our wireless SIM card options.",
                },
                {
                  q: "Is Cellpay for real?",
                  a: "With prepaid bill pay for premium-quality calls to landlines and mobile phones, you pay based on your unique calling behavior. Know exactly what you're paying for using Cellpay's easy, reliable, and secure service.",
                },
                {
                  q: "Is Cellpay secure?",
                  a: "Send credits to friends and family using their local provider. Recharge your prepaid bill or set up a wireless SIM card for trusted service that's seamless every time. For a world without borders, get started with Cellpay for affordable calls at any time. It's easy and secure.",
                },
              ].map((faq, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer flex items-center justify-between py-5 text-base font-semibold text-foreground hover:text-destructive transition-colors">
                    {faq.q}
                    <span className="ml-4 flex-shrink-0 w-7 h-7 rounded-full border border-muted-foreground/30 flex items-center justify-center text-muted-foreground group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <div className="pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Dark teal like cellpay.us */}
      <footer className="bg-[hsl(var(--foreground))] text-background/70 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            {/* Logo & Description */}
            <div>
              <h3 className="text-xl font-bold text-background mb-3">CellPay</h3>
              <p className="text-sm leading-relaxed">
                Cellpay is an authorized national payment center. As an authorized national payment center it is our duty to provide you with the highest customer service.
              </p>
            </div>

            {/* Policy Links */}
            <div>
              <h4 className="text-destructive font-bold text-lg mb-4">Policy</h4>
              <ul className="space-y-2 text-sm">
                <li className="hover:text-background cursor-pointer transition-colors">Privacy Policy</li>
                <li className="hover:text-background cursor-pointer transition-colors">Returns and Refunds Policy</li>
                <li className="hover:text-background cursor-pointer transition-colors">Terms and Conditions</li>
                <li className="hover:text-background cursor-pointer transition-colors">Site Map</li>
              </ul>
            </div>

            {/* Help & FAQ */}
            <div>
              <h4 className="text-destructive font-bold text-lg mb-4">Help & FAQ</h4>
              <ul className="space-y-2 text-sm">
                <li className="hover:text-background cursor-pointer transition-colors">About Us</li>
                <li className="hover:text-background cursor-pointer transition-colors">How to use</li>
                <li className="hover:text-background cursor-pointer transition-colors">Contact Us</li>
              </ul>
            </div>
          </div>

          {/* Divider & Copyright */}
          <div className="border-t border-background/20 pt-6 text-center">
            <p className="text-sm text-background/50">© 2026 Cellpay All Rights Reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
