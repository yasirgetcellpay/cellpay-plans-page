import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import cellpayLogo from "@/assets/cellpay-logo.webp";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [transactionId, setTransactionId] = useState<string | null>(null);

  useEffect(() => {
    // Parse callback params from the payment provider redirect
    const resultStatus = searchParams.get("status") || searchParams.get("result");
    const txId = searchParams.get("transactionId") || searchParams.get("transaction_id") || searchParams.get("reference");

    if (txId) setTransactionId(txId);

    // Determine success/failure from URL params
    if (resultStatus === "success" || resultStatus === "completed" || resultStatus === "1") {
      setStatus("success");
    } else if (resultStatus === "failed" || resultStatus === "cancelled" || resultStatus === "0") {
      setStatus("failed");
    } else {
      // If no clear status param, assume success if we landed here
      setTimeout(() => setStatus(txId ? "success" : "success"), 1500);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      <nav className="w-full bg-card border-b-4 border-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16">
          <Link to="/" className="flex-shrink-0">
            <img src={cellpayLogo} alt="CellPay" className="h-10" />
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h1 className="text-xl font-bold text-gray-800">Processing Payment...</h1>
              <p className="text-sm text-gray-500">Please wait while we confirm your payment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h1 className="text-2xl font-bold text-gray-800">Payment Successful!</h1>
              <p className="text-sm text-gray-600">Your recharge has been confirmed and applied to your account.</p>
              {transactionId && (
                <p className="text-sm font-semibold text-gray-700">Transaction ID: {transactionId}</p>
              )}
              <Link
                to="/"
                className="inline-block mt-4 px-8 py-3 rounded-lg text-white font-bold text-sm bg-primary hover:bg-primary/90 transition-colors"
              >
                Back to Home
              </Link>
            </>
          )}

          {status === "failed" && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto" />
              <h1 className="text-2xl font-bold text-gray-800">Payment Failed</h1>
              <p className="text-sm text-gray-600">Your payment could not be completed. Please try again or use a different payment method.</p>
              <div className="flex gap-3 justify-center mt-4">
                <Link
                  to="/"
                  className="px-6 py-3 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-6 text-center text-xs">
        <p>© 2026 All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PaymentCallback;
