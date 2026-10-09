import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";
import { useLang } from "@/lib/i18n";
// TOP4-T3-1009: EN/ES text lives in src/content/howToUse.ts (also used by vite.config.ts for the prerendered head).
// PAYCOPY-1008: payment list inside it follows src/config/paymentFlags.ts.
import { HOW_TO_USE } from "@/content/howToUse";

const HowToUse = () => {
  const lang = useLang();
  const pg = HOW_TO_USE[lang === "es" ? "es" : "en"];
  useEffect(() => {
    applySeoHead({
      title: pg.title,
      description: pg.description,
      path: pg.path,
    });
  }, [pg]);
  return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-foreground mb-6">{pg.h1}</h1>
      <p className="text-muted-foreground mb-8">{pg.intro}</p>
      <div className="space-y-6">
        {pg.steps.map((s) => (
          <div key={s.num} className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              {s.num}
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">{s.title}</h2>
              <p className="text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-3">{pg.tipsTitle}</h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          {pg.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
          <li>
            {pg.guidesLabel}
            {pg.guides.map(([href, text], i) => (
              <span key={href}>
                {i > 0 && " · "}
                <a href={href} className="underline">{text}</a>
              </span>
            ))}
          </li>
        </ul>
      </div>
    </main>
    <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" lang={lang} />
  </div>
  );
};

export default HowToUse;
