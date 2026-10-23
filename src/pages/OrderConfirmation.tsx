import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { callProxy } from "@/services/apiWrapper";
import { sendTracked } from "@/lib/trackQueue"; // DB-OUTAGE-TRACK-1017
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { useLang, t, langPath } from "@/lib/i18n";
import { applySeoHead } from "@/lib/seo";
import { PayAgainCard } from "@/components/PayAgainCard";
import { ReminderOptIn } from "@/components/ReminderOptIn";
import { AutoPayReceiptCard } from "@/components/AutoPayReceiptCard";
import { NotWorkingYet } from "@/components/NotWorkingYet";
import { supabase } from "@/integrations/supabase/client"; // AUTOPAY-POSTPURCHASE-1013
import { carrierPagePath, carrierPageTarget } from "@/lib/checkoutResume"; // AUTOPAY-POSTPURCHASE-1013 // ULTRA-FAIL-MSG-1022
import { Button } from "@/components/ui/button"; // ULTRA-FAIL-MSG-1022
import { loadTextFrom } from "@/lib/loadTextPick"; // ULTRA-FAIL-MSG-1022
import { trackFunnel } from "@/lib/funnelEvents"; // AUTOPAY-POSTPURCHASE-1013
import { fetchRefundState, refundedPanelText, isPayWord, type RefundState } from "@/lib/orderRefundState"; // REFUNDED-STATE-1017
import { retryCauseFor, retryReasonText } from "@/lib/refundRetry"; // REFUND-RETRY-LATE-1018
import { RefundRetryButtons } from "@/components/RefundRetryButtons"; // REFUND-RETRY-LATE-1018

interface TransactionData {
  id?: number;
  amount?: number;
  fee?: number;
  phone_number?: string;
  pin?: string;
  transactionId?: string;
  transaction_id?: string;
  hashid?: string;
  created?: string;
  carrier?: { name?: string; slug?: string };
  user?: { email?: string; first_name?: string; last_name?: string };
  [key: string]: unknown;
}

// Receipt amount -> number (same parsing as before; feeds the purchase value).
const parseAmount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

// ULTRA-FAIL-MSG-1022: inspect received errors for display only, without changing refund detection.
function ultraRefundKind(value: unknown): "amount" | "generic" | null {
  const messages: string[] = [];
  const scan = (node: unknown, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 5) return;
    for (const [key, field] of Object.entries(node)) {
      if (/^(code|error_?code|response_?code)$/i.test(key) && String(field).trim() === "1065") messages.push("1065");
      if (/^(load_?text|loadmessage|msg|message|error|error_?message)$/i.test(key) && typeof field === "string") messages.push(field.trim());
      if (field && typeof field === "object") scan(field, depth + 1);
    }
  };
  scan(value);
  if (messages.some((text) => /invalid\s+amount|\b1065\b/i.test(text))) return "amount";
  const load = loadTextFrom(value);
  const text = load || messages.find((message) => message && !/auto[\s-]?refund/i.test(message)) || messages.join(" ");
  return !text.trim() || /error during refill/i.test(text) ? "generic" : null;
}

const OrderConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lang = useLang();
  const tr = t(lang);
  const hashid = searchParams.get("hashid") || "";
  const brandColor = searchParams.get("color") || "hsl(142,70%,40%)";
  const carrierName = searchParams.get("carrier") || "";

  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enhancedPushedRef = useRef(false);
  const [refunded, setRefunded] = useState<RefundState | null>(null); // REFUNDED-STATE-1017
  const [ultraResultKind, setUltraResultKind] = useState<"amount" | "generic" | null>(null); // ULTRA-FAIL-MSG-1022
  const retryInfoRef = useRef<{ phone10: string; amount: number | null; email: string }>({ phone10: "", amount: null, email: "" }); // REFUND-RETRY-LATE-1018
  const thisDeviceRef = useRef(false); // REFUND-RETRY-LATE-1018
  const loadAtRef = useRef(Date.now()); // REFUND-RETRY-LATE-1018
  const keepRetryInfo = (t: TransactionData | null | undefined) => { try { const p = String(t?.phone_number ?? "").replace(/\D/g, "").slice(-10); const a = Number(String(t?.amount ?? "").replace(/[^0-9.-]/g, "")); retryInfoRef.current = { phone10: p.length === 10 ? p : "", amount: t?.amount === undefined || t?.amount === null || !Number.isFinite(a) ? null : a, email: String(t?.user?.email ?? "").trim() }; } catch { /* ignore */ } }; // REFUND-RETRY-LATE-1018

  const formatE164 = (phone?: string): string => {
    if (!phone) return "";
    const d = phone.replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    if (d.length > 11 && d.length <= 15) return `+${d}`;
    return "";
  };

  useEffect(() => {
    if (enhancedPushedRef.current) return;
    if (!transaction) return;
    const email = transaction.user?.email?.trim().toLowerCase() || "";
    const phone = formatE164(transaction.phone_number);
    if (!email && !phone) return;
    enhancedPushedRef.current = true;
    // @ts-expect-error - dataLayer global
    window.dataLayer = window.dataLayer || [];
    // @ts-expect-error - dataLayer global
    window.dataLayer.push({
      event: lang === "es" ? "conversion_enhanced_es" : "conversion_enhanced_en",
      enhanced_conversion_data: { email, phone_number: phone },
    });
  }, [transaction, lang]);

  useEffect(() => {
    const carrier = carrierName || transaction?.carrier?.name || "prepaid";
    applySeoHead({
      title: `Order Confirmation | CellPay`,
      description: `Your ${carrier} refill order has been received. View your CellPay receipt, transaction details, and delivery status for this prepaid recharge.`.slice(
        0,
        160,
      ),
    });
    // Confirmation pages should not be indexed
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const original = robots?.getAttribute("content") ?? null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,follow");
    return () => {
      if (original !== null) robots!.setAttribute("content", original);
    };
  }, [carrierName, transaction?.carrier?.name]);

  useEffect(() => {
    if (!hashid) {
      setError(tr.noTransaction);
      setLoading(false);
      return;
    }
    fetchTransaction();
  }, [hashid]);

  useEffect(() => { // REFUND-RETRY-LATE-1018
    if (!transaction || refunded || !hashid) return; // REFUND-RETRY-LATE-1018
    let stopped = false, last = 0, busy = false; // REFUND-RETRY-LATE-1018
    const POLL = 20_000, POLL_MAX = 15 * 60_000, FOCUS_MAX = 60 * 60_000; // REFUND-RETRY-LATE-1018
    const since = () => Date.now() - loadAtRef.current; // REFUND-RETRY-LATE-1018
    const check = async (limit: number) => { // REFUND-RETRY-LATE-1018
      if (stopped || busy || !thisDeviceRef.current || since() > limit || Date.now() - last < POLL) return; // REFUND-RETRY-LATE-1018
      busy = true; last = Date.now(); // REFUND-RETRY-LATE-1018
      try { const rs = await fetchRefundState(hashid); if (rs && !stopped) { stopped = true; keepRetryInfo(transaction); setRefunded(rs); } } catch { /* keep polling */ } finally { busy = false; } // REFUND-RETRY-LATE-1018
    }; // REFUND-RETRY-LATE-1018
    const tick = window.setInterval(() => { if (document.visibilityState === "visible") void check(POLL_MAX); }, POLL); // REFUND-RETRY-LATE-1018
    const onVis = () => { if (document.visibilityState === "visible") void check(FOCUS_MAX); }; // REFUND-RETRY-LATE-1018
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", onVis); // REFUND-RETRY-LATE-1018
    const amount = parseAmount(transaction.amount), total = Math.round((amount + Number(transaction.fee || 0)) * 100) / 100; // REFUND-RETRY-LATE-1018
    const dwell = ([["4m", 4], ["8m", 8], ["15m", 15]] as const).map(([tag, min]) => window.setTimeout(() => { // REFUND-RETRY-LATE-1018
      if (!stopped && thisDeviceRef.current && document.visibilityState === "visible") trackFunnel("retry_late_alive", { carrier: transaction.carrier?.slug ?? null, amount, total, retry_action: tag }, `${hashid}|${tag}`); // REFUND-RETRY-LATE-1018
    }, Math.max(0, min * 60_000 - since()))); // REFUND-RETRY-LATE-1018
    return () => { stopped = true; window.clearInterval(tick); dwell.forEach((d) => window.clearTimeout(d)); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); }; // REFUND-RETRY-LATE-1018
  }, [transaction, refunded, hashid]); // REFUND-RETRY-LATE-1018

  const fetchTransaction = async () => {
    try {
      try { thisDeviceRef.current = sessionStorage.getItem("cp_purchase_pending") === hashid || localStorage.getItem(`cp_purchase_early:${hashid}`) !== null; } catch { /* ignore */ } // REFUND-RETRY-LATE-1018
      const refundP = fetchRefundState(hashid); // REFUNDED-STATE-1017: in parallel, 1500 ms cap, error = not refunded
      const raw = await callProxy({ endpoint: `transactions/view/${hashid}`, method: "GET" });
      setUltraResultKind(ultraRefundKind(raw)); // ULTRA-FAIL-MSG-1022: keep error evidence for the refunded panel only.
      const rs = await refundP; // REFUNDED-STATE-1017: refunded -> no receipt, no purchase beacon
      if (rs) { try { const w = raw as Record<string, unknown>; let d = (w.data || w) as Record<string, unknown>; if (d.data && typeof d.data === "object" && !Array.isArray(d.data)) d = d.data as Record<string, unknown>; keepRetryInfo((d.transaction || d) as TransactionData); } catch { /* ignore */ } setRefunded(rs); return; } // REFUND-RETRY-LATE-1018
      const wrapper = raw as Record<string, unknown>;
      let result = (wrapper.data || wrapper) as Record<string, unknown>;
      if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
        result = result.data as Record<string, unknown>;
      }
      const txn = (result.transaction || result) as TransactionData;
      // CV-1: fail OPEN on unknown values, closed only on a clear failure. The pending flag below (set only after a
      // success checkout reply, matched to this hashid) is the main guard. Not confirmed = the proxy error/not-found
      // shape (success:false), an upstream body that is not JSON (parseError), or a status/success field that is a clear
      // failure word. Anything else (missing, true, 1, "Success ", "COMPLETED", unknown strings) counts as confirmed.
      const FAIL_WORDS = ["false", "0", "failed", "failure", "fail", "error", "declined", "decline", "denied", "cancelled", "canceled", "void", "voided", "refunded", "reversed", "rejected"];
      const isFail = (v: unknown) => v === false || v === 0 || (typeof v === "string" && FAIL_WORDS.includes(v.trim().toLowerCase()));
      const confirmed =
        wrapper.success !== false && result.parseError !== true &&
        ![wrapper.status, result.success, result.status, txn.success, txn.status].some(isFail);
      if (!confirmed) {
        setError(tr.couldNotLoad);
        return;
      }
      setTransaction(txn);
      try {
        const amount = parseAmount(txn.amount);
        const fee = Number(txn.fee || 0);
        const itemName = txn.carrier?.name || carrierName || "Recharge";
        const itemId = txn.carrier?.slug || carrierName || "recharge";
        const txnId = String(txn.transactionId || txn.transaction_id || txn.hashid || txn.id || hashid);
        // CV-1b: on a confirmed receipt, fire once per transaction id even if pending is missing
        // (Apple Pay / Cash App / redirect returns can drop sessionStorage). Cookie OR sessionStorage
        // pending matching this hashid is cleared when present. Keep sentKey dedupe. Fail-closed already applied above.
        const sentKey = `cp_purchase_sent:${txnId}`;
        let fire = false;
        // PAYPAL-1008 side fix: a receipt reopened later on another device (no pending flag there, empty localStorage) no longer
        // re-fires the purchase. It fires when this device's pending flag matches this hashid, OR the receipt's created time is
        // within 24 h (or in the future), OR created is missing / unreadable (fail open). Readable created older than 24 h and no
        // pending flag on this device = already counted when it was placed: no purchase event, no beacon.
        let pendingMatch = false;
        const createdMs = Date.parse(String(txn.created ?? ""));
        const fresh = !Number.isFinite(createdMs) || Date.now() - createdMs < 24 * 3600 * 1000;
        try {
          try {
            if (sessionStorage.getItem("cp_purchase_pending") === hashid) {
              pendingMatch = true;
              sessionStorage.removeItem("cp_purchase_pending");
            }
          } catch { /* ignore */ }
          try {
            const m = document.cookie.match(/(?:^|;\s*)cp_purchase_pending=([^;]*)/);
            const cookieVal = m ? decodeURIComponent(m[1]) : "";
            if (cookieVal === hashid) {
              pendingMatch = true;
              document.cookie = "cp_purchase_pending=; path=/; Max-Age=0; SameSite=Lax; Secure";
            }
          } catch { /* ignore */ }
          if ((pendingMatch || fresh) && localStorage.getItem(sentKey) === null && localStorage.getItem(`cp_purchase_early:${hashid}`) === null) { // BEACON-AT-SUCCESS-1011: Checkout already fired it
            localStorage.setItem(sentKey, String(Date.now()));
            fire = true;
            thisDeviceRef.current = true; // REFUND-RETRY-LATE-1018
          }
        } catch { fire = false; }
        if (fire) {
          // SERVER-FALLBACK-1012: skip if the server already queued this order for Ads upload (fail-open, 1.5 s max)
          try {
            const _su0 = import.meta.env.VITE_SUPABASE_URL as string | undefined;
            const _sk0 = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
            if (_su0 && _sk0 && txnId) {
              const _ac = new AbortController(); const _t = setTimeout(() => _ac.abort(), 1500);
              const _r = await fetch(_su0 + "/rest/v1/rpc/purchase_fallback_claimed", { method: "POST", signal: _ac.signal, headers: { apikey: _sk0, Authorization: "Bearer " + _sk0, "Content-Type": "application/json" }, body: JSON.stringify({ _transaction_id: txnId }) }).catch(() => null);
              clearTimeout(_t);
              if (_r && _r.ok && (await _r.json().catch(() => false)) === true) fire = false;
            }
          } catch { /* fail open */ }
        }
        if (fire) {
          // @ts-expect-error - dataLayer global
          window.dataLayer = window.dataLayer || [];
          // @ts-expect-error - dataLayer global
          window.dataLayer.push({
            event: "purchase",
            ecommerce: {
              transaction_id: txnId,
              value: Math.round((amount + fee) * 100) / 100,
              fee,
              revenue: amount,
              currency: "USD",
              items: [{ item_id: itemId, item_name: itemName, price: amount, quantity: 1 }],
            },
          });
          // CV-1c: first-party purchase-tag fire log (no PII). Fire-and-forget; never blocks checkout.
          try {
            const _su = import.meta.env.VITE_SUPABASE_URL as string | undefined;
            const _sk = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
            if (_su && _sk && txnId) {
              sendTracked("log_purchase_fire", { _transaction_id: txnId, _hashid: hashid || null, _value: Math.round((amount + fee) * 100) / 100, _source: "order_confirmation" }); // DB-OUTAGE-TRACK-1017
            }
          } catch { /* ignore beacon errors */ }
        }
      } catch { /* ignore analytics errors */ }
    } catch {
      setError(tr.couldNotLoad);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return "—";
    const d = phone.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) {
      return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return phone;
  };

  const home = langPath("/", lang);
  const displayCarrier = transaction?.carrier?.name || carrierName || (lang === "es" ? "Recarga" : "Recharge");
  const displayEmail = transaction?.user?.email || "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Success Banner (only for a confirmed order, CV-1). OC-CLS-1007: the banner slot is always rendered with a reserved
          min-height (224px phones, 174px from sm) so the receipt no longer pushes the page down when it loads. Text and brand
          color still appear ONLY for a confirmed order; before that the slot is empty, transparent and aria-hidden. */}
      <div
        className="w-full py-6 sm:py-8 px-4 text-primary-foreground min-h-[224px] sm:min-h-[174px]"
        style={transaction && !error ? { backgroundColor: brandColor } : undefined}
        aria-hidden={transaction && !error ? undefined : true}
      >
      {transaction && !error && (
        <div className="max-w-3xl mx-auto flex items-start gap-4">
          <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">
              {tr.thankYouHeader}
            </h1>
            <p className="text-sm mt-1 opacity-90">
              {tr.contactUsLink}{" "}
              <a href="/contact-us" className="underline font-semibold">{tr.contactUs.toLowerCase()}.</a>
            </p>
            <p className="text-xs mt-2 opacity-80">
              {tr.postedNote}
            </p>
          </div>
        </div>
      )}
      </div>

      {/* Main Content (OC-CLS-1007: at least one screen tall until the receipt is confirmed, so the footer stays below the fold while loading) */}
      <main className={`flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:py-8${!loading && transaction && !error ? "" : " min-h-screen"}`}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-16" role="status">
            <h1 className="text-lg font-bold text-foreground">
              {lang === "es" ? "No pudimos confirmar este pedido. Comuníquese con soporte." : "We couldn't confirm this order. Please contact support."}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {lang === "es" ? "Soporte:" : "Support:"}{" "}
              <a href="mailto:support@getcellpay.com" className="underline font-semibold">support@getcellpay.com</a>
            </p>
            <button onClick={() => navigate(home)} className="mt-4 px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              {tr.backToHome}
            </button>
          </div>
        ) : refunded ? (() => { // REFUNDED-STATE-1017
          const slug = refunded.carrierSlug || "";
          const pt = refundedPanelText(lang, isPayWord(`${slug} ${carrierName}`), refunded.total);
          const target = (slug && carrierPagePath(slug)) || home;
          const cause = retryCauseFor(slug); // REFUND-RETRY-LATE-1018
          if (slug === "ultra-mobile" && ultraResultKind) return ( // ULTRA-FAIL-MSG-1022
            <div className="text-center py-16" role="status" data-testid="order-refunded">
              <h1 className="text-lg font-bold text-foreground">{pt.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">{ultraResultKind === "amount"
                ? (lang === "es" ? "Este monto no está disponible para su plan Ultra. Su pago fue reembolsado. Por favor elija otro monto e intente de nuevo." : "This amount isn't available for your Ultra plan. Your payment was refunded. Please choose a different amount and try again.")
                : (lang === "es" ? "Su recarga no se completó y su pago fue reembolsado. Por favor intente con otro monto o vuelva a intentarlo en unos minutos." : "Your refill didn't go through and your payment was refunded. Please try a different amount, or try again in a few minutes.")}</p>
              <Button className="mt-4" data-testid="ultra-change-amount" onClick={() => navigate(carrierPageTarget(lang, slug, retryInfoRef.current.phone10, undefined, "", ""))}>{lang === "es" ? "Elegir otro monto" : "Choose another amount"}</Button>
            </div>
          ); // ULTRA-FAIL-MSG-1022
          if (cause) { const ri = retryInfoRef.current; const short = refundedPanelText(lang, isPayWord(`${slug} ${carrierName}`), refunded.total, true); return ( // REFUND-RETRY-LATE-1018
            <div className="text-center py-16" role="status" data-testid="order-refunded"> {/* REFUND-RETRY-LATE-1018 */}
              <h1 className="text-lg font-bold text-foreground">{short.title}</h1> {/* REFUND-RETRY-LATE-1018 */}
              <p className="text-sm text-muted-foreground mt-2">{short.text}</p> {/* REFUND-RETRY-LATE-1018 */}
              <p data-testid="retry-reason" className="text-sm text-foreground mt-3">{retryReasonText(cause, lang, ri.phone10)}</p> {/* REFUND-RETRY-LATE-1018 */}
              <RefundRetryButtons lang={lang} slug={slug} phone10={ri.phone10} amount={ri.amount} total={refunded.total} email={ri.email} brandColor={brandColor} hashid={hashid} stage="late" /> {/* REFUND-RETRY-LATE-1018 */}
            </div> // REFUND-RETRY-LATE-1018
          ); } // REFUND-RETRY-LATE-1018
          return (
            <div className="text-center py-16" role="status" data-testid="order-refunded">
              <h1 className="text-lg font-bold text-foreground">{pt.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">{pt.text}</p>
              <button onClick={() => navigate(target)} className="mt-4 px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
                {lang === "es" ? "Intentar de nuevo" : "Try again"}
              </button>
            </div>
          );
        })() : transaction ? (
          <div className="space-y-6">
            {/* Order Details Card */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                <Row label={tr.orderId} value={<span style={{ color: brandColor }} className="font-bold">{String(transaction.id || transaction.hashid || "—")}</span>} />
                {transaction.pin && (
                  <Row label={tr.pinLabel} value={<span className="font-mono font-bold text-foreground">{transaction.pin}</span>} />
                )}
                <Row label={tr.productName} value={<span style={{ color: brandColor }} className="font-semibold">{displayCarrier}</span>} />
                <Row label={tr.phoneNumber} value={<span style={{ color: brandColor }}>{formatPhone(transaction.phone_number)}</span>} />
                {displayEmail && <Row label={tr.emailLabel} value={<span style={{ color: brandColor }}>{displayEmail}</span>} />}
                <Row label={tr.qty} value={<span style={{ color: brandColor }}>1</span>} />
                <Row label={tr.price} value={<span style={{ color: brandColor }} className="font-bold">${Number(transaction.amount || 0).toFixed(2)}</span>} />
                {(transaction.fee !== undefined && Number(transaction.fee) > 0) && (
                  <Row label={tr.serviceFee} value={<span style={{ color: brandColor }}>${Number(transaction.fee).toFixed(2)}</span>} />
                )}
              </div>

              <div className="p-5 border-t border-border bg-muted/40">
                {/* OC-NOTYET-1007: Spanish promo text when lang === "es" (English unchanged); shop link without the old frozen _gl value */}
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {lang === "es" ? "Como agradecimiento, 30% de descuento en accesorios para celular" : "As a thank-you, enjoy 30% off cell phone accessories"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === "es" ? "Fundas, cargadores, protectores de pantalla y más." : "Phone cases, chargers, screen protectors, and more."}
                </p>
                <p className="text-sm mt-3">
                  <span className="font-bold text-foreground">{lang === "es" ? "Código de descuento: " : "Promo code: "}</span>
                  <span className="font-mono font-bold" style={{ color: brandColor }}>BuyCellPay</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "es" ? "(Úselo al pagar en nuestra página de accesorios)" : "(Apply at checkout on our accessories page)"}
                </p>
                <a
                  href="https://shop.cellpay.us/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: brandColor }}
                >
                  {lang === "es" ? "Comprar accesorios con 30% de descuento" : <>Shop Accessories &amp; Save 30%</>}
                </a>
              </div>

              <div className="px-5 pb-5 pt-3">
                <button
                  onClick={() => navigate(home)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {tr.continueShopping}
                </button>
              </div>
            </div>

            {/* OC-NOTYET-1007: "don't pay again / phone not working yet?" card (text only; confirmed receipts only) */}
            <NotWorkingYet lang={lang} orderId={String(transaction.id || transaction.hashid || "")} brandColor={brandColor} />

            {/* GROWTH-1007-B: Auto Pay prompt (display + link only; never enrolls, never charges) */}
            <AutoPayReceiptCard lang={lang} hashid={hashid} brandColor={brandColor} />

            {/* RT-3: pay again next time (number saved on this device only; display + localStorage, no tracking change) */}
            <PayAgainCard
              lang={lang}
              slug={transaction.carrier?.slug}
              carrierName={transaction.carrier?.name || carrierName}
              phone={transaction.phone_number}
              amount={transaction.amount}
              brandColor={brandColor}
            />

            {/* retention-1006: optional refill reminder email (UNCHECKED; saved only on tick; no payment/tracking change) */}
            <ReminderOptIn lang={lang} hashid={hashid} email={transaction.user?.email} brandColor={brandColor} />

            {/* AUTOPAY-POSTPURCHASE-1013: Auto Pay for next month (below the receipt; link only, never enrolls or charges) */}
            <PostPurchaseAutoPay lang={lang} hashid={hashid} brandColor={brandColor} />
          </div>
        ) : null}
      </main>

      <PaymentBar lang={lang} />
      <Footer />
      <LegalBar />
    </div>
  );
};

