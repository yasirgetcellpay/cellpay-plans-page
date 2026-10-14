// SWITCHER-1014: carrier-switcher page. Text from src/content/switcher.ts (same source as the static raw HTML + JSON-LD).
// No checkout and no API calls here: the button sends the user to the existing carrier page.
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { applySeoHead } from "@/lib/seo";
import { swByPath, swJsonLd } from "@/content/switcher";
import NotFound from "./NotFound.tsx";

const Switcher = () => {
  const { pathname } = useLocation();
  const pg = swByPath(pathname);

  useEffect(() => {
    if (!pg) return;
    const hasStatic = !!document.querySelector('script[type="application/ld+json"][data-sw]');
    applySeoHead({ title: pg.title, description: pg.description, path: pg.path, ...(hasStatic ? {} : { schema: swJsonLd(pg) }) });
  }, [pg]);

  if (!pg) return <NotFound />;

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground" lang={pg.lang}>
      <nav className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to={pg.homePath} className="font-extrabold text-lg">CellPay</Link>
          <Link to={pg.altPath} className="text-sm underline">{pg.lang === "es" ? "English" : "Español"}</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-5 py-8 leading-relaxed">
        <h1 className="text-2xl md:text-3xl font-extrabold leading-tight mb-3">{pg.h1}</h1>
        <p className="mb-4">{pg.intro}</p>
        <ol className="list-decimal pl-6 mb-6">
          {pg.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <a href={pg.ctaHref} className="inline-block rounded-lg bg-primary text-primary-foreground font-extrabold px-6 py-3 mb-8">
          {pg.cta}
        </a>
        <h2 className="text-xl font-extrabold mb-2">{pg.methodsTitle}</h2>
        <p className="mb-4">{pg.methods} {pg.fee}</p>
        <p className="mb-8"><a href={pg.guideHref} className="underline">{pg.guide}</a></p>
        <h2 className="text-xl font-extrabold mb-3">{pg.faqTitle}</h2>
        {pg.faqs.map((f) => (
          <div key={f.q} className="mb-4">
            <h3 className="font-bold">{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </main>
    </div>
  );
};

export default Switcher;
