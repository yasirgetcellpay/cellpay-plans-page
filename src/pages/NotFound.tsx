import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { applySeoHead } from "@/lib/seo";
import cellpayLogo from "@/assets/cellpay-logo.svg";

// GO-LANDERS-1007: popular pay pages + help links for the not-found page (EN + ES). Display only.
const NF_CARRIERS: Array<[string, string]> = [
  ["Metro by T-Mobile", "/metropcs.html"],
  ["T-Mobile", "/tmobile-flexi.html"],
  ["AT&T Prepaid", "/topup-at.html"],
  ["Verizon Prepaid", "/verizon"],
  ["Boost Mobile", "/boost.html"],
  ["Cricket Wireless", "/topup-crc.html"],
  ["Simple Mobile", "/s1.html"],
  ["Straight Talk", "/straight-talk.html"],
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    // Tell crawlers not to index soft-404 pages
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const original = robots?.getAttribute("content") ?? null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,follow");
    applySeoHead({
      title: "Page Not Found | CellPay",
      description:
        "The page you're looking for doesn't exist. Head back to CellPay to recharge any US prepaid carrier — AT&T, T-Mobile, Metro, Verizon, Boost and more.",
    });
    return () => {
      if (original !== null) robots!.setAttribute("content", original);
      else robots!.setAttribute("content", "index,follow,max-image-preview:large,max-snippet:-1");
    };
  }, [location.pathname]);

  // GO-LANDERS-1007: a real not-found page (EN + ES), still noindex,follow (above). Plain links only.
  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-center">
          <a href="/" aria-label="CellPay home">
            <img src={cellpayLogo} alt="CellPay" width={110} height={28} className="h-7 w-auto" />
          </a>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 text-center">
        <p className="text-sm font-semibold text-muted-foreground">404</p>
        <h1 className="mt-1 text-3xl font-extrabold text-foreground">Page not found</h1>
        <p className="mt-1 text-lg font-semibold text-muted-foreground" lang="es">Página no encontrada</p>
        <p className="mt-4 text-base text-muted-foreground">
          The page you are looking for is not here. It may have moved.
        </p>
        <p className="mt-1 text-base text-muted-foreground" lang="es">
          La página que busca no está aquí. Puede que se haya movido.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-bold text-primary-foreground hover:opacity-90">
            Go to the home page
          </a>
          <a href="/es" lang="es" className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 font-bold text-foreground hover:bg-muted">
            Ir al inicio en español
          </a>
        </div>
        <h2 className="mt-10 text-lg font-bold text-foreground">Pay a prepaid phone bill</h2>
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {NF_CARRIERS.map(([name, href]) => (
            <li key={href}>
              <a href={href} className="block rounded-lg border border-border bg-card px-3 py-2 font-semibold text-foreground hover:bg-muted">
                {name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted-foreground">
          Need help? <a href="/faq" className="text-primary underline">FAQ</a> ·{" "}
          <a href="/contact-us" className="text-primary underline">Contact us</a>
        </p>
      </main>
    </div>
  );
};

export default NotFound;
