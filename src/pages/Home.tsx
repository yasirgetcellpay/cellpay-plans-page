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
      <section className="bg-gray-50 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-8">
            How it works in <span className="text-red-500">4 easy steps</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { step: 1, label: "Choose a Carrier", icon: "👆" },
              { step: 2, label: "Enter your number", icon: "📱" },
              { step: 3, label: "Select a plan", icon: "📋" },
              { step: 4, label: "Pay", icon: "✅" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center gap-2">
                <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center text-2xl">
                  {s.icon}
                </div>
                <span className="text-xs text-muted-foreground">Step {s.step}</span>
                <span className="text-sm font-semibold text-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 text-center text-xs">
        <p>© 2026 All rights reserved.</p>
        <p className="text-[10px] opacity-50 mt-2 max-w-2xl mx-auto px-4">
          All carrier names and trademarks are property of their respective owners.
        </p>
      </footer>
    </div>
  );
};

export default Home;
