import { useState } from "react";
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

interface LastTransaction {
  id?: string | number;
  phoneNumber?: string | number;
  pinNumber?: string;
  ccTxnId?: string;
  ccNumber?: string;
  amount?: string | number;
  fee?: string | number;
  date?: string | number;
  resultText?: string;
  result?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  payMethod?: string;
  transactionType?: string;
  approved?: boolean;
  msg?: string;
}


const normalize = (raw: string) => raw.trim();

const unwrap = (raw: unknown): Record<string, unknown> => {
  let data: Record<string, unknown> = {};
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    data = (obj.data && typeof obj.data === "object" ? obj.data : obj) as Record<string, unknown>;
    if (data.data && typeof data.data === "object") data = data.data as Record<string, unknown>;
  }
  return data;
};

const toPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
};

const formatMoney = (v: unknown): string | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `$${n.toFixed(2)}`;
};

export const HelpQuickActions = ({ brandColor = "hsl(101,67%,44%)" }: HelpQuickActionsProps) => {
  const [mode, setMode] = useState<Mode>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lookupResult, setLookupResult] = useState<LastTransaction | null>(null);
  const { toast } = useToast();

  const close = () => {
    setMode(null);
    setValue("");
    setSubmitting(false);
    setLookupResult(null);
  };

  const handleLookup = async () => {
    const v = normalize(value);
    if (!v) return;
    const phone = toPhone(v);
    if (phone.length !== 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit US wireless number.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    setLookupResult(null);
    try {
      const raw = await callProxy({
        endpoint: "transactions/last",
        method: "POST",
        payload: { phone },
      });
      const data = unwrap(raw);
      const status = data.status;
      const ok = status === true || status === "true" || String(status || "").toLowerCase() === "success";
      const msg = (data.msg || data.Message || data.message) as string | undefined;

      if (ok) {
        const resultStr = String(data.result || "").toLowerCase();
        const approved = ok && !resultStr.includes("decline") && !resultStr.includes("error");
        setLookupResult({
          id: data.ID as string | number | undefined,
          phoneNumber: data.phoneNumber as string | number | undefined,
          pinNumber: data.pinNumber as string | undefined,
          ccTxnId: data.ccTxnId as string | undefined,
          ccNumber: data.ccNumber as string | undefined,
          amount: data.amount as string | number | undefined,
          fee: data.fee as string | number | undefined,
          date: data.date as string | number | undefined,
          resultText: data.resultText as string | undefined,
          result: data.result as string | undefined,
          firstName: data.firstName as string | undefined,
          lastName: data.lastName as string | undefined,
          email: data.email as string | undefined,
          payMethod: data.payMethod as string | undefined,
          transactionType: data.transaction_type as string | undefined,
          approved,
          msg,
        });
      } else {
        toast({
          title: "No transaction found",
          description: msg || "We couldn't locate a recent transaction for that number. Please contact support@getcellpay.com.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Lookup unavailable",
        description: "Please try again or contact support@getcellpay.com.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsubscribe = async () => {
    const v = normalize(value);
    if (!v) return;
    const phone = toPhone(v);
    if (phone.length !== 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit US wireless number.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const raw = await callProxy({
        endpoint: "autopay/unsubscribe",
        method: "POST",
        payload: { phone },
      });
      const data = unwrap(raw);
      const status = data.status;
      const ok = status === true || status === "true" || String(status || "").toLowerCase() === "success";
      const msg = (data.msg || data.Message || data.message) as string | undefined;

      if (ok) {
        toast({
          title: "Autopay cancelled",
          description: msg || `Autopay has been cancelled for ${phone}.`,
        });
        close();
      } else {
        toast({
          title: "Unable to cancel autopay",
          description: msg || "We couldn't find an active autopay for that number. Please contact support@getcellpay.com.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Request failed",
        description: "Please try again or contact support@getcellpay.com.",
        variant: "destructive",
      });
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
                Look up your most recent refill by wireless number.
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
              {mode === "lookup" ? "Find Previous Transaction" : "Unsubscribe From Autopay"}
            </DialogTitle>
            <DialogDescription>
              {mode === "lookup"
                ? "Enter your 10-digit wireless number to look up your most recent refill."
                : "Enter the wireless number enrolled in autopay to cancel future recharges."}
            </DialogDescription>
          </DialogHeader>

          {mode === "lookup" && lookupResult ? (
            <div className="space-y-3">
              {(() => {
                const r = lookupResult;
                const total = (Number(r.amount) || 0) + (Number(r.fee) || 0);
                const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
                const phoneStr = r.phoneNumber ? String(r.phoneNumber).replace(/^1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : null;
                const dateStr = r.date
                  ? new Date((typeof r.date === "number" ? r.date : Number(r.date)) * 1000).toLocaleString()
                  : null;
                return (
                  <>
                    <div className={`rounded-xl p-3 text-sm font-semibold ${r.approved ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                      {r.approved ? "Payment approved" : "Payment not completed"}
                      {r.resultText && <div className="font-normal text-xs mt-1 opacity-80">{r.resultText}</div>}
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
                      {phoneStr && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-medium text-foreground">{phoneStr}</span>
                        </div>
                      )}
                      {fullName && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium text-foreground">{fullName}</span>
                        </div>
                      )}
                      {r.email && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium text-foreground break-all">{r.email}</span>
                        </div>
                      )}
                      {formatMoney(r.amount) && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-medium text-foreground">{formatMoney(r.amount)}</span>
                        </div>
                      )}
                      {formatMoney(r.fee) && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Fee</span>
                          <span className="font-medium text-foreground">{formatMoney(r.fee)}</span>
                        </div>
                      )}
                      {total > 0 && (
                        <div className="flex justify-between gap-4 border-t border-border pt-2">
                          <span className="text-muted-foreground font-medium">Total</span>
                          <span className="font-bold text-foreground">{formatMoney(total)}</span>
                        </div>
                      )}
                      {r.payMethod && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Payment</span>
                          <span className="font-medium text-foreground">
                            {r.payMethod}{r.ccNumber ? ` •••• ${r.ccNumber}` : ""}
                          </span>
                        </div>
                      )}
                      {r.id !== undefined && r.id !== "" && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Order #</span>
                          <span className="font-mono font-medium text-foreground">{String(r.id)}</span>
                        </div>
                      )}
                      {r.ccTxnId && r.ccTxnId !== "1" && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Transaction ID</span>
                          <span className="font-mono text-xs font-medium text-foreground break-all">{r.ccTxnId}</span>
                        </div>
                      )}
                      {r.pinNumber && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">PIN</span>
                          <span className="font-mono font-medium text-foreground break-all">{r.pinNumber}</span>
                        </div>
                      )}
                      {dateStr && (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium text-foreground">{dateStr}</span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setLookupResult(null); setValue(""); }}
                  className="px-4 py-2 rounded-full text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
                >
                  New search
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-6 py-2 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: brandColor }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="help-input" className="block text-sm font-medium text-foreground mb-2">
                  Wireless number
                </label>
                <Input
                  id="help-input"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter your 10-digit phone number"
                  inputMode="tel"
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