// AUTOPAY-POSTPURCHASE-1013: fire-and-forget lookup (4 s cap); any error/null -> nothing rendered.
const PostPurchaseAutoPay = ({ lang, hashid, brandColor }: { lang: string; hashid: string; brandColor: string }) => {
  const [offer, setOffer] = useState<{ t: string; slug: string; amount: number | null; path: string } | null>(null);
  const shownRef = useRef(false);
  useEffect(() => {
    let alive = true;
    try {
      if (!hashid) return;
      const call = Promise.resolve(supabase.rpc("postpurchase_autopay_link", { p_hashid: hashid }));
      const timeout = new Promise<null>((res) => setTimeout(() => res(null), 4000));
      Promise.race([call, timeout]).then((r) => {
        if (!alive || !r || r.error || !r.data || typeof r.data !== "object" || Array.isArray(r.data)) return;
        const d = r.data as { t?: unknown; slug?: unknown; amount?: unknown };
        const tok = String(d.t ?? "");
        const slug = String(d.slug ?? "");
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tok)) return;
        const path = carrierPagePath(slug);
        if (!path) return;
        const n = Number(d.amount);
        setOffer({ t: tok, slug, amount: Number.isFinite(n) && n > 0 ? n : null, path });
      }).catch(() => {});
    } catch { /* render nothing */ }
    return () => { alive = false; };
  }, [hashid]);
  useEffect(() => {
    if (!offer || shownRef.current) return;
    shownRef.current = true;
    trackFunnel("autopay_postpurchase_offer_shown", { carrier: offer.slug, amount: offer.amount, fee: null, total: null });
  }, [offer]);
  if (!offer) return null;
  const es = lang === "es";
  const bill = ["metropcs", "boost", "topup-crc"].includes(offer.slug);
  const text = bill
    ? (es ? "Su próximo pago se abrirá listo, con el pago automático seleccionado. Verá los términos completos del pago automático y el mismo cargo por servicio antes de aceptar." : "Your next payment opens ready to go, with Auto Pay selected. You'll see the full Auto Pay terms and the same service fee before you agree.")
    : (es ? "Su próxima recarga se abrirá lista, con el pago automático seleccionado. Verá los términos completos del pago automático y el mismo cargo por servicio antes de aceptar." : "Your next refill opens ready to go, with Auto Pay selected. You'll see the full Auto Pay terms and the same service fee before you agree.");
  const href = `${es ? "/es" : ""}${offer.path}?t=${offer.t}&ap=1&utm_source=site&utm_medium=postpurchase&utm_campaign=autopay_postpurchase`;
  return (
    <div className="bg-card rounded-xl border-2 p-5" style={{ borderColor: brandColor }}>
      <h2 className="text-base sm:text-lg font-bold text-foreground">{es ? "Active el pago automático para el próximo mes" : "Turn on Auto Pay for next month"}</h2>
      <p className="text-sm text-muted-foreground mt-1">{text}</p>
      <a
        href={href}
        onClick={() => { try { trackFunnel("autopay_postpurchase_offer_accepted", { carrier: offer.slug, amount: offer.amount, fee: null, total: null }); } catch { /* ignore */ } }}
        className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
        style={{ backgroundColor: brandColor }}
      >
        {es ? "Activar el pago automático" : "Turn on Auto Pay"}
      </a>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between px-5 py-4">
    <span className="text-sm font-bold text-foreground">{label}</span>
    <span className="text-sm">{value}</span>
  </div>
);

export default OrderConfirmation;
