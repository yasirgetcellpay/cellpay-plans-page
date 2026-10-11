// CARRIER-ASSIST-1011: "Not sure of your carrier?" bottom sheet (EN/ES). Loaded only when opened.
import { useEffect } from "react";
import simpleLogo from "@/assets/simple-mobile-logo.png";
import boostLogo from "@/assets/boost-logo.png";
import metroLogo from "@/assets/metro-logo.svg";
import cricketLogo from "@/assets/cricket-logo.webp";
import ultraLogo from "@/assets/ultra-mobile-logo.png";
import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import totalLogo from "@/assets/total-wireless-logo.png";
import h2oLogo from "@/assets/h2o-logo.png";

const COPY = {
  en: {
    title: "Not sure of your carrier?",
    sub: "Pick the name on your SIM card or bill, not the network name.",
    steps: [
      <>Dial <b>611</b> (or <b>*611</b>) from the phone. It tells you your carrier.</>,
      <>Check the <b>SIM card</b> or its packaging. The brand is printed on it.</>,
      <>Open your <b>bill or carrier app</b>. The name at the top is your carrier.</>,
    ],
    tips: "Common brands: choose the brand, not the network",
    rows: [
      { logo: simpleLogo, name: "Simple Mobile", tip: "Network may show T-Mobile. Choose Simple Mobile." },
      { logo: boostLogo, name: "Boost Mobile", tip: "Choose Boost Mobile." },
      { logo: metroLogo, name: "Metro PCS", tip: "Network may show T-Mobile. Choose Metro PCS." },
      { logo: cricketLogo, name: "Cricket Wireless", tip: "Network may show AT&T. Choose Cricket Wireless." },
      { logo: ultraLogo, name: "Ultra Mobile", tip: "Network may show T-Mobile. Choose Ultra Mobile." },
      { logo: straightTalkLogo, name: "Straight Talk", tip: "Network may show Verizon, AT&T or T-Mobile. Choose Straight Talk." },
      { logo: totalLogo, name: "Total Wireless", tip: "Network may show Verizon. Choose Total Wireless." },
      { logo: h2oLogo, name: "H2O Wireless", tip: "Network may show AT&T. Choose H2O Wireless." },
    ],
    wrong: "Wrong carrier? Your payment would be refunded, so check first.",
    close: "Close",
  },
  es: {
    title: "¿No está seguro de su compañía?",
    sub: "Elija el nombre que aparece en su tarjeta SIM o en su factura, no el nombre de la red.",
    steps: [
      <>Marque <b>611</b> (o <b>*611</b>) desde el teléfono. Le dirán su compañía.</>,
      <>Revise la <b>tarjeta SIM</b> o su empaque. La marca está impresa.</>,
      <>Abra su <b>factura o la app de su compañía</b>. El nombre arriba es su compañía.</>,
    ],
    tips: "Marcas comunes: elija la marca, no la red",
    rows: [
      { logo: simpleLogo, name: "Simple Mobile", tip: "La red puede mostrar T-Mobile. Elija Simple Mobile." },
      { logo: boostLogo, name: "Boost Mobile", tip: "Elija Boost Mobile." },
      { logo: metroLogo, name: "Metro PCS", tip: "La red puede mostrar T-Mobile. Elija Metro PCS." },
      { logo: cricketLogo, name: "Cricket Wireless", tip: "La red puede mostrar AT&T. Elija Cricket Wireless." },
      { logo: ultraLogo, name: "Ultra Mobile", tip: "La red puede mostrar T-Mobile. Elija Ultra Mobile." },
      { logo: straightTalkLogo, name: "Straight Talk", tip: "La red puede mostrar Verizon, AT&T o T-Mobile. Elija Straight Talk." },
      { logo: totalLogo, name: "Total Wireless", tip: "La red puede mostrar Verizon. Elija Total Wireless." },
      { logo: h2oLogo, name: "H2O Wireless", tip: "La red puede mostrar AT&T. Elija H2O Wireless." },
    ],
    wrong: "¿Compañía equivocada? Su pago sería reembolsado, así que revise primero.",
    close: "Cerrar",
  },
} as const;

export default function CarrierHelpSheet({ lang, onClose }: { lang: "en" | "es"; onClose: () => void }) {
  const c = COPY[lang === "es" ? "es" : "en"];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="carrier-help-sheet">
      <div role="dialog" aria-modal="true" aria-label={c.title} className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(100dvh - 1.5rem)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-foreground">{c.title}</h3>
          <button type="button" autoFocus onClick={onClose} data-testid="carrier-help-close" className="text-sm underline text-muted-foreground shrink-0">{c.close}</button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{c.sub}</p>
        <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-sm text-foreground">
          {c.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <h4 className="text-sm font-bold text-foreground mt-4 mb-1">{c.tips}</h4>
        <ul>
          {c.rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3 py-2 border-t border-border">
              <img src={r.logo} alt={r.name} loading="lazy" width={72} height={24} className="h-6 w-[72px] object-contain shrink-0" />
              <span className="text-xs text-foreground">{r.tip}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs rounded-lg bg-muted text-foreground p-3 mt-3">{c.wrong}</p>
      </div>
    </div>
  );
}
