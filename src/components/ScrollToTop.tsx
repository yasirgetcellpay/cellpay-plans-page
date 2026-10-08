import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * CP-03 (EVENING-SHIP-1007): open a new page at the top.
 * Runs only when the PATH changes through a link, button or redirect (PUSH/REPLACE),
 * e.g. tapping a carrier tile at the bottom of the home grid or a footer link.
 * - First page load and back/forward (POP) are left alone (browser keeps its own position).
 * - Query-only changes on the same page (?amount=, ?gclid=) do nothing.
 * - Path + #hash: go to the top, then to that element if it is already on the page
 *   (pages with their own hash handling, like /faq#unsubscribe-autopay, keep doing it).
 * Renders nothing. No data, tracking, checkout or payment logic.
 */
export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if (navType === "POP") return;
    window.scrollTo(0, 0);
    if (hash) {
      let id = hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* keep raw id */ }
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
};
