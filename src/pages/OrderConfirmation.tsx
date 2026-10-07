import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { callProxy } from "@/services/apiWrapper";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { useLang, t, langPath } from "@/lib/i18n";
import { applySeoHead } from "@/lib/seo";
import { PayAgainCard } from "@/components/PayAgainCard";
import { ReminderOptIn } from "@/components/ReminderOptIn";
import { AutoPayReceiptCard } from "@/components/AutoPayReceiptCard";

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

  const fetchTransaction = async () => {
    try {
      const raw = await callProxy({ endpoint: `transactions/view/${hashid}`, method: "GET" });
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
        try {
          try {
            if (sessionStorage.getItem("cp_purchase_pending") === hashid) {
              sessionStorage.removeItem("cp_purchase_pending");
            }
          } catch { /* ignore */ }
          try {
            const m = document.cookie.match(/(?:^|;\s*)cp_purchase_pending=([^;]*)/);
            const cookieVal = m ? decodeURIComponent(m[1]) : "";
            if (cookieVal === hashid) {
              document.cookie = "cp_purchase_pending=; path=/; Max-Age=0; SameSite=Lax; Secure";
            }
          } catch { /* ignore */ }
          if (localStorage.getItem(sentKey) === null) {
            localStorage.setItem(sentKey, String(Date.now()));
            fire = true;
          }
        } catch { fire = false; }
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
              fetch(_su + "/rest/v1/rpc/log_purchase_fire", {
                method: "POST",
                keepalive: true,
                headers: { apikey: _sk, Authorization: "Bearer " + _sk, "Content-Type": "application/json" },
                body: JSON.stringify({
                  _transaction_id: txnId,
                  _hashid: hashid || null,
                  _value: Math.round((amount + fee) * 100) / 100,
                  _source: "order_confirmation",
                }),
              }).catch(() => {});
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
      {/* Success Banner (only for a confirmed order, CV-1) */}
      {transaction && !error && (
      <div className="w-full py-6 sm:py-8 px-4 text-primary-foreground" style={{ backgroundColor: brandColor }}>
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
      </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:py-8">
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
        ) : transaction ? (
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
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  As a thank-you, enjoy 30% off cell phone accessories
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Phone cases, chargers, screen protectors, and more.
                </p>
                <p className="text-sm mt-3">
                  <span className="font-bold text-foreground">Promo code: </span>
                  <span className="font-mono font-bold" style={{ color: brandColor }}>BuyCellPay</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (Apply at checkout on our accessories page)
                </p>
                <a
                  href="https://shop.cellpay.us/?_gl=1*1ofqb7k*_gcl_au*MTA1MTE3MTcxOS4xNzg5MDU2NjU1*_ga*MzIwMTk2MjQ1LjE3ODkwNTY2NTU.*_ga_G5QH60Z2GZ*czE3ODkwNTY2NTUkbzEkZzEkdDE3ODkwNTc3NjYkajYwJGwwJGgxOTcyMzI0NTMw*_ga_4T3FK9DBTR*czE3ODkwNTY2NTUkbzEkZzEkdDE3ODkwNTc3NjYkajYwJGwwJGg2MTk5MzE2MjI."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: brandColor }}
                >
                  Shop Accessories &amp; Save 30%
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
          </div>
        ) : null}
      </main>

      <PaymentBar lang={lang} />
      <Footer />
      <LegalBar />
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
