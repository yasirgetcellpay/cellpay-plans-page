import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { fetchCarriers, type Carrier } from "@/services/apiWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialogs } from "@/components/AuthDialogs";
import { PaymentBar } from "@/components/PaymentBar";
import { Footer } from "@/components/Footer";
import cellpayLogo from "@/assets/cellpay-logo.webp";

type ApiCarrier = Carrier;

const LOGO_BASE = "https://www.cellpay.us/webp/v4/home";

const Home = () => {
  const [carriers, setCarriers] = useState<ApiCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, logout } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);

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
      {/* Simple navbar — white background, green bottom border */}
      <nav className="w-full bg-card border-b-4 border-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex-shrink-0">
            <img src={cellpayLogo} alt="CellPay" className="h-10" />
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="text-sm font-medium text-destructive hover:underline"
              >
                Log Out
              </button>
            ) : (
              <>
                <button
                  onClick={() => setAuthMode("login")}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  Log In
                </button>
                <a
                  href="#carriers"
                  className="px-5 py-2 rounded text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                >
                  Recharge Now
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero banner — dark green gradient */}
      <section className="bg-gradient-to-r from-plan-tier1 to-plan-tier2 py-6 sm:py-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground tracking-tight">
          Service Plans
        </h1>
      </section>

      {/* Carrier Grid */}
      <main id="carriers" className="flex-1 px-4 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold text-foreground mb-6 text-center">Choose a Carrier</h2>

          {loading && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center justify-center bg-card rounded-lg border border-border p-4 h-28 sm:h-32 animate-pulse"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-muted" />
                  <div className="mt-2 w-16 h-3 rounded bg-muted" />
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-16">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {carriers.map((carrier) => {
                const slug = carrier.slug || "";
                const displayName = carrier.name || slug;
                const logoUrl = `${LOGO_BASE}/${slug}.webp`;

                return (
                  <Link
                    key={carrier.id ?? slug}
                    to={`/${slug}`}
                    className="group flex flex-col items-center justify-center bg-card rounded-lg border border-border hover:border-primary hover:shadow-lg transition-all duration-200 p-4 h-28 sm:h-32"
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
                          span.className = "text-sm font-bold text-foreground text-center";
                          span.textContent = displayName;
                          parent.appendChild(span);
                        }
                      }}
                    />
                    <span className="mt-2 text-xs font-medium text-muted-foreground group-hover:text-foreground text-center">
                      {displayName}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <PaymentBar />
      <Footer />

      <AuthDialogs
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitchMode={setAuthMode}
      />
    </div>
  );
};

export default Home;
