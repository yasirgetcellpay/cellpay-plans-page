import { useState, useEffect } from "react";
import { BackButton } from "@/components/BackButton";
import { AccountDropdown } from "@/components/AccountDropdown";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Loader2 } from "lucide-react";
import { callProxy } from "@/services/apiWrapper";

interface Order {
  id: number | string;
  date?: string;
  created?: string;
  created_at?: string;
  carrier?: string | { name?: string; carrierId?: number };
  phone_number?: string;
  amount?: number | string;
  status?: string;
  hashid?: string;
  [key: string]: unknown;
}

const getCarrierName = (carrier: Order["carrier"]): string => {
  if (!carrier) return "Recharge";
  if (typeof carrier === "string") return carrier;
  return carrier.name || "Recharge";
};

const Orders = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    loadOrders();
  }, [isLoggedIn]);

  const loadOrders = async () => {
    try {
      const raw = await callProxy({ endpoint: "transactions", method: "GET" });
      // Recursively unwrap nested data/transactions from API response
      let result: unknown = raw;
      for (let i = 0; i < 5; i++) {
        if (Array.isArray(result)) break;
        if (result && typeof result === "object") {
          const obj = result as Record<string, unknown>;
          if (Array.isArray(obj.transactions)) { result = obj.transactions; break; }
          if (Array.isArray(obj.orders)) { result = obj.orders; break; }
          if (Array.isArray(obj.data)) { result = obj.data; break; }
          if (obj.data && typeof obj.data === "object") { result = obj.data; continue; }
        }
        break;
      }
      const list = Array.isArray(result) ? result : [];
      setOrders(list as Order[]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <span className="text-xl sm:text-2xl font-extrabold text-cellpay-green tracking-tight">CellPay</span>
            <AccountDropdown />
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Orders</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No orders found.</p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              Browse Plans
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => (
              <div key={order.id || i} className="bg-card border border-border rounded-lg px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.carrier || "Recharge"}</p>
                  <p className="text-xs text-muted-foreground">{order.phone_number || "—"}</p>
                  <p className="text-xs text-muted-foreground">{order.date || order.created_at || ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">${Number(order.amount || 0).toFixed(2)}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    order.status === "completed" || order.status === "success"
                      ? "bg-green-100 text-green-700"
                      : order.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {order.status || "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Orders;
