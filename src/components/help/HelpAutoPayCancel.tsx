// Auto Pay answer for the help chat. It REUSES the live AP-1 self-serve cancel: the exact HelpQuickActions component
// already on Home and FAQ (same "Unsubscribe From Autopay" dialog, same callProxy autopay/unsubscribe route, same
// verifier + Turnstile hook). No new cancel path, no new proxy call, no email-only flow; email stays the fallback.
// This is the ONLY help-chat file that may reach cellpay-proxy, and only through HelpQuickActions (tests/ enforce it).
import { lazy, Suspense, useState } from "react";
import { BellOff } from "lucide-react";

const HelpQuickActions = lazy(() =>
  import("@/components/HelpQuickActions").then((m) => ({ default: m.HelpQuickActions })),
);

interface Props {
  openLabel: string;
  fallback: string;
  formLanguageNote: string;
}

const HelpAutoPayCancel = ({ openLabel, fallback, formLanguageNote }: Props) => {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2.5" data-testid="help-autopay">
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-cellpay-green px-3 py-1.5 text-[13px] font-bold text-white hover:opacity-90"
          data-testid="help-autopay-open"
        >
          <BellOff className="h-4 w-4" aria-hidden="true" /> {openLabel}
        </button>
      ) : (
        <div className="[&>section]:max-w-none [&>section]:p-0 [&_.grid]:grid-cols-1 [&_.grid]:gap-2" data-testid="help-autopay-ap1">
          {formLanguageNote && <p className="mb-2 text-[12.5px] text-muted-foreground">{formLanguageNote}</p>}
          <Suspense fallback={null}>
            <HelpQuickActions />
          </Suspense>
        </div>
      )}
      <p className="mt-2 text-[12.5px] text-muted-foreground" data-testid="help-autopay-fallback">{fallback}</p>
    </div>
  );
};

export default HelpAutoPayCancel;
