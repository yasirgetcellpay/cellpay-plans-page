// PRIVACY-1007: one page for /privacy-policy (English) and /es/privacy-policy (Spanish).
// The policy text lives in src/content/privacyPolicy.ts (same source as the static raw HTML in vite.config.ts).
import { Fragment, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";
import { useLang } from "@/lib/i18n";
import { PRIVACY_PAGES, type PpInline } from "@/content/privacyPolicy";

const Inline = ({ x }: { x: PpInline }) => {
  if (typeof x === "string") return <>{x}</>;
  if ("strong" in x) return <strong>{x.strong}</strong>;
  const external = x.href.startsWith("http");
  return (
    <a href={x.href} className="underline" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {x.text}
    </a>
  );
};

const PrivacyPolicy = () => {
  const lang = useLang();
  const pg = PRIVACY_PAGES[lang];
  useEffect(() => {
    applySeoHead({
      title: pg.title,
      description: pg.description,
      path: pg.path,
    });
  }, [pg]);
  return (
  <div className="min-h-screen flex flex-col bg-background" lang={pg.lang}>
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">{pg.h1}</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">
        <p><strong className="text-foreground">{pg.effectiveLabel}</strong> {pg.effectiveDate}</p>
        {pg.sections.map((s) => (
          <Fragment key={s.h}>
            <h2 className="text-lg font-bold text-foreground pt-3">{s.h}</h2>
            {s.blocks.map((b, i) =>
              "p" in b ? (
                <p key={i}>{b.p.map((x, j) => <Inline key={j} x={x} />)}</p>
              ) : (
                <ul key={i} className="list-disc list-inside space-y-1">
                  {b.ul.map((li, j) => (
                    <li key={j}>{li.map((x, k) => <Inline key={k} x={x} />)}</li>
                  ))}
                </ul>
              ),
            )}
          </Fragment>
        ))}
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" lang={pg.lang} />
  </div>
  );
};

export default PrivacyPolicy;
