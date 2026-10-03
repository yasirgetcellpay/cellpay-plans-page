// Mobile guard for the floating help launcher (no imports from checkout / relay code).
// CellPay port of the partner-site launcher-fix version (Oct 3). CellPay changes: top offset 88px (CellPay's header is
// taller than the 58px it was tuned for; re-check on real devices), and data-cp-primary-action is honoured too.
// Rule (lead, Oct 2 + Oct 3): on phones the launcher shows on first load, but it must never cover Pay / PAY NOW /
// Place Order, a plan card, a checkbox, a terms link, the Quick Refill form or any carrier/phone/amount field.
// Oct 3 fix: on phones it sits top-right, just under the sticky header (the forms and Pay live lower on the first
// screen), and it hides only when one of those elements would be UNDER it, while a fixed Pay bar is on screen, or
// while a page text field is focused (keypad). (Before: it sat bottom-right and hid while any of them was anywhere on
// screen or up to 240px below it, so on most pages it only appeared after scrolling.)
// Detection is markup-agnostic (no edits to carrier pages needed) and also honours an explicit
// data-cm-primary-action / data-cp-primary-action attribute if a page ever adds one. A fixed Pay bar is covered too:
// its button is watched, and the fixed bar that contains it is watched as well.

/** Phones / small tablets: Tailwind md breakpoint. */
export const HELP_MOBILE_QUERY = "(max-width: 767px)";

/** Phone position (keep in sync with the launcher's `top-[88px] right-4` classes): about 10px under CellPay's header. */
export const HELP_MOBILE_TOP_PX = 88;
export const HELP_MOBILE_RIGHT_PX = 16;
/** Launcher box on phones (48px tall; 124px covers "Help" / "Ayuda" / "Cerrar" plus the icon). */
export const HELP_LAUNCHER_W_PX = 124;
export const HELP_LAUNCHER_H_PX = 48;
/** Margin around the launcher, and how far below it a protected element already counts (content scrolls up into it). */
export const HELP_ZONE_PAD_PX = 8;
export const HELP_LOOKAHEAD_PX = 48;

/** Lead decision (Oct 3, 9:03): false = hide only when a Pay button would be under the launcher; a fixed Pay bar on
 *  screen still hides it. true = hidden whenever any Pay button is on screen (Help then stays hidden at load on pages
 *  that show PAY NOW in the first screen). */
export const HELP_HIDE_WHILE_PAY_ON_SCREEN = false;

/** Elements that are protected by markup alone. */
export const PRIMARY_SELECTOR = [
  "[data-cm-primary-action]",
  "[data-cp-primary-action]",
  "button[type='submit']",
  "input[type='submit']",
  "input[type='checkbox']",
  "[role='checkbox']",
].join(",");
/** Form controls the launcher must not cover (Quick Refill form, carrier select, phone / amount fields). */
const FIELD_SELECTOR = "form, input:not([type='hidden']), select, textarea";

/** Pay buttons (EN + ES). Quick Refill's "Continue to payment" is a form button, not Pay: it is protected as part of the form. */
const PAY_TEXT = /^(pay\b|pagar\b|place (your )?order|realizar (el )?pedido|checkout\b|buy\b|comprar\b|verifying|verificando)/i;
/** Clickable elements whose text makes them a primary action (EN + ES), or that carry a price (plan cards). */
const PRIMARY_TEXT =
  /^(pay\b|pagar\b|place (your )?order|realizar (el )?pedido|continue to (payment|checkout)|continuar (al|con el) pago|checkout\b|buy\b|comprar\b|verifying|verificando)/i;
const PRICE_TEXT = /\$\s?\d/;
const TERMS_TEXT = /terms|t[eé]rminos|condiciones|conditions|view more|ver m[aá]s|polic/i;

/** Never treat the help widget's own controls as page actions. */
const OWN_WIDGET = "#cp-help-panel, [data-help-widget]";

const norm = (text: string) => (text || "").replace(/\s+/g, " ").trim();

export function isPrimaryText(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  return PRIMARY_TEXT.test(t) || (t.length <= 160 && PRICE_TEXT.test(t));
}

export function isPayText(text: string): boolean {
  return PAY_TEXT.test(norm(text));
}

function fixedAncestor(el: Element): Element | null {
  for (let e: Element | null = el.parentElement; e && e !== document.body; e = e.parentElement) {
    if (getComputedStyle(e).position === "fixed") return e;
  }
  return null;
}

/** Every element the launcher must never cover, found in the current document. */
export function findPrimaryTargets(root: ParentNode = document): Set<Element> {
  return findHelpTargets(root).cover;
}

