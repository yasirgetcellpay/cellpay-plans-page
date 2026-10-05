import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { fetchPockytSessionStatus } from "@/services/apiWrapper";
import { useLang, t } from "@/lib/i18n";
import { cashAppRetryInfo, cashAppRetryTarget } from "@/lib/checkoutResume";

const POLL_INTERVAL_MS = 15000;
// CK-0b: after this long without a final status, show the calm "still confirming" panel. Polling keeps going.
const SLOW_AFTER_MS = 60000;

// CK-0b: page copy EN/ES (server status messages are shown as they come).
const COPY = {
  en: {
    loading: "Loading",
    confirming: "Confirming your Cash App payment…",
    stillConfirming: "Still confirming…",
    missingRef: "Missing payment session reference.",
    dontClose: "Please don't close this window — we'll update automatically.",
    slowTitle: "Still confirming your payment",
    slowBody: "Your payment may still be processing. Check your phone or email for a Cash App receipt before you try again. We'll keep checking in the background.",
    checkAgain: "Check again",
    checking: "Checking…",
    paymentStatus: (s: string) => `Payment ${s}.`,
  },
  es: {
    loading: "Cargando",
    confirming: "Confirmando su pago con Cash App…",
    stillConfirming: "Seguimos confirmando…",
    missingRef: "Falta la referencia de la sesión de pago.",
    dontClose: "No cierre esta ventana; se actualizará automáticamente.",
    slowTitle: "Seguimos confirmando su pago",
    slowBody: "Es posible que su pago todavía se esté procesando. Revise su teléfono o su correo electrónico para ver si recibió un recibo de Cash App antes de volver a intentarlo. Seguiremos verificando en segundo plano.",
    checkAgain: "Verificar de nuevo",
    checking: "Verificando…",
    paymentStatus: (s: string) => `Estado del pago: ${s}.`,
  },
};

// CV-1b: sessionStorage + cookie backup for purchase pending across redirects.
const setPurchasePending = (hid: string) => {
  if (!hid) return;
  try { sessionStorage.setItem("cp_purchase_pending", String(hid)); } catch { /* storage unavailable */ }
  try { document.cookie = `cp_purchase_pending=${encodeURIComponent(String(hid))}; path=/; Max-Age=3600; SameSite=Lax; Secure`; } catch { /* cookie unavailable */ }
};

const CashAppReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useLang();
  const tr = t(lang);
  const c = COPY[lang === "es" ? "es" : "en"];
  const copyRef = useRef(c);
  copyRef.current = c;
  const [status, setStatus] = useState<"processing" | "failed">("processing");
  const [message, setMessage] = useState<string>(c.confirming);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  // CK-0b: calm panel after ~60 s, "Check again", and "Try again" when carrier, amount and phone are known.
  const [slow, setSlow] = useState(false);
  const [checkingAgain, setCheckingAgain] = useState(false);
  const pollNowRef = useRef<(() => void) | null>(null);
  const [retry] = useState(() => cashAppRetryInfo(location.search));

  const sessionId =
    searchParams.get("pockyt_session_id") ||
    searchParams.get("session_id") ||
    "";

  useEffect(() => {
    if (!sessionId) {
      setStatus("failed");
      setMessage(copyRef.current.missingRef);
      return;
    }

    // Restore context written by Checkout before redirecting to the hosted URL
    let ctx: { brandColor?: string; carrier?: string; pending_log_id?: string } = {};
    try {
      const raw = sessionStorage.getItem("cashapp_return_ctx");
      if (raw) ctx = JSON.parse(raw) as typeof ctx;
    } catch {
      /* ignore */
    }

    const goSuccess = (transactionId: string) => {
      // Purchase analytics fire once, from /order-confirmation, only when this flag matches its hashid (CV-1b: sessionStorage + cookie).
      setPurchasePending(transactionId);
      const params = new URLSearchParams({
        hashid: transactionId,
        color: ctx.brandColor || "",
        carrier: ctx.carrier || "",
      });
      navigate(`/order-confirmation?${params.toString()}`, { replace: true });
    };

    // CK-0b: timerRef is null while a check is running, so "Check again" can never start a second polling loop.
    const schedule = () => {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        poll();
      }, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      if (cancelledRef.current) return;
      try {
        const result = await fetchPockytSessionStatus(sessionId, ctx.pending_log_id);
        const internalStatus = String(result.internal_status || result.status || "").toLowerCase();
        const txnId = (result.transaction_id || result.transactionId || "") as string;
        const apiMsg = (result.message as string) || "";

        const successStatuses = ["success", "completed", "paid", "captured", "approved"];
        const failureStatuses = ["failed", "declined", "cancelled", "canceled", "expired", "voided", "error"];

        // Only treat as success if BOTH the status confirms payment AND we have a transaction id.
        // A txnId alone is not enough — Pockyt assigns one when the session is created.
        if (txnId && successStatuses.includes(internalStatus)) {
          goSuccess(String(txnId));
          return;
        }

        if (failureStatuses.includes(internalStatus)) {
          setStatus("failed");
          setMessage(apiMsg || copyRef.current.paymentStatus(internalStatus));
          return;
        }

        // Anything else (processing, pending, unknown, or success-without-txn) → keep polling
        setStatus("processing");
        if (apiMsg) setMessage(apiMsg);
        schedule();
      } catch (err) {
        // Transient error — keep polling
        const msg = err instanceof Error ? err.message : "Network error";
        setMessage(`${copyRef.current.stillConfirming} (${msg})`);
        schedule();
      }
    };

    // CK-0b: "Check again" = the same check, now (only while waiting for the next one).
    pollNowRef.current = () => {
      if (cancelledRef.current || timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      poll();
    };

    // Kick off immediately, then every 15s
    poll();

    return () => {
      cancelledRef.current = true;
      pollNowRef.current = null;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [sessionId, navigate]);

  // CK-0b: ~60 s without a final status -> calm panel (never a failure). A later success still opens the confirmation page.
  useEffect(() => {
    if (status !== "processing" || !sessionId) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [status, sessionId]);

  const checkAgain = () => {
    if (checkingAgain || !pollNowRef.current) return;
    setCheckingAgain(true);
    pollNowRef.current();
    window.setTimeout(() => setCheckingAgain(false), 3000);
  };
  // Carrier page with the number and amount filled in (CK-0 prefill), /es and gclid/utm kept.
  const tryAgain = () => {
    if (retry) navigate(cashAppRetryTarget(lang, retry, location.search, location.hash));
  };
  const goHome = () => navigate(lang === "es" ? "/es" : "/");

  const primaryBtn = "px-8 py-3 rounded-lg bg-cellpay-green text-primary-foreground font-bold disabled:opacity-60";
  const secondaryBtn = "px-8 py-3 rounded-lg border border-border bg-background text-foreground font-semibold";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full text-center shadow-xl border border-border">
        {status === "processing" && slow ? (
          <>
            <div
              role="status"
              aria-label={c.slowTitle}
              className="mx-auto mb-5 h-10 w-10 rounded-full border-4 border-muted border-t-cellpay-green animate-spin"
            />
            <h1 className="text-xl font-bold text-foreground mb-2">{c.slowTitle}</h1>
            <p className="text-sm text-muted-foreground mb-6" data-testid="cashapp-slow">{c.slowBody}</p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={checkAgain} disabled={checkingAgain} className={primaryBtn} data-testid="cashapp-check-again">
                {checkingAgain ? c.checking : c.checkAgain}
              </button>
              {retry && (
                <button type="button" onClick={tryAgain} className={secondaryBtn} data-testid="cashapp-try-again">
                  {tr.tryAgain}
                </button>
              )}
              <button type="button" onClick={goHome} className={secondaryBtn} data-testid="cashapp-home">
                {tr.backToHome}
              </button>
            </div>
          </>
        ) : status === "processing" ? (
          <>
            <div
              role="status"
              aria-label={c.loading}
              className="mx-auto mb-5 h-12 w-12 rounded-full border-4 border-muted border-t-cellpay-green animate-spin"
            />
            <h1 className="text-xl font-bold text-foreground mb-2">{tr.processingPayment}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground mt-4">
              {c.dontClose}
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{tr.paymentFailed}</h1>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex flex-col gap-3">
              {retry && (
                <button type="button" onClick={tryAgain} className={primaryBtn} data-testid="cashapp-try-again">
                  {tr.tryAgain}
                </button>
              )}
              <button type="button" onClick={goHome} className={retry ? secondaryBtn : primaryBtn} data-testid="cashapp-home">
                {tr.backToHome}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CashAppReturn;
