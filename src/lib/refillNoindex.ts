// REFILL-NOINDEX-P3-1105 — host-aware noindex for refill.cellpay.us ad/mirror shells (shared build with www).
const INCLUDE_EXACT = new Set<string>([ // REFILL-NOINDEX-P3-1105
  "/metropcs.html", "/metro-pcs.html", "/straight-talk.html", "/topup-crc.html", // REFILL-NOINDEX-P3-1105
  "/total-wireless.html", "/total-wireless", "/tmobile-flexi.html", "/topup-at.html", // REFILL-NOINDEX-P3-1105
  "/s1.html", "/boost.html", "/h2o.html", "/pageplus.html", // REFILL-NOINDEX-P3-1105
  "/metropcs", "/boost", "/s1", "/h2o", "/pageplus", "/straight-talk", "/topup-crc", "/topup-at", "/tmobile-flexi", // REFILL-NOINDEX-P3-1105
  "/es/metropcs.html", "/es/metro-pcs.html", "/es/straight-talk.html", "/es/topup-crc.html", // REFILL-NOINDEX-P3-1105
  "/es/total-wireless.html", "/es/total-wireless", "/es/tmobile-flexi.html", "/es/topup-at.html", // REFILL-NOINDEX-P3-1105
  "/es/s1.html", "/es/boost.html", "/es/h2o.html", "/es/pageplus.html", // REFILL-NOINDEX-P3-1105
  "/es/metropcs", "/es/boost", "/es/s1", "/es/h2o", "/es/pageplus", "/es/straight-talk", "/es/topup-crc", "/es/topup-at", "/es/tmobile-flexi", // REFILL-NOINDEX-P3-1105
]); // REFILL-NOINDEX-P3-1105

export function isRefillAdsHost(hostname = typeof location !== "undefined" ? location.hostname : ""): boolean { // REFILL-NOINDEX-P3-1105
  const h = (hostname || "").toLowerCase(); // REFILL-NOINDEX-P3-1105
  if (h === "www.cellpay.us" || h === "cellpay.us") return false; // REFILL-NOINDEX-P3-1105
  return h === "refill.cellpay.us" || h.endsWith(".lovable.app") || h.includes("lovableproject.com") || h.endsWith(".lovable.dev"); // REFILL-NOINDEX-P3-1105
} // REFILL-NOINDEX-P3-1105

export function pathNeedsRefillNoindex(pathname = typeof location !== "undefined" ? location.pathname : "/"): boolean { // REFILL-NOINDEX-P3-1105
  const p = (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname) || "/"; // REFILL-NOINDEX-P3-1105
  // Never touch private/checkout (keep noindex,nofollow) or /go ads shells (already noindex,follow). // REFILL-NOINDEX-P3-1105
  if (/^\/(es\/)?(checkout|order-confirmation|payment-callback|orders|profile|admin|account|login|auth)(\/|$)/.test(p)) return false; // REFILL-NOINDEX-P3-1105
  if (/^\/(es\/)?go(\/|$)/.test(p)) return false; // REFILL-NOINDEX-P3-1105
  if (p.startsWith("/how-to-pay/") || p.startsWith("/es/como-pagar/")) return true; // REFILL-NOINDEX-P3-1105
  return INCLUDE_EXACT.has(p); // REFILL-NOINDEX-P3-1105
} // REFILL-NOINDEX-P3-1105

/** Set robots to noindex,follow on refill host INCLUDE paths only. No-op on www. Does not weaken noindex,nofollow. */ // REFILL-NOINDEX-P3-1105
export function enforceRefillHostNoindex(): void { // REFILL-NOINDEX-P3-1105
  if (typeof document === "undefined") return; // REFILL-NOINDEX-P3-1105
  if (!isRefillAdsHost() || !pathNeedsRefillNoindex()) return; // REFILL-NOINDEX-P3-1105
  let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]'); // REFILL-NOINDEX-P3-1105
  const cur = (el?.getAttribute("content") || "").toLowerCase(); // REFILL-NOINDEX-P3-1105
  if (cur.includes("nofollow") && cur.includes("noindex")) return; // REFILL-NOINDEX-P3-1105
  if (!el) { // REFILL-NOINDEX-P3-1105
    el = document.createElement("meta"); // REFILL-NOINDEX-P3-1105
    el.setAttribute("name", "robots"); // REFILL-NOINDEX-P3-1105
    el.setAttribute("data-refill-noindex-p3-1105", "true"); // REFILL-NOINDEX-P3-1105
    document.head.appendChild(el); // REFILL-NOINDEX-P3-1105
  } // REFILL-NOINDEX-P3-1105
  el.setAttribute("content", "noindex,follow"); // REFILL-NOINDEX-P3-1105
} // REFILL-NOINDEX-P3-1105