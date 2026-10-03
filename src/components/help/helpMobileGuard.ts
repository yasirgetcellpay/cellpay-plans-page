// Phone dock for the floating help launcher (no imports from checkout / relay code).
// HC-ALL (Lead, Oct 3): the overlap-removal guard that used to live here is deleted (it hid the launcher whenever a Pay bar,
// Pay button, plan card, form field, checkbox or terms link was on screen or under it, so Help was missing on most carrier
// pages, and the route list hid it on checkout / confirmation). What is left:
//   * the launcher always shows, compact (48px icon-only on phones), docked bottom-right (16px + safe-area inset);
//   * where a bottom fixed Pay bar exists (carrier Total / PAY NOW bar) and reserves a slot for it (data-help-dock-slot,
//     DynamicCarrier's phone bar: pr-[72px]), it docks INSIDE the bar, vertically centred on the bar's button (Lead option B),
//     so it never covers PAY NOW, the Total, the amount field or the plan grid; a bottom bar without a slot: HELP_DOCK_GAP_PX
//     above the bar's top edge. Both measured at runtime (the bar already sits above env(safe-area-inset-bottom));
//   * the launcher adds an 80px in-flow spacer at the end of the page (HelpChat.tsx), so the last plan row / Place Order can
//     always be scrolled clear of it (phones and desktop);
//   * it hides only while a page text field is focused (keypad up) and comes back on blur.
// The file keeps its name so nothing that imports it can break.

/** Phones / small tablets: Tailwind md breakpoint. */
export const HELP_MOBILE_QUERY = "(max-width: 767px)";

/** Default phone position (keep in sync with the launcher's `right-4 bottom-[calc(16px+env(safe-area-inset-bottom))]`). */
export const HELP_MOBILE_BOTTOM_PX = 16;
export const HELP_MOBILE_RIGHT_PX = 16;
/** Compact launcher on phones: 48px round, icon only (px, not rem: the site root font-size is 16.5px, so h-12 = 49.5px). */
export const HELP_LAUNCHER_SIZE_PX = 48;
/** Gap between the launcher and the top edge of a bottom fixed Pay bar that has no slot for it. */
export const HELP_DOCK_GAP_PX = 12;
/** Marks a bottom bar that reserves room at its right end for the launcher (it then docks inside the bar). */
export const HELP_DOCK_SLOT_ATTR = "data-help-dock-slot";

/** Never treat the help widget's own elements as page elements. */
const OWN_WIDGET = "#cp-help-panel, [data-help-widget]";
const TYPING_SELECTOR = "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']), select, textarea";

/** Bottom fixed bars that hold a button (the carrier Total / PAY NOW bar): fixed, on screen, top in the lower half of the
 *  viewport and bottom edge at the screen edge. Found from the buttons up, so no page markup is needed. */
export function findBottomBars(root: ParentNode = document): Set<Element> {
  const bars = new Set<Element>();
  const vh = window.innerHeight;
  root.querySelectorAll("button, [role='button'], input[type='submit']").forEach((el) => {
    if (el.closest(OWN_WIDGET)) return;
    for (let e: Element | null = el.parentElement; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).position !== "fixed") continue;
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.bottom >= vh - 2 && r.top >= vh / 2 && !e.closest(OWN_WIDGET)) bars.add(e);
      break;
    }
  });
  return bars;
}

/** Launcher bottom offset in px for the visible bottom bars; 0 = no bar (default position).
 *  Bar with a slot: centred on the bar's button (or on the bar's content box), inside the bar.
 *  Bar without a slot: HELP_DOCK_GAP_PX above its top edge. The highest result wins. */
export function barLiftPx(bars: Iterable<Element>, vh: number): number {
  let lift = 0;
  for (const b of bars) {
    if (!b.isConnected) continue;
    const r = b.getBoundingClientRect();
    if (!(r.height > 0 && r.top < vh && r.bottom > 0)) continue;
    if (b.hasAttribute(HELP_DOCK_SLOT_ATTR)) {
      const btn = b.querySelector("button");
      const q = btn ? btn.getBoundingClientRect() : null;
      const pb = parseFloat(getComputedStyle(b).paddingBottom) || 0;
      const centre = q && q.height > 0 ? q.top + q.height / 2 : r.top + (r.height - pb) / 2;
      lift = Math.max(lift, Math.round(vh - centre - HELP_LAUNCHER_SIZE_PX / 2));
    } else {
      lift = Math.max(lift, Math.round(vh - r.top + HELP_DOCK_GAP_PX));
    }
  }
  return Math.max(0, lift);
}

export interface HelpDockState { lift: number; typing: boolean; }

/**
 * Phones: reports { lift, typing } now and on every change. lift = bottom offset above a bottom fixed Pay bar (0 = default
 * position); typing = a page text field is focused (hide the launcher). Re-measures once per frame while the page changes
 * (the bar appears after plans load), when the viewport or the bar resizes, and on focus changes. Returns a cleanup function.
 */
export function watchHelpDock(onState: (s: HelpDockState) => void): () => void {
  let lift = 0, typing = false, sent = "";
  const bars = new Set<Element>();
  const publish = () => { const k = `${lift}|${typing}`; if (k !== sent) { sent = k; onState({ lift, typing }); } };
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { lift = barLiftPx(bars, window.innerHeight); publish(); });
  const measure = () => {
    const found = findBottomBars();
    for (const b of found) if (!bars.has(b)) { bars.add(b); ro?.observe(b); }
    for (const b of [...bars]) if (!found.has(b) || !b.isConnected) { bars.delete(b); ro?.unobserve(b); }
    lift = barLiftPx(bars, window.innerHeight);
    publish();
  };
  let frame = 0;
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; measure(); }); };
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  window.addEventListener("resize", schedule);
  const onFocus = () => {
    const a = document.activeElement;
    typing = !!a && a.matches(TYPING_SELECTOR) && !a.closest(OWN_WIDGET);
    publish();
  };
  document.addEventListener("focusin", onFocus);
  document.addEventListener("focusout", onFocus);
  typing = false; onFocus(); measure();
  return () => {
    mo.disconnect(); ro?.disconnect(); window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("focusout", onFocus);
  };
}
