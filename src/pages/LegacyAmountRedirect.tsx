import { Navigate, useLocation } from "react-router-dom";

// Legacy URL pattern: /{amount}-{carrierSlug}-prepaid-refill.html
// Redirect to the matching carrier category page (200 OK content).
const SLUG_TO_PATH: Record<string, string> = {
  "topup-at": "/topup-at.html",
  "metropcs": "/metropcs.html",
  "metro-pcs": "/metropcs.html",
  "boost": "/boost.html",
  "tmobile": "/tmobile-flexi.html",
  "tmobile-flexi": "/tmobile-flexi.html",
  "topup-crc": "/topup-crc.html",
  "cricket": "/topup-crc.html",
  "s1": "/s1.html",
  "simple": "/s1.html",
  "simple-mobile": "/s1.html",
  "verizon": "/verizon-wireless-flexi.html",
  "verizon-wireless-flexi": "/verizon-wireless-flexi.html",
  "h2o": "/h2o.html",
  "lyca": "/lyca.html",
  "net10": "/net10.html",
  "pageplus": "/pageplus.html",
  "tracfone": "/tracfone.html",
  "ultra-mobile": "/ultra-mobile.html",
  "ultra": "/ultra-mobile.html",
  "us-cellular": "/us-cellular.html",
  "straight-talk": "/straight-talk.html",
  "red-pocket": "/red-pocket",
  "red-pocket-mobile": "/red-pocket",
  "total-wireless": "/total-wireless",
};

const LegacyAmountRedirect = () => {
  const { pathname, search } = useLocation();
  // Match /{amount}-{slug}-prepaid-refill.html  (slug may contain hyphens)
  const m = pathname.match(/^\/(\d+)-(.+)-prepaid-refill\.html$/i);
  const slug = m?.[2]?.toLowerCase() ?? "";
  const target = SLUG_TO_PATH[slug] || "/";
  const to = `${target}${search || ""}`;

  return (
    <>
      <noscript>
        <h1>Phone Recharge</h1>
        <p>This page has moved. Visit <a href={target}>{target}</a> to recharge your phone.</p>
      </noscript>
      <Navigate to={to} replace />
    </>
  );
};

export default LegacyAmountRedirect;
