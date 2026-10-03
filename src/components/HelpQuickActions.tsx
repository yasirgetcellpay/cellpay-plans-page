import { useState } from "react";
import { Receipt, BellOff, Mail, Loader2, CheckCircle2 } from "lucide-react";
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

const SUPPORT_EMAIL = "support@getcellpay.com";
const NEUTRAL_RESULT =
  "If that number has Auto Pay with us, it's now cancelled. We'll confirm by email within 1 business day.";
const FALLBACK_LINE = `Didn't get an email? Write to ${SUPPORT_EMAIL} from the email you used at checkout.`;

// [AP-1] Turnstile hook, SHADOW only (the proxy logs the verdict and never blocks). Empty site key = off:
// no script is loaded and no token is sent. Turning it on later is this one line.
const AP1_TURNSTILE_SITEKEY = "";

// Same phone handling as the old cellpay.us dialog: trim, keep digits, drop a leading 1 from 11 digits.
const normalize = (raw: string) => raw.trim();
const toPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
};

const unwrap = (raw: unknown): Record<string, unknown> => {
  let data: Record<string, unknown> = {};
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    data = (obj.data && typeof obj.data === "object" ? obj.data : obj) as Record<string, unknown>;
    if (data.data && typeof data.data === "object") data = data.data as Record<string, unknown>;
  }
  return data;
};

/** "Checkout email or last 4 of Order ID" -> { email } or { last4 }, else null. */
const toVerifier = (raw: string): { email?: string; last4?: string } | null => {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : null;
  }
  const last4 = v.replace(/[\s#]/g, "");
  return /^[A-Za-z0-9]{4}$/.test(last4) ? { last4: last4.toLowerCase() } : null;
};

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };

async function getTurnstileToken(): Promise<string | null> {
  if (!AP1_TURNSTILE_SITEKEY || typeof window === "undefined") return null;
  try {
    const w = window as unknown as { turnstile?: TurnstileApi };
    if (!w.turnstile) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("turnstile load failed"));
        document.head.appendChild(s);
      });
    }
    const api = w.turnstile;
    if (!api) return null;
    const el = document.createElement("div");
    el.style.display = "none";
    document.body.appendChild(el);
    return await new Promise<string | null>((resolve) => {
      let id = "";
      const done = (t: string | null) => {
        try { if (id) api.remove(id); } catch { /* ignore */ }
        el.remove();
        resolve(t);
      };
      const timer = setTimeout(() => done(null), 3000);
      id = api.render(el, {
        sitekey: AP1_TURNSTILE_SITEKEY,
        action: "autopay_cancel",
        callback: (t: string) => { clearTimeout(timer); done(t); },
        "error-callback": () => { clearTimeout(timer); done(null); },
      });
    });
  } catch {
    return null; // shadow mode: never stop the customer
  }
}

export const HelpQuickActions = ({ brandColor = "hsl(101,67%,44%)" }: HelpQuickActionsProps) => {
  const [mode, setMode] = useState<Mode>(null);
  const [value, setValue] = useState("");
  const [proof, setProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [received, setReceived] = useState(false);
  const { toast } = useToast();

  const close = () => {
    setMode(null);
    setValue("");
    setProof("");
    setSubmitting(false);
    setReceived(false);
  };

  const lookupMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Did not receive my refill")}`;
  const autopayMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Cancel autopay")}`;

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
    const verify = toVerifier(proof);
    if (!verify) {
      toast({
        title: "Check your details",
        description: "Enter the email you used at checkout, or the last 4 characters of your Order ID.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const turnstile = await getTurnstileToken();
      // Same call as before (autopay/unsubscribe, POST, payload { phone }). verify and turnstile ride
      // outside payload; the proxy checks them and never forwards them.
      const req = { endpoint: "autopay/unsubscribe", method: "POST", payload: { phone }, verify, turnstile };
      const raw = await callProxy(req);
      const data = unwrap(raw);
      if (data.code === "AP_REQUEST_RECEIVED") {
        setReceived(true);
      } else {
        toast({
          title: "Request not sent",
          description: `We couldn't take this request right now. Please try again later or email ${SUPPORT_EMAIL}.`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Request failed",
        description: `Please try again or contact ${SUPPORT_EMAIL}.`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "unsubscribe") handleUnsubscribe();
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
                Contact support with your phone number and Order ID.
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
              {mode === "lookup" ? "Did Not Receive Your Payment?" : "Unsubscribe From Autopay"}
            </DialogTitle>
            <DialogDescription>
              {mode === "lookup"
                ? `For your privacy, online lookup isn't available. Email ${SUPPORT_EMAIL} with your phone number and Order ID and we'll check it for you.`
                : received
                ? "Request received."
                : "Enter the wireless number enrolled in autopay, plus the email you used at checkout or the last 4 characters of your Order ID."}
            </DialogDescription>
          </DialogHeader>

          {mode === "lookup" ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-full text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
              >
                Close
              </button>
              <a
                href={lookupMailto}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: brandColor }}
              >
                <Mail className="w-4 h-4" />
                Email support
              </a>
            </div>
          ) : received ? (
            <div className="space-y-3">
              <div className="rounded-xl p-3 text-sm bg-green-50 text-green-700 border border-green-200 flex gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{NEUTRAL_RESULT}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {FALLBACK_LINE}{" "}
                <a href={autopayMailto} className="underline">Email support</a>
              </p>
              <div className="flex justify-end">
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
              <div>
                <label htmlFor="help-proof" className="block text-sm font-medium text-foreground mb-2">
                  Checkout email or last 4 of Order ID
                </label>
                <Input
                  id="help-proof"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  placeholder="you@example.com or 1A2B"
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Prefer email? Write to{" "}
                <a href={autopayMailto} className="underline">{SUPPORT_EMAIL}</a>{" "}
                with the number on Auto Pay. We reply within 1 business day.
              </p>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !value.trim() || !proof.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: brandColor }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
                  Unsubscribe
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
