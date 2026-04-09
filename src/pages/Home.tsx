import { useState, useEffect } from "react";
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
      <section className="bg-muted py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-10">
            How it works in <span className="text-destructive">4 easy steps</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { step: 1, label: "Choose a Carrier", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon1.webp" },
              { step: 2, label: "Enter your number", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon2.webp" },
              { step: 3, label: "Select a plan", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon3.webp" },
              { step: 4, label: "Pay", icon: "https://www.cellpay.us/webp/v4/home/easy-steps-icon4.webp" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center gap-3">
                <img src={s.icon} alt={s.label} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
                <span className="text-xs text-muted-foreground font-medium">Step {s.step}</span>
                <span className="text-sm sm:text-base font-semibold text-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 sm:py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4">
            Pay Your Prepaid Mobile Bills with Ease Using CellPay
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Welcome to CellPay – your one-stop solution for seamless and secure prepaid bill payments. With CellPay, managing your mobile bills has never been easier. Whether you're looking to pay your Simple Mobile, Net10, US Cellular, or any other prepaid mobile bill, CellPay has you covered.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Our user-friendly platform allows you to conveniently pay your bills online, anytime, anywhere. Say goodbye to long queues and late fees – with CellPay, you can pay your bills with just a few clicks.
          </p>

          <h3 className="text-lg font-bold text-foreground mb-3">Need Customer Service Assistance?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            CellPay is here to help. Our dedicated team is available 24/7 to assist you with any queries or concerns you may have. For added convenience, CellPay offers a variety of payment options, including credit card, debit card, and online banking apps.
          </p>

          <h3 className="text-lg font-bold text-foreground mb-3">CellPay - Fast & Secure Prepaid Bill Payments</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Join the millions of satisfied customers who trust CellPay for their prepaid bill payments. Experience the ease and convenience of paying your bills with CellPay today.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">faq</p>
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
            <details key={i} className="mb-3 bg-card rounded-lg border border-border overflow-hidden">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground hover:bg-accent/50 transition-colors">
                {faq.q}
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-muted py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-sm">© 2026 CellPay. All rights reserved.</p>
          <p className="text-xs opacity-60 mt-2 max-w-2xl mx-auto">
            All carrier names and trademarks are property of their respective owners.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs opacity-60">
            <span>About Us</span>
            <span>·</span>
            <span>Contact Us</span>
            <span>·</span>
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Terms and Conditions</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
