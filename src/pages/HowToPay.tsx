// AEO-PAGES-1007: /how-to-pay/{carrier} and /es/como-pagar/{carrier}. Text comes from src/content/howToPay.ts (same source
// as the static raw HTML + JSON-LD in vite.config.ts). Plan prices load live from the carrier catalog; no fee amount anywhere.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchCarrierView } from "@/services/apiWrapper";
import { applySeoHead } from "@/lib/seo";
import { howToPayByPath, howToPayJsonLd, htpPlanNames, htpPlansNote } from "@/content/howToPay";
import NotFound from "./NotFound.tsx";

type LivePlan = { label: string };

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Reads whatever plan shape carriers/view returns (array of plans, or a range-plan object) without inventing prices.
function extractPlans(data: unknown, slug: string, es: boolean): LivePlan[] {
  const out: LivePlan[] = [];
  const d = (data ?? {}) as Record<string, unknown>;
  const lists = [d.carrier_plans, d.fixed_plans, (d.carrier_plans as Record<string, unknown> | undefined)?.fixed_plans];
  for (const l of lists) {
    if (!Array.isArray(l)) continue;
    for (const p of l) {
      const o = (p ?? {}) as Record<string, unknown>;
      const amount = Number(o.amount ?? o.price ?? 0);
      if (!(amount > 0)) continue;
      const desc = String(o.description ?? o.name ?? "").split(",")[0].trim();
      out.push({ label: desc ? `${money(amount)} — ${desc}` : money(amount) });
    }
  }
  const cp = d.carrier_plans as Record<string, unknown> | undefined;
  if (cp && !Array.isArray(cp) && (cp.rangePlan === true || (typeof cp.rangePlan === "string" && cp.rangePlan !== ""))) {
    const c = (cp.carrier ?? {}) as Record<string, unknown>;
    const min = Number(c.rangeMin ?? 0);
    let max = Number(c.rangeMax ?? 0);
    if (slug === "topup-at" && max > 150) max = 150; // same cap as DynamicCarrier (CS-1)
    if (min > 0 && max > 0) out.push({ label: es ? `Monto personalizado: ${money(min)}–${money(max)}` : `Custom amount: ${money(min)}–${money(max)}` });
  }
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.label) ? false : (seen.add(p.label), true)));
}

const HowToPay = () => {
  const { pathname } = useLocation();
  const pg = howToPayByPath(pathname);
  const [plans, setPlans] = useState<LivePlan[] | null>(null);

  useEffect(() => {
    if (!pg) return;
    const hasStatic = !!document.querySelector('script[type="application/ld+json"][data-htp]');
    applySeoHead({ title: pg.title, description: pg.description, path: pg.path, ...(hasStatic ? {} : { schema: howToPayJsonLd(pg) }) });
    let cancelled = false;
    setPlans(null);
    fetchCarrierView(pg.carrierSlug)
      .then((data) => { if (!cancelled) setPlans(extractPlans(data, pg.carrierSlug, pg.lang === "es")); })
      .catch(() => { if (!cancelled) setPlans([]); });
    return () => { cancelled = true; };
  }, [pg]);

  if (!pg) return <NotFound />;
  const L = pg.labels;

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground" lang={pg.lang}>
      <nav className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center">
          <Link to={pg.lang === "es" ? "/es" : "/"} className="font-extrabold text-lg">CellPay</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-5 py-8 leading-relaxed">
        <h1 className="text-2xl md:text-3xl font-extrabold leading-tight mb-4">{pg.h1}</h1>
        <div className="rounded-xl border border-border bg-muted/40 p-4 mb-6">
          <p>{pg.intro}</p>
          <a href={pg.checkoutPath} className="inline-block mt-3 rounded-lg bg-primary text-primary-foreground font-bold px-5 py-2.5">{L.payNow}</a>
        </div>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{L.steps}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          {pg.steps.map((s, i) => (
            <li key={i} id={`step-${i + 1}`}><strong>{s.name}.</strong> {s.text}</li>
          ))}
        </ol>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{L.need}</h2>
        <ul className="list-disc pl-6 space-y-1">{pg.need.map((n) => <li key={n}>{n}</li>)}</ul>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{L.fees}</h2>
        <table className="w-full text-sm border border-border">
          <thead><tr className="bg-muted/40"><th className="text-left p-2">{L.item}</th><th className="text-left p-2">{L.amount}</th></tr></thead>
          <tbody>{pg.feeRows.map(([a, b]) => <tr key={a} className="border-t border-border"><td className="p-2">{a}</td><td className="p-2">{b}</td></tr>)}</tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-1">{pg.feeNote}</p>

        <h3 className="font-bold mt-5 mb-2">{pg.plansLabel}</h3>
        {plans === null ? (
          <>
            {/* AI-ANSWER-1010: same markup as the static raw HTML (howToPayStaticHtml) until the live list arrives */}
            <ul className="list-disc pl-6 text-sm space-y-1">{htpPlanNames(pg).map((n) => <li key={n}>{n}</li>)}</ul>
            <p className="text-sm text-muted-foreground mt-2">{htpPlansNote(pg)}</p>
          </>
        ) : plans.length > 0 ? (
          <ul className="list-disc pl-6 text-sm space-y-1">{plans.map((p) => <li key={p.label}>{p.label}</li>)}</ul>
        ) : (
          <p className="text-sm"><a href={pg.checkoutPath} className="underline">{L.payNow}</a></p>
        )}

        <h2 className="text-xl font-extrabold mt-8 mb-3">{L.other}</h2>
        <p>{pg.otherWays}</p>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{pg.someoneElseTitle}</h2>
        <p>{pg.someoneElse}</p>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{pg.autoPayTitle}</h2>
        <p>{pg.autoPay} <a href={pg.checkoutPath} className="underline">{L.payNow}</a></p>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{L.faq}</h2>
        {pg.faqs.map((f) => (
          <div key={f.q} className="mb-4">
            <h3 className="font-bold">{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}

        <p className="text-xs text-muted-foreground mt-8">{pg.disclaimer}</p>
        <p className="text-xs text-muted-foreground">{pg.updated}</p>

        <h2 className="text-xl font-extrabold mt-8 mb-3">{L.related}</h2>
        <ul className="list-disc pl-6 space-y-1">
          {pg.related.map(([h, t]) => <li key={h}><a href={h} className="underline">{t}</a></li>)}
        </ul>
      </main>
    </div>
  );
};

export default HowToPay;
