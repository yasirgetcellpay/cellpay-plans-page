import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { listCarriers } from "@/lib/cellpay-api";

interface ApiCarrier {
  id?: number;
  name?: string;
  slug?: string;
  title?: string;
  logo?: string;
  image?: string;
  active?: boolean;
  [key: string]: unknown;
}

const Home = () => {
  const [carriers, setCarriers] = useState<ApiCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const result = (await listCarriers()) as { success?: boolean; data?: ApiCarrier[] } | ApiCarrier[];
        if (cancelled) return;
        const list = Array.isArray(result) ? result : (result as { data?: ApiCarrier[] }).data;
        if (Array.isArray(list)) {
          setCarriers(list.filter((c) => c.active !== false));
        } else {
          setError("Unexpected API response");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load carriers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
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

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading carriers...</p>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl w-full">
            {carriers.map((carrier) => {
              const slug = carrier.slug || "";
              const displayName = carrier.title || carrier.name || slug;
              return (
                <Link
                  key={carrier.id ?? slug}
                  to={`/${slug}`}
                  className="group bg-card rounded-xl border border-border shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden active:scale-[0.97]"
                >
                  <div className="flex items-center justify-center h-24 sm:h-32 bg-background p-4">
                    {carrier.logo || carrier.image ? (
                      <img
                        src={(carrier.logo || carrier.image) as string}
                        alt={displayName}
                        className="max-h-12 sm:max-h-16 max-w-[80%] w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-base sm:text-lg font-bold text-foreground text-center">
                        {displayName}
                      </span>
                    )}
                  </div>
                  <div className="bg-primary py-2.5 text-center">
                    <span className="text-primary-foreground font-bold text-xs sm:text-sm">
                      {displayName}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
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
