// Floating help launcher (lazy chunk). Loads the panel only on first open.
// Imports nothing from checkout / relay code (no apiWrapper, no callProxy, no Checkout).
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { detectLangFromPath } from "@/lib/i18n";
import { isHelpHiddenPath } from "./helpRoutes";
import { HELP_MOBILE_QUERY, watchHelpDock } from "./helpMobileGuard";
import { HELP_FLAGS_OFF, helpSettings, type HelpFlags } from "./helpSettings";
import en from "./strings-en.json";
import es from "./strings-es.json";

const loadPanel = () => import("./HelpChatPanel");
const HelpChatPanel = lazy(loadPanel);

/**
 * Phones only (HC-ALL, Lead Oct 3, option B). The launcher always shows: a compact 48px icon-only button docked bottom-right
 * (16px + safe-area inset), or inside the slot the carrier Total / PAY NOW bar reserves for it (lift, measured at runtime). It hides only while a page text field is focused (keypad up) and comes back on blur. Logic: watchHelpDock in
 * helpMobileGuard.ts (the old overlap guard is deleted). Hidden until the first measurement (one frame) so it never
 * flashes over the bar. (body.hide-chat-mobile is NOT used: DynamicCarrier and Checkout set it for the old Tidio widget.)
 */
function useMobileLauncher(pathname: string): { mobile: boolean; hide: boolean; lift: number } {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(HELP_MOBILE_QUERY).matches);
  const [hide, setHide] = useState(true);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia(HELP_MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => { mq.removeEventListener?.("change", update); };
  }, []);

  useEffect(() => {
    if (!mobile) { setHide(false); setLift(0); return; }
    setHide(true);
    return watchHelpDock(({ lift: l, typing }) => { setLift(l); setHide(typing); });
  }, [mobile, pathname]);

  return { mobile, hide: mobile && hide, lift: mobile ? lift : 0 };
}

/** Runtime switch (help_settings, cached 5 min). Until it answers, and on any error, everything is OFF. */
function useHelpFlags(): HelpFlags {
  const [flags, setFlags] = useState<HelpFlags>(HELP_FLAGS_OFF);
  useEffect(() => {
    let alive = true;
    helpSettings().then((f) => { if (alive) setFlags(f); }, () => { if (alive) setFlags(HELP_FLAGS_OFF); });
    return () => { alive = false; };
  }, []);
  return flags;
}

const HelpChat = () => {
  const flags = useHelpFlags();
  const { pathname } = useLocation();
  const lang = detectLangFromPath(pathname);
  const s = lang === "es" ? es.ui : en.ui;
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hidden = isHelpHiddenPath(pathname);
  const { mobile, hide: hideOnMobile, lift } = useMobileLauncher(pathname);

  // Focus goes back to the launcher after the panel closes by any route (X, Esc, a carrier/topic link that navigates).
  // On phones the launcher may be hidden for a frame (guard re-measures after navigation), so the request waits up to
  // 1.5 s for it to mount, and is dropped if the visitor has focused something else meanwhile.
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const openRef = useRef(false);
  const refocusUntil = useRef(0);
  openRef.current = open;
  const close = useCallback(() => { refocusUntil.current = Date.now() + 1500; setOpen(false); }, []);

  // Close when navigating into a hidden (checkout/payment) route, and on every page change.
  useEffect(() => { if (openRef.current) refocusUntil.current = Date.now() + 1500; setOpen(false); }, [pathname]);

  useEffect(() => {
    if (open || !refocusUntil.current) return;
    const el = launcherRef.current;
    const a = document.activeElement;
    const elsewhere = a && a !== document.body && !a.closest("[data-help-widget]");
    if (Date.now() > refocusUntil.current || elsewhere) { refocusUntil.current = 0; return; }
    if (el) { el.focus({ preventScroll: true }); refocusUntil.current = 0; }
  });

  const toggle = useCallback(() => { setLoaded(true); setOpen((o) => !o); }, []);
  const prefetch = useCallback(() => { void loadPanel(); }, []);

  if (hidden || !flags.chat_enabled) return null;

  return (
    <div data-help-widget="">
      {loaded && (
        <Suspense fallback={null}>
          <HelpChatPanel open={open} lang={lang} flags={flags} onClose={close} />
        </Suspense>
      )}
      {/* Every page: 80px of in-flow space at the very end, so the last plan row / Place Order can scroll clear of the launcher
          (phones and desktop). It is below all page content, so it shifts nothing. */}
      <div aria-hidden="true" data-help-spacer="" className="h-[80px]" />
      {/* Phones: the open panel has its own close button, so the launcher steps aside instead of overlapping it.
          lift > 0: docked in (or above) the bottom Pay bar. A new lift re-mounts the button (key) at its new place instead of moving
          it, so it is never a layout shift; it is fixed, so it reserves no space. */}
      {!(mobile ? open || hideOnMobile : false) && (
        <button
          key={lift > 0 ? `lift-${lift}` : "base"}
          style={lift > 0 ? { bottom: `${lift}px` } : undefined}
          ref={launcherRef}
          type="button"
          onClick={toggle}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          aria-label={open ? s.close : s.launcherAria}
          aria-expanded={open}
          aria-controls="cp-help-panel"
          data-testid="help-launcher"
          className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] md:bottom-4 z-40 inline-flex h-[48px] w-[48px] md:h-12 md:w-auto items-center justify-center gap-2 rounded-full border-2 border-[hsl(101,67%,14%)] bg-white px-0 md:px-4 text-[15px] font-bold text-[hsl(101,67%,22%)] shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(101,67%,14%)]"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
          <span className="hidden md:inline">{open ? s.close : s.launcher}</span>
        </button>
      )}
    </div>
  );
};

export default HelpChat;
