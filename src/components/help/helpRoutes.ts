// Route rules + carrier links for the CellPay help chat. No imports from checkout/relay code.

/** Payment / checkout / admin routes (with or without /es) where the widget never renders. */
const HIDDEN_PREFIXES = [
  "/checkout", // includes /checkout/cashapp-return
  "/payment-callback",
  "/order-confirmation",
  "/admin",
];

export function isHelpHiddenPath(pathname: string): boolean {
  const p = (pathname || "/").toLowerCase().replace(/^\/es(?=\/|$)/, "") || "/";
  return HIDDEN_PREFIXES.some((h) => p === h || p.startsWith(`${h}/`));
}

export interface HelpCarrier { name: string; path: string; aliases: string[]; }

/** CellPay carrier pages (App.tsx carrierRoutes + static StraightTalk / USCellular pages).
 *  Excluded: Page Plus Addon Balance, Red Pocket, XBOX, Movistar, Movistar Flexi (#3 CP-12), AT&T FirstNet (static, on hold).
 *  RE-VERIFY against HEAD App.tsx at send time (checks/verify-carriers.py). No international link. */
export const HELP_CARRIERS: HelpCarrier[] = [
  { name: "Simple Mobile", path: "/s1.html", aliases: ["simple mobile", "simple"] },
  { name: "Cricket Wireless", path: "/topup-crc.html", aliases: ["cricket"] },
  { name: "Metro PCS", path: "/metropcs.html", aliases: ["metro", "metropcs", "metro pcs"] },
  { name: "T-Mobile", path: "/tmobile-flexi.html", aliases: ["t mobile", "tmobile"] },
  { name: "AT&T Prepaid", path: "/topup-at.html", aliases: ["at t", "att", "at and t"] },
  { name: "Verizon Wireless Prepaid", path: "/verizon", aliases: ["verizon"] },
  { name: "Boost Mobile", path: "/boost.html", aliases: ["boost"] },
  { name: "Straight Talk", path: "/straight-talk.html", aliases: ["straight talk", "straighttalk"] },
  { name: "H2O Wireless", path: "/h2o.html", aliases: ["h2o"] },
  { name: "Lyca Mobile", path: "/lyca.html", aliases: ["lyca", "lycamobile"] },
  { name: "Net10 Wireless", path: "/net10.html", aliases: ["net10", "net 10"] },
  { name: "Page Plus", path: "/pageplus.html", aliases: ["page plus", "pageplus"] },
  { name: "TracFone", path: "/tracfone.html", aliases: ["tracfone", "trac fone"] },
  { name: "Ultra Mobile", path: "/ultra-mobile.html", aliases: ["ultra"] },
  { name: "US Cellular", path: "/us-cellular.html", aliases: ["us cellular", "uscellular"] },
  { name: "Total Wireless", path: "/total-wireless", aliases: ["total wireless"] },
];
