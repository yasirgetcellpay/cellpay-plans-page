// RT-3 (Oct 6, 2026): "Pay again next time" card on the order confirmation page (confirmed orders only). Saves this order's
// carrier, number and amount on this device (see lib/payAgain.ts) and links to /pay-again with a bookmark / Home Screen hint.
// Display + localStorage only: no payment, fee, Auto Pay or purchase-tracking code is touched.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { cashAppRetryInfo } from "@/lib/checkoutResume";
import type { Language } from "@/lib/i18n";
import { savePayAgain, clearPayAgain, payAgainPath } from "@/lib/payAgain";

interface PayAgainCardProps {
  lang: Language;
  slug?: string;
  carrierName?: string;
  phone?: string;
  amount?: number | string;
  brandColor: string;
}

export const PayAgainCard = ({ lang, slug, carrierName, phone, amount, brandColor }: PayAgainCardProps) => {
  const es = lang === "es";
  const [state, setState] = useState<"none" | "saved" | "removed">("none");

  useEffect(() => {
    // Prefer this tab's checkout hand-off slug (the carrier-page slug) when it is the same number as this order.
    const digits = String(phone || "").replace(/\D/g, "").slice(-10);
    let s = String(slug || "");
    try {
      const last = cashAppRetryInfo("");
      if (last && last.phone === digits) s = last.slug;
    } catch { /* ignore */ }
    if (savePayAgain({ slug: s, carrierName, phone, amount, color: brandColor })) setState("saved");
  }, [slug, carrierName, phone, amount, brandColor]);

  if (state === "none") return null;
  if (state === "removed") {
    return (
      <div className="bg-card rounded-xl border border-border p-5 text-sm text-muted-foreground" role="status">
        {es ? "Listo. Borramos su número de este dispositivo." : "Done. Your number was removed from this device."}
      </div>
    );
  }
  const carrier = carrierName ? carrierName : "";
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
        <RotateCcw className="h-5 w-5 flex-shrink-0" style={{ color: brandColor }} aria-hidden="true" />
        {es ? "Pague de nuevo la próxima vez" : "Pay again next time"}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        {es
          ? `Guardamos su número${carrier ? ` de ${carrier}` : ""} solo en este dispositivo. La próxima vez, abra su página "Pagar de nuevo" y su número ya estará escrito.`
          : `We saved your${carrier ? ` ${carrier}` : ""} number on this device only. Next time, open your Pay again page and your number is already filled in.`}
      </p>
      <Link
        to={payAgainPath(lang)}
        className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
        style={{ backgroundColor: brandColor }}
      >
        {es ? "Abrir mi página Pagar de nuevo" : "Open my Pay again page"}
      </Link>
      <p className="text-xs text-muted-foreground mt-3">
        {es
          ? "Guarde esa página: en iPhone, toque Compartir y luego \"Agregar a inicio\". En Android, toque el menú ⋮ y luego \"Agregar a la pantalla principal\". En una computadora, guárdela en sus favoritos."
          : "Save that page: on iPhone, tap Share, then \"Add to Home Screen\". On Android, tap the ⋮ menu, then \"Add to Home screen\". On a computer, bookmark it."}
      </p>
      <button
        type="button"
        onClick={() => { clearPayAgain(true); setState("removed"); }}
        className="mt-2 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {es ? "No guardar mi número" : "Don't save my number"}
      </button>
    </div>
  );
};
