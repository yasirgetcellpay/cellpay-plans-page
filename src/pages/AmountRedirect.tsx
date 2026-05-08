import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

// Map ?c=<carrier> values from legacy /amount.php URLs to current carrier routes.
const CARRIER_MAP: Record<string, string> = {
  pageplus: "/pageplus.html",
  pageplusadd: "/pageplus-addon",
  h2o: "/h2o.html",
  h2owireless: "/h2o.html",
  "h2o-wireless": "/h2o.html",
  cricket: "/topup-crc.html",
  metropcs: "/metropcs.html",
  metro: "/metropcs.html",
  tmobile: "/tmobile-flexi.html",
  simplemobile: "/s1.html",
  simple: "/s1.html",
  s1: "/s1.html",
  att: "/topup-at.html",
  "at&t": "/topup-at.html",
  verizon: "/verizon",
  boost: "/boost.html",
  straighttalk: "/straight-talk.html",
  "straight-talk": "/straight-talk.html",
  lyca: "/lyca.html",
  net10: "/net10.html",
  tracfone: "/tracfone.html",
  ultra: "/ultra-mobile.html",
  ultramobile: "/ultra-mobile.html",
  uscellular: "/us-cellular.html",
  "us-cellular": "/us-cellular.html",
  redpocket: "/red-pocket",
  total: "/total-wireless",
  totalwireless: "/total-wireless",
};

const AmountRedirect = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const c = (params.get("c") || "").toLowerCase().trim();
  const target = CARRIER_MAP[c] || "/";
  // Preserve any other query params (e.g. tracking) on the destination
  params.delete("c");
  const qs = params.toString();
  const to = qs ? `${target}?${qs}` : target;

  // Keep an SEO-visible body so crawlers don't see a blank page if they don't follow the redirect immediately.
  useEffect(() => {
    document.title = "Phone Recharge | CellPay";
  }, []);

  return (
    <>
      <noscript>
        <h1>Phone Recharge</h1>
        <p>Please choose your carrier at <a href="/">CellPay</a>.</p>
      </noscript>
      <Navigate to={to} replace />
    </>
  );
};

export default AmountRedirect;
