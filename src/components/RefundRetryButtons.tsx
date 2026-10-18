// REFUND-RETRY-LATE-1018: receipt-page 1-tap retry buttons after a late refund. Navigation only; never submits a payment.
import { useEffect, useRef, useState } from "react"; // REFUND-RETRY-LATE-1018
import { useNavigate } from "react-router-dom"; // REFUND-RETRY-LATE-1018
import { retryButtons, retryCauseFor, recordRefund, recordRetryTap, writeRetryCtx, type RetryButton } from "@/lib/refundRetry"; // REFUND-RETRY-LATE-1018
import { resolveCheckoutFromUrl, carrierPageTarget, writeCheckoutCtx } from "@/lib/checkoutResume"; // REFUND-RETRY-LATE-1018
import { trackFunnel } from "@/lib/funnelEvents"; // REFUND-RETRY-LATE-1018
import type { Language } from "@/lib/i18n"; // REFUND-RETRY-LATE-1018

type Props = { lang: string; slug: string; phone10: string; amount: number | null; total: number; email: string; brandColor: string; hashid: string; stage: "late" }; // REFUND-RETRY-LATE-1018

export function RefundRetryButtons({ lang, slug, phone10, amount, total, email, brandColor, hashid, stage }: Props) { // REFUND-RETRY-LATE-1018
  const navigate = useNavigate(); // REFUND-RETRY-LATE-1018
  const cause = retryCauseFor(slug); // REFUND-RETRY-LATE-1018
  const [, setTick] = useState(0); // REFUND-RETRY-LATE-1018
  const [resolving, setResolving] = useState<string | null>(null); // REFUND-RETRY-LATE-1018
  const shownRef = useRef(""); // REFUND-RETRY-LATE-1018
  const L = lang as Language; // REFUND-RETRY-LATE-1018
  const amt = amount === null || !Number.isFinite(amount) ? "" : String(amount); // REFUND-RETRY-LATE-1018
  useEffect(() => { const id = window.setInterval(() => setTick((n) => n + 1), 15_000); return () => window.clearInterval(id); }, []); // REFUND-RETRY-LATE-1018
  useEffect(() => { // REFUND-RETRY-LATE-1018
    try { // REFUND-RETRY-LATE-1018
      if (!cause || shownRef.current === hashid) return; // REFUND-RETRY-LATE-1018
      shownRef.current = hashid; // REFUND-RETRY-LATE-1018
      if (/^\d{10}$/.test(phone10)) recordRefund(phone10, slug, Date.now()); // REFUND-RETRY-LATE-1018
      const shown = retryButtons(slug, lang, phone10).map((b) => b.action).join(","); // REFUND-RETRY-LATE-1018
      trackFunnel("retry_offer_shown", { carrier: slug, amount, total, retry_cause: cause, retry_action: "late," + shown, retry_to_carrier: null }, `late|${hashid}`); // REFUND-RETRY-LATE-1018
    } catch { /* ignore */ } // REFUND-RETRY-LATE-1018
  }, [cause, hashid, phone10, slug, lang, amount, total]); // REFUND-RETRY-LATE-1018
  if (!cause) return null; // REFUND-RETRY-LATE-1018
  const buttons = retryButtons(slug, lang, phone10); // REFUND-RETRY-LATE-1018
  const tap = async (b: RetryButton) => { // REFUND-RETRY-LATE-1018
    if (resolving || b.disabled) return; // REFUND-RETRY-LATE-1018
    const to = b.to_carrier || slug; // REFUND-RETRY-LATE-1018
    setResolving(`${b.action}${b.action === "to_carrier" ? "-" + to : ""}`); // REFUND-RETRY-LATE-1018
    writeRetryCtx({ cause, action: b.action, from_carrier: slug, to_carrier: to, email: email || undefined, method: undefined, stage }); // REFUND-RETRY-LATE-1018
    try { trackFunnel("retry_tapped", { carrier: slug, retry_cause: cause, retry_action: "late," + b.action, retry_to_carrier: b.action === "other_carrier" ? null : to }, String(Date.now())); } catch { /* ignore */ } // REFUND-RETRY-LATE-1018
    try { // REFUND-RETRY-LATE-1018
      if (b.action === "to_carrier") { // REFUND-RETRY-LATE-1018
        const result = await resolveCheckoutFromUrl(L, `?carrier=${to}&amount=${amt}&phone=${phone10}`, ""); // REFUND-RETRY-LATE-1018
        if (result.state) { writeCheckoutCtx(result.state); window.location.assign(`${lang === "es" ? "/es" : ""}/checkout`); } // REFUND-RETRY-LATE-1018
        else navigate(result.to); // REFUND-RETRY-LATE-1018
      } else if (b.action === "amount") navigate(carrierPageTarget(L, slug, phone10, undefined, "", "")); // REFUND-RETRY-LATE-1018
      else if (b.action === "number") navigate(carrierPageTarget(L, slug, phone10, amt || undefined, "", ""), { state: { focusPhone: true, selectPhone: true } }); // REFUND-RETRY-LATE-1018
      else if (b.action === "other_carrier") navigate(lang === "es" ? "/es" : "/"); // REFUND-RETRY-LATE-1018
      else { recordRetryTap(phone10); navigate(carrierPageTarget(L, slug, phone10, amt || undefined, "", "")); } // REFUND-RETRY-LATE-1018
    } catch { /* keep the panel */ } // REFUND-RETRY-LATE-1018
    finally { setResolving(null); } // REFUND-RETRY-LATE-1018
  }; // REFUND-RETRY-LATE-1018
  return ( // REFUND-RETRY-LATE-1018
    <div className="mt-4 flex flex-col gap-2 max-w-sm mx-auto"> {/* REFUND-RETRY-LATE-1018 */}
      {buttons.map((b, i) => { // REFUND-RETRY-LATE-1018
        const key = `${b.action}${b.action === "to_carrier" && b.to_carrier ? "-" + b.to_carrier : ""}`; // REFUND-RETRY-LATE-1018
        return ( // REFUND-RETRY-LATE-1018
          <button key={key} type="button" data-testid={`retry-btn-${key}`} disabled={!!resolving || b.disabled} onClick={() => void tap(b)} // REFUND-RETRY-LATE-1018
            className={`w-full h-11 px-4 rounded-lg font-bold text-sm border-2 disabled:opacity-60 ${i === 0 ? "text-primary-foreground" : "bg-background"}`} // REFUND-RETRY-LATE-1018
            style={i === 0 ? { backgroundColor: brandColor, borderColor: brandColor } : { borderColor: brandColor, color: brandColor }}> {/* REFUND-RETRY-LATE-1018 */}
            {resolving === key ? "…" : b.label} {/* REFUND-RETRY-LATE-1018 */}
          </button> // REFUND-RETRY-LATE-1018
        ); // REFUND-RETRY-LATE-1018
      })} {/* REFUND-RETRY-LATE-1018 */}
    </div> // REFUND-RETRY-LATE-1018
  ); // REFUND-RETRY-LATE-1018
} // REFUND-RETRY-LATE-1018
