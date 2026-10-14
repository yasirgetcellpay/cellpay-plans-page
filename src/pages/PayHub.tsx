// ES-FIRST-1014: bill-pay hub page. Text from src/content/payHub.ts (same source as the static raw HTML + JSON-LD).
// No checkout and no API calls here: the number box + carrier buttons send the user to the existing carrier page.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { applySeoHead } from "@/lib/seo";
import { hubByPath, hubJsonLd } from "@/content/payHub";
import NotFound from "./NotFound.tsx";

const fmt = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const PayHub = () => {
  const { pathname } = useLocation();
  const pg = hubByPath(pathname);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!pg) return;
    const hasStatic = !!document.querySelector('script[type="application/ld+json"][data-hub]');
    applySeoHead({ title: pg.title, description: pg.description, path: pg.path, ...(hasStatic ? {} : { schema: hubJsonLd(pg) }) });
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
        <p className="mb-6">{pg.intro}</p>

        <section className="rounded-xl border border-border bg-card p-4 mb-8">
          <label htmlFor="hub-phone" className="block font-bold mb-2">{pg.phoneLabel}</label>
          <input
            id="hub-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(fmt(e.target.value))}
            placeholder="(XXX) XXX-XXXX"
            className="w-full h-12 px-4 rounded-lg border border-input bg-background text-center text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-2 mb-4">{pg.phoneHelp}</p>
          <h2 className="text-lg font-extrabold mb-3">{pg.carriersTitle}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pg.carriers.map((c) => (
              <a key={c.href} href={c.href} className="rounded-lg border border-border bg-background px-3 py-3 text-center font-bold hover:border-primary">
                {c.name}
              </a>
            ))}
          </div>
        </section>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{pg.methodsTitle}</h2>
        <p>{pg.methods}</p>
        <p className="text-sm text-muted-foreground mt-1">{pg.fee}</p>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{pg.guidesTitle}</h2>
        <ul className="list-disc pl-6 space-y-1">
          {pg.guides.map((g) => <li key={g.href}><a href={g.href} className="underline">{g.name}</a></li>)}
        </ul>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{pg.faqTitle}</h2>
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

export default PayHub;
