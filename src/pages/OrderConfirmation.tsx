import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { callProxy } from "@/services/apiWrapper";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { Loader2, CheckCircle, ArrowLeft, ShoppingBag } from "lucide-react";

interface TransactionData {
  id?: number;
  amount?: number;
  fee?: number;
  phone_number?: string;
  pin?: string;
  transactionId?: string;
  hashid?: string;
  created?: string;
  carrier?: { name?: string; slug?: string };
  user?: { email?: string; first_name?: string; last_name?: string };
  [key: string]: unknown;
}

const OrderConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hashid = searchParams.get("hashid") || "";
  const brandColor = searchParams.get("color") || "hsl(142,70%,40%)";
  const carrierName = searchParams.get("carrier") || "";

  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hashid) {
      setError("No transaction reference found.");
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
      setTransaction(txn);
    } catch {
      setError("Could not load transaction details.");
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

  const displayCarrier = transaction?.carrier?.name || carrierName || "Recharge";
  const displayEmail = transaction?.user?.email || "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Success Banner */}
      <div className="w-full py-6 sm:py-8 px-4 text-primary-foreground" style={{ backgroundColor: brandColor }}>
        <div className="max-w-3xl mx-auto flex items-start gap-4">
          <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">
              Thank you for your payment. The charge on your statement will reflect CellPay.
            </h1>
            <p className="text-sm mt-1 opacity-90">
              If you need additional information, please{" "}
              <a href="https://www.cellpay.us/contact" className="underline font-semibold">contact us.</a>
            </p>
            <p className="text-xs mt-2 opacity-80">
              Your payment has been posted on your account. It can take up to 30 min to reflect on your account.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">{error}</p>
            <button onClick={() => navigate("/")} className="mt-4 px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              Back to Home
            </button>
          </div>
        ) : transaction ? (
          <div className="space-y-6">
            {/* Order Details Card */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                <Row label="Order ID" value={<span style={{ color: brandColor }} className="font-bold">{String(transaction.id || transaction.hashid || "—")}</span>} />
                {transaction.pin && (
                  <Row label="Pin (Use it if not recharged)" value={<span className="font-mono font-bold text-foreground">{transaction.pin}</span>} />
                )}
                <Row label="Product Name" value={<span style={{ color: brandColor }} className="font-semibold">{displayCarrier}</span>} />
                <Row label="Phone Number" value={<span style={{ color: brandColor }}>{formatPhone(transaction.phone_number)}</span>} />
                {displayEmail && <Row label="Email" value={<span style={{ color: brandColor }}>{displayEmail}</span>} />}
                <Row label="Qty" value={<span style={{ color: brandColor }}>1</span>} />
                <Row label="Price" value={<span style={{ color: brandColor }} className="font-bold">${Number(transaction.amount || 0).toFixed(2)}</span>} />
                {(transaction.fee !== undefined && Number(transaction.fee) > 0) && (
                  <Row label="Service Fee" value={<span style={{ color: brandColor }}>${Number(transaction.fee).toFixed(2)}</span>} />
                )}
              </div>

              <div className="p-5">
                <button
                  onClick={() => navigate("/")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: brandColor }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  CONTINUE SHOPPING
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <PaymentBar />
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
