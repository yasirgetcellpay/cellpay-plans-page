// Floating help launcher (lazy chunk). Loads the panel only on first open.
// Imports nothing from checkout / relay code (no apiWrapper, no callProxy, no Checkout).
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { detectLangFromPath } from "@/lib/i18n";
import { isHelpHiddenPath } from "./helpRoutes";
import { HELP_MOBILE_QUERY, watchHelpLauncher } from "./helpMobileGuard";
import { HELP_FLAGS_OFF, helpSettings, type HelpFlags } from "./helpSettings";
import en from "./strings-en.json";
import es from "./strings-es.json";

const loadPanel = () => import("./HelpChatPanel");
const HelpChatPanel = lazy(loadPanel);

/**
 * Phones only. The launcher floats bottom-right (16px + safe-area inset) and shows on first load; it hides while a fixed Pay bar
 * is on screen, while a Pay button or protected element (Quick Refill form, carrier/phone/amount field, plan card,
 * checkbox, terms link) is under it, or while a page text field is focused. Logic: watchHelpLauncher in
 * helpMobileGuard.ts. (body.hide-chat-mobile is NOT used: DynamicCarrier and Checkout set it unconditionally for the
 * old Tidio widget, so it no longer means "a Pay bar is showing".)
 */
function useMobileLauncher(pathname: string): { mobile: boolean; hide: boolean } {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(HELP_MOBILE_QUERY).matches);
  const [hide, setHide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(HELP_MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => { mq.removeEventListener?.("change", update); };
  }, []);

  useEffect(() => {
    if (!mobile) { setHide(false); return; }
    setHide(true);
    return watchHelpLauncher(setHide);
  }, [mobile, pathname]);

  return { mobile, hide: mobile && hide };
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
  const { mobile, hide: hideOnMobile } = useMobileLauncher(pathname);

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
      {/* Phones: the open panel has its own close button, so the launcher steps aside instead of overlapping it. */}
      {!(mobile ? open || hideOnMobile : false) && (
        <button
          ref={launcherRef}
          type="button"
          onClick={toggle}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          aria-label={open ? s.close : s.launcherAria}
          aria-expanded={open}
          aria-controls="cp-help-panel"
          data-testid="help-launcher"
          className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] md:bottom-4 z-40 inline-flex h-12 items-center gap-2 rounded-full border-2 border-[hsl(101,67%,14%)] bg-white px-4 text-[15px] font-bold text-[hsl(101,67%,22%)] shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(101,67%,14%)]"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
          <span>{open ? s.close : s.launcher}</span>
        </button>
      )}
    </div>
  );
};

export default HelpChat;
