import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fetchPockytSessionStatus } from "@/services/apiWrapper";

const POLL_INTERVAL_MS = 15000;

const CashAppReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "failed">("processing");
  const [message, setMessage] = useState<string>("Confirming your Cash App payment…");
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const sessionId =
    searchParams.get("pockyt_session_id") ||
    searchParams.get("session_id") ||
    "";

  useEffect(() => {
    if (!sessionId) {
      setStatus("failed");
      setMessage("Missing payment session reference.");
      return;
    }

    // Restore context written by Checkout before redirecting to the hosted URL
    let ctx: { brandColor?: string; carrier?: string } = {};
    try {
      const raw = sessionStorage.getItem("cashapp_return_ctx");
      if (raw) ctx = JSON.parse(raw) as typeof ctx;
    } catch {
      /* ignore */
    }

    const goSuccess = (transactionId: string) => {
      const params = new URLSearchParams({
        hashid: transactionId,
        color: ctx.brandColor || "",
        carrier: ctx.carrier || "",
      });
      navigate(`/order-confirmation?${params.toString()}`, { replace: true });
    };

    const poll = async () => {
      if (cancelledRef.current) return;
      try {
        const result = await fetchPockytSessionStatus(sessionId);
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
          setMessage(apiMsg || `Payment ${internalStatus}.`);
          return;
        }

        // Anything else (processing, pending, unknown, or success-without-txn) → keep polling
        setStatus("processing");
        if (apiMsg) setMessage(apiMsg);
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        // Transient error — keep polling
        const msg = err instanceof Error ? err.message : "Network error";
        setMessage(`Still confirming… (${msg})`);
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Kick off immediately, then every 15s
    poll();

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full text-center shadow-xl border border-border">
        {status === "processing" ? (
          <>
            <div
              role="status"
              aria-label="Loading"
              className="mx-auto mb-5 h-12 w-12 rounded-full border-4 border-muted border-t-cellpay-green animate-spin"
            />
            <h1 className="text-xl font-bold text-foreground mb-2">Processing your payment</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground mt-4">
              Please don't close this window — we'll update automatically.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h1>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <button
              onClick={() => navigate("/")}
              className="px-8 py-3 rounded-lg bg-cellpay-green text-primary-foreground font-bold"
            >
              Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CashAppReturn;
