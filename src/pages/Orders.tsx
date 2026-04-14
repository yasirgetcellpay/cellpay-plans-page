import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
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
  created_at?: string;
  carrier?: string;
  phone_number?: string;
  amount?: number | string;
  status?: string;
  [key: string]: unknown;
}

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
      const wrapper = raw as Record<string, unknown>;
      // Unwrap: { success, data: { data: [...] } } or { success, data: [...] }
      let result = wrapper.data ?? wrapper;
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const inner = result as Record<string, unknown>;
        if (Array.isArray(inner.data)) {
          result = inner.data;
        } else if (Array.isArray(inner.transactions)) {
          result = inner.transactions;
        } else if (Array.isArray(inner.orders)) {
          result = inner.orders;
        }
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
      <Navbar />
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