/** pay: hide while on screen (with any fixed bar holding it). cover: hide only while under the launcher zone. */
export function findHelpTargets(root: ParentNode = document, hideWhilePayOnScreen = HELP_HIDE_WHILE_PAY_ON_SCREEN): { pay: Set<Element>; cover: Set<Element> } {
  const pay = new Set<Element>();
  const cover = new Set<Element>();
  root.querySelectorAll(PRIMARY_SELECTOR).forEach((el) => {
    (el.matches("[data-cm-primary-action], [data-cp-primary-action]") ? pay : cover).add(el);
    const label = el.closest("label");
    if (label) cover.add(label);
  });
  root.querySelectorAll(FIELD_SELECTOR).forEach((el) => cover.add(el));
  root.querySelectorAll("button, [role='button'], a").forEach((el) => {
    const text = el.textContent || "";
    if (isPayText(text)) pay.add(el);
    else if (isPrimaryText(text)) cover.add(el);
    else if (el.tagName === "A" && TERMS_TEXT.test(text) && !el.closest("footer")) cover.add(el);
  });
  for (const set of [pay, cover]) {
    for (const el of [...set]) {
      if (el.closest(OWN_WIDGET)) { set.delete(el); continue; }
      const bar = fixedAncestor(el);
      if (bar && !bar.closest(OWN_WIDGET)) pay.add(bar); // a fixed bar holding a protected control: hide while on screen
    }
  }
  if (!hideWhilePayOnScreen) {
    for (const el of [...pay]) if (getComputedStyle(el).position !== "fixed") { pay.delete(el); cover.add(el); }
  }
  for (const el of pay) cover.delete(el);
  return { pay, cover };
}

/** Area the launcher needs on a phone, in viewport px: its box plus padding, extended up to the top of the screen
 *  (content scrolling down arrives from there) and HELP_LOOKAHEAD_PX below it. */
export function launcherZone(vw: number): { left: number; top: number; right: number; bottom: number } {
  const right = vw - HELP_MOBILE_RIGHT_PX;
  return {
    left: right - HELP_LAUNCHER_W_PX - HELP_ZONE_PAD_PX,
    top: 0,
    right: vw,
    bottom: HELP_MOBILE_TOP_PX + HELP_LAUNCHER_H_PX + HELP_ZONE_PAD_PX + HELP_LOOKAHEAD_PX,
  };
}

/** IntersectionObserver rootMargin that shrinks the viewport to launcherZone(vw). */
export function zoneRootMargin(vw: number, vh: number): string {
  const z = launcherZone(vw);
  return `0px 0px ${-Math.max(0, Math.round(vh - z.bottom))}px ${-Math.max(0, Math.round(z.left))}px`;
}

const TYPING_SELECTOR = "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']), select, textarea";

/**
 * Phones: calls onHide(true) while a Pay button / Pay bar is on screen, while any protected element is under (or
 * about to scroll under) the launcher, or while a page text field is focused (keypad open). Starts hidden until the
 * first measurement (one frame), so it never flashes over anything. Fails safe: no IntersectionObserver = hidden.
 * Returns a cleanup function.
 */
export function watchHelpLauncher(onHide: (hide: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") { onHide(true); return () => {}; }
  const payOn = new Set<Element>(), coverOn = new Set<Element>();
  const payWait = new Set<Element>(), coverWait = new Set<Element>(); // observed, first report not in yet: counts as on
  const payWatched = new Set<Element>(), coverWatched = new Set<Element>();
  let typing = false;
  const publish = () => onHide(typing || payOn.size > 0 || coverOn.size > 0 || payWait.size > 0 || coverWait.size > 0);
  const hit = (e: IntersectionObserverEntry) => e.isIntersecting && e.intersectionRect.width > 0 && e.intersectionRect.height > 0;
  const report = (on: Set<Element>, wait: Set<Element>) => (entries: IntersectionObserverEntry[]) => {
    for (const e of entries) { wait.delete(e.target); if (hit(e)) on.add(e.target); else on.delete(e.target); }
    publish();
  };
  const payIo = new IntersectionObserver(report(payOn, payWait), { threshold: 0 });
  const makeCoverIo = () => new IntersectionObserver(report(coverOn, coverWait), { threshold: 0, rootMargin: zoneRootMargin(window.innerWidth, window.innerHeight) });
  let coverIo = makeCoverIo();
  const sync = (found: Set<Element>, watched: Set<Element>, io: IntersectionObserver, on: Set<Element>, wait: Set<Element>) => {
    for (const el of found) if (!watched.has(el)) { watched.add(el); wait.add(el); io.observe(el); }
    for (const el of [...watched]) {
      if (!found.has(el) || !el.isConnected) { watched.delete(el); on.delete(el); wait.delete(el); io.unobserve(el); }
    }
  };
  const scan = () => {
    const { pay, cover } = findHelpTargets();
    sync(pay, payWatched, payIo, payOn, payWait);
    sync(cover, coverWatched, coverIo, coverOn, coverWait);
    publish(); // nothing watched = nothing to cover
  };
  scan();
  // Re-scan once per frame while the page changes (a Pay button or plan grid appearing is picked up before paint).
  let frame = 0;
  const mo = new MutationObserver(() => {
    if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; scan(); });
  });
  mo.observe(document.body, { childList: true, subtree: true });
  // The zone is in viewport px: rebuild the zone observer when the viewport size changes (rotation, URL bar).
  let size = `${window.innerWidth}x${window.innerHeight}`;
  const onResize = () => {
    const now = `${window.innerWidth}x${window.innerHeight}`;
    if (now === size) return;
    size = now; coverIo.disconnect(); coverOn.clear(); coverWait.clear(); coverWatched.clear(); coverIo = makeCoverIo(); scan();
  };
  window.addEventListener("resize", onResize);
  const onFocus = () => {
    const a = document.activeElement;
    typing = !!a && a.matches(TYPING_SELECTOR) && !a.closest(OWN_WIDGET);
    publish();
  };
  document.addEventListener("focusin", onFocus);
  document.addEventListener("focusout", onFocus);
  onFocus();
  return () => {
    mo.disconnect(); payIo.disconnect(); coverIo.disconnect(); window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("focusout", onFocus);
  };
}
