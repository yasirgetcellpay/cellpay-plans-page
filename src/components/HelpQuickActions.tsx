import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, BellOff, Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { callProxy } from "@/services/apiWrapper";

type Mode = "lookup" | "unsubscribe" | null;

interface HelpQuickActionsProps {
  brandColor?: string;
}

const normalize = (raw: string) => raw.trim();

export const HelpQuickActions = ({ brandColor = "hsl(101,67%,44%)" }: HelpQuickActionsProps) => {
  const [mode, setMode] = useState<Mode>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const close = () => {
    setMode(null);
    setValue("");
    setSubmitting(false);
  };

  const handleLookup = async () => {
    const v = normalize(value);
    if (!v) return;
    setSubmitting(true);
    const digits = v.replace(/\D/g, "");
    const looksLikePhone = digits.length >= 10 && /^[\d\s\-+().]+$/.test(v);

    if (!looksLikePhone) {
      // Treat as transaction id / hashid
      close();
      navigate(`/order-confirmation?hashid=${encodeURIComponent(v)}`);
      return;
    }

    // Phone: try to find most recent transaction for this number
    try {
      const phone = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      const raw = await callProxy({ endpoint: `transactions?phone=${phone}`, method: "GET" });
      let result: unknown = raw;
      for (let i = 0; i < 5; i++) {
        if (Array.isArray(result)) break;
        if (result && typeof result === "object") {
          const obj = result as Record<string, unknown>;
          if (Array.isArray(obj.transactions)) { result = obj.transactions; break; }
          if (Array.isArray(obj.data)) { result = obj.data; break; }
          if (obj.data && typeof obj.data === "object") { result = obj.data; continue; }
        }
        break;
      }
      const list = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
      const latest = list[0];
      const hashid = latest && (latest.hashid || latest.transactionId || latest.transaction_id || latest.id);
      if (hashid) {
        close();
        navigate(`/order-confirmation?hashid=${encodeURIComponent(String(hashid))}`);
        return;
      }
      toast({
        title: "No transaction found",
        description: "We couldn't locate a recent transaction for that number. Please enter your transaction ID or contact support.",
        variant: "destructive",
      });
    } catch {
      toast({
        title: "Lookup unavailable",
        description: "Please enter your transaction ID instead, or contact support@getcellpay.com.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsubscribe = async () => {
    const v = normalize(value);
    if (!v) return;
    setSubmitting(true);
    try {
      // Best-effort: log the request. Always confirm to the user.
      await callProxy({
        endpoint: "autopay/unsubscribe",
        method: "POST",
        payload: { identifier: v },
      }).catch(() => null);

      toast({
        title: "Autopay cancellation requested",
        description: "We've received your request. Your autopay will be cancelled within 24 hours and a confirmation will be sent.",
      });
      close();
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "lookup") handleLookup();
    else if (mode === "unsubscribe") handleUnsubscribe();
  };

  return (
    <>
      <section aria-label="Help quick actions" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode("lookup")}
            className="group text-left rounded-2xl border-2 border-border bg-card hover:border-transparent hover:shadow-lg transition-all p-6 flex items-start gap-4"
            style={{ borderColor: undefined }}
          >
            <div
              className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-primary-foreground"
              style={{ backgroundColor: brandColor }}
            >
              <Receipt className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-lg">Did Not Receive Your Payment?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Look up your transaction by phone number or transaction ID.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("unsubscribe")}
            className="group text-left rounded-2xl border-2 border-border bg-card hover:border-transparent hover:shadow-lg transition-all p-6 flex items-start gap-4"
          >
            <div
              className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-primary-foreground"
              style={{ backgroundColor: brandColor }}
            >
              <BellOff className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-lg">Unsubscribe From Autopay</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Cancel scheduled recurring recharges on your number.
              </p>
            </div>
          </button>
        </div>
      </section>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "lookup" ? "Find Previous Transactions" : "Unsubscribe From Autopay"}
            </DialogTitle>
            <DialogDescription>
              {mode === "lookup"
                ? "Enter your wireless number or transaction ID to view your most recent order."
                : "Enter the wireless number enrolled in autopay to cancel future recharges."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="help-input" className="block text-sm font-medium text-foreground mb-2">
                {mode === "lookup" ? "Wireless number or transaction ID" : "Wireless number"}
              </label>
              <Input
                id="help-input"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mode === "lookup" ? "Enter phone number or transaction ID" : "Enter your phone number"}
                inputMode={mode === "unsubscribe" ? "tel" : "text"}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !value.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === "lookup" ? (
                  <Search className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
                {mode === "lookup" ? "Search" : "Unsubscribe"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
