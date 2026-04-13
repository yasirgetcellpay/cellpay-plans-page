import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"success" | "failed" | "loading">("loading");

  useEffect(() => {
    const txnStatus = searchParams.get("status") || searchParams.get("result") || "";
    if (["success", "completed", "1"].includes(txnStatus.toLowerCase())) {
      setStatus("success");
    } else {
      setStatus("failed");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full text-center shadow-xl border border-border">
        {status === "loading" ? (
          <p className="text-muted-foreground">Processing payment...</p>
        ) : status === "success" ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h2>
            <p className="text-sm text-muted-foreground mb-6">Your recharge has been processed successfully.</p>
            {searchParams.get("transaction_id") && (
              <p className="text-xs text-muted-foreground mb-4">
                Transaction: <span className="font-mono font-bold">{searchParams.get("transaction_id")}</span>
              </p>
            )}
            <button onClick={() => navigate("/")} className="px-8 py-3 rounded-lg bg-cellpay-green text-primary-foreground font-bold">
              Back to Home
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {searchParams.get("message") || "Your payment could not be completed. Please try again."}
            </p>
            <button onClick={() => navigate("/")} className="px-8 py-3 rounded-lg bg-cellpay-green text-primary-foreground font-bold">
              Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
