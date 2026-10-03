import { useState } from "react";
import { Receipt, BellOff, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Mode = "lookup" | "unsubscribe" | null;

interface HelpQuickActionsProps {
  brandColor?: string;
}

const SUPPORT_EMAIL = "support@getcellpay.com";

// Phone-number lookups and autopay changes are no longer done online (privacy).
// These cards now point customers to support instead of calling the API.
export const HelpQuickActions = ({ brandColor = "hsl(101,67%,44%)" }: HelpQuickActionsProps) => {
  const [mode, setMode] = useState<Mode>(null);

  const subject = mode === "unsubscribe" ? "Cancel autopay" : "Did not receive my refill";
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

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
                Email support to cancel scheduled recurring recharges.
              </p>
            </div>
          </button>
        </div>
      </section>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "lookup" ? "Did Not Receive Your Payment?" : "Unsubscribe From Autopay"}
            </DialogTitle>
            <DialogDescription>
              {mode === "lookup"
                ? `For your privacy, online lookup isn't available. Email ${SUPPORT_EMAIL} with your phone number and Order ID and we'll check it for you.`
                : `To cancel autopay, email ${SUPPORT_EMAIL} with the wireless number enrolled in autopay.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode(null)}
              className="px-4 py-2 rounded-full text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
            >
              Close
            </button>
            <a
              href={mailto}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: brandColor }}
            >
              <Mail className="w-4 h-4" />
              Email support
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
