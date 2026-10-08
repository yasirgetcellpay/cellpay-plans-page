import type { Language } from "@/lib/i18n";

// INPUTS-1008 (item 4): Spanish legal bar on the Spanish home page (/es). Same meaning as the English text; English unchanged.
export const LegalBar = ({ lang = "en" }: { lang?: Language }) => (
  <div className="bg-cellpay-green text-primary-foreground py-4 text-[10px] md:text-xs">
    {lang === "es" ? (
    <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">
      Todos los precios mostrados son precios minoristas completos por período de servicio de 30 días. Los impuestos y tarifas son adicionales y varían según la ubicación. Los planes de servicio no son reembolsables. Las velocidades de datos se reducen a 2G (64 kbps) después de agotar la asignación mensual de alta velocidad. Durante la congestión de la red, los clientes pueden experimentar velocidades más bajas que los clientes de pospago. Las funciones internacionales están sujetas a cambios. La cobertura no está disponible en todas partes.{" "}
      <a href="/terms-and-conditions" className="underline font-bold ml-1">
        [Ver Términos y Condiciones completos]
      </a>
    </div>
    ) : (
    <div className="max-w-7xl mx-auto px-4 text-center leading-relaxed">
      All prices shown are full retail prices per 30-day service period. Taxes and fees are additional and vary by location. Service plans are non-refundable. Data speeds reduced to 2G (64 kbps) after monthly high-speed allotment. During network congestion, customers may experience reduced speeds versus postpaid customers. International features subject to change. Coverage not available everywhere.{" "}
      <a href="/terms-and-conditions" className="underline font-bold ml-1">
        [View full Terms &amp; Conditions]
      </a>
    </div>
    )}
  </div>
);
