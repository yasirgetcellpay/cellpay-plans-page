import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { HELP_CHAT_ENABLED } from "@/components/help/helpChatFlag";
import { AuthProvider } from "@/contexts/AuthContext";
import { captureTrackingIdsFromUrl } from "@/lib/tracking";
import { usePresence } from "@/hooks/usePresence";
import Home from "./pages/Home.tsx";
import DynamicCarrier from "./pages/DynamicCarrier.tsx";
import PaymentCallback from "./pages/PaymentCallback.tsx";
import OrderConfirmation from "./pages/OrderConfirmation.tsx";
import CashAppReturn from "./pages/CashAppReturn.tsx";
import NotFound from "./pages/NotFound.tsx";
import AmountRedirect from "./pages/AmountRedirect.tsx";
import LegacyAmountRedirect from "./pages/LegacyAmountRedirect.tsx";
import StraightTalk from "./pages/StraightTalk.tsx";
import Verizon from "./pages/Verizon.tsx";
import ATT from "./pages/ATT.tsx";
import { Toaster } from "@/components/ui/toaster";

import simpleMobileLogo from "@/assets/simple-mobile-logo.png";
import cricketLogo from "@/assets/cricket-logo.webp";
import metroLogo from "@/assets/metro-logo.svg";
import tmobileLogo from "@/assets/tmobile-logo.svg";
import attLogo from "@/assets/att-prepaid-logo.webp";
import verizonLogo from "@/assets/verizon-logo.png";
import boostLogo from "@/assets/boost-logo.png";
import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import h2oLogo from "@/assets/h2o-logo.png";
import lycaLogo from "@/assets/lyca-logo.webp";
import net10Logo from "@/assets/net10-logo.png";
import pageplusLogo from "@/assets/pageplus-logo.png";
import tracfoneLogo from "@/assets/tracfone-logo.svg";
import ultraLogo from "@/assets/ultra-mobile-logo.png";

// Help chat (#9): lazy chunk, loaded after first render; renders nothing until help_settings.chat_enabled is true.
// SP-1b-fix: if the help chunk can't load (network blip, blocker, load cancelled), render nothing so the page keeps working
// (never the whole-page "Something went wrong" screen). No retry here: browsers keep the failed module for that URL.
const HelpChatOff = () => null;
const HelpChat = lazy(() => import("@/components/help/HelpChat").catch(() => ({ default: HelpChatOff })));
// Same for anything inside Help chat (its panel / Auto Pay chunks load when Help is opened): an error there hides Help only.
class HelpChatBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Speed S1c: pages a paid visitor doesn't need on first load are split into their own chunks (landing pages,
// carrier pages, the static carrier pages and the payment return/confirmation pages stay in the main bundle).
// If a chunk fails to load (e.g. a tab left open across a new publish) the page reloads once; if it fails again,
// a short "please refresh" note shows instead of a blank page.
const CHUNK_RELOAD_KEY = "cp_chunk_reload";
const ChunkLoadError = () => {
  const es = typeof window !== "undefined" && /^\/es(\/|$)/.test(window.location.pathname);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
      <p className="text-base text-foreground">
        {es ? "No pudimos cargar esta página. " : "We couldn't load this page. "}
        <a href={typeof window !== "undefined" ? window.location.href : "/"} className="underline font-semibold">
          {es ? "Toque para recargar" : "Tap to reload"}
        </a>
      </p>
    </div>
  );
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyPage<T extends import("react").ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((m) => {
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* private mode */ }
        return m;
      })
      .catch(() => {
        try {
          if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
            window.location.reload();
            return new Promise<{ default: T }>(() => {});
          }
        } catch { /* private mode: fall through */ }
        return { default: ChunkLoadError as unknown as T };
      }),
  );
}
const loadCheckout = () => import("./pages/Checkout.tsx");
const Checkout = lazyPage(loadCheckout);
const Profile = lazyPage(() => import("./pages/Profile.tsx"));
const Orders = lazyPage(() => import("./pages/Orders.tsx"));
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword.tsx"));
const AboutUs = lazyPage(() => import("./pages/AboutUs.tsx"));
const ContactUs = lazyPage(() => import("./pages/ContactUs.tsx"));
const FAQ = lazyPage(() => import("./pages/FAQ.tsx"));
const HowToUse = lazyPage(() => import("./pages/HowToUse.tsx"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy.tsx"));
const TermsAndConditions = lazyPage(() => import("./pages/TermsAndConditions.tsx"));
const ReturnsPolicy = lazyPage(() => import("./pages/ReturnsPolicy.tsx"));
const DMCA = lazyPage(() => import("./pages/DMCA.tsx"));
const AdminLogin = lazyPage(() => import("./pages/AdminLogin.tsx"));
const Login = lazyPage(() => import("./pages/Login.tsx"));
const AdminDashboard = lazyPage(() => import("./pages/AdminDashboard.tsx"));
// GO-1: dedicated paid-ad landers (/go/*) — split chunk; noindex shells in vite.config.ts
const GoLander = lazyPage(() => import("./pages/GoLander.tsx"));

/** Full-height blank while a split page loads, so the footer never flashes up and nothing jumps. */
const RouteFallback = () => <div className="min-h-screen bg-background" aria-busy="true" />;

/** Starts downloading the checkout chunk on the visitor's first tap or key press, so PLACE ORDER never waits for it. */
const CheckoutPrefetch = () => {
  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    let started = false;
    const off = () => events.forEach((e) => window.removeEventListener(e, start));
    function start() {
      if (started) return;
      started = true;
      off();
      loadCheckout().catch(() => { /* lazyPage retries when the route renders */ });
    }
    events.forEach((e) => window.addEventListener(e, start, { passive: true }));
    return off;
  }, []);
  return null;
};

interface CarrierRouteDef {
  path: string;            // English path (without leading /es)
  name: string;
  slug: string;
  carrierId: number;
  brandColor: string;
  logo?: string;
}

// Single source of truth for every carrier route. English path + auto /es/ mirror.
const carrierRoutes: CarrierRouteDef[] = [
  { path: "/s1.html", name: "Simple Mobile", slug: "s1", carrierId: 15, brandColor: "hsl(101,67%,44%)", logo: simpleMobileLogo },
  { path: "/topup-crc.html", name: "Cricket Wireless", slug: "topup-crc", carrierId: 45, brandColor: "hsl(82,60%,42%)", logo: cricketLogo },
  { path: "/metropcs.html", name: "Metro PCS", slug: "metropcs", carrierId: 38, brandColor: "hsl(270,60%,32%)", logo: metroLogo },
  // /metro-pcs.html intentionally omitted — redirected to /metropcs.html below to avoid duplicate content.
  { path: "/tmobile-flexi.html", name: "T-Mobile", slug: "tmobile", carrierId: 43, brandColor: "hsl(330,100%,45%)", logo: tmobileLogo },
  { path: "/topup-at.html", name: "AT&T Prepaid", slug: "topup-at", carrierId: 3, brandColor: "hsl(196,100%,44%)", logo: attLogo },
  { path: "/verizon", name: "Verizon Wireless Prepaid", slug: "verizon", carrierId: 14, brandColor: "hsl(0,100%,45%)", logo: verizonLogo },
  { path: "/boost.html", name: "Boost Mobile", slug: "boost", carrierId: 36, brandColor: "hsl(27,100%,50%)", logo: boostLogo },
  // Straight Talk intentionally omitted — backend has no carrier entry, served by static StraightTalk.tsx below.
  { path: "/h2o.html", name: "H2O Wireless", slug: "h2o", carrierId: 6, brandColor: "hsl(195,85%,50%)", logo: h2oLogo },
  { path: "/lyca.html", name: "Lyca Mobile", slug: "lyca", carrierId: 29, brandColor: "hsl(220,50%,22%)", logo: lycaLogo },
  { path: "/net10.html", name: "Net10 Wireless", slug: "net10", carrierId: 7, brandColor: "hsl(195,100%,50%)", logo: net10Logo },
  { path: "/pageplus.html", name: "Page Plus", slug: "pageplus", carrierId: 1, brandColor: "hsl(0,70%,50%)", logo: pageplusLogo },
  { path: "/tracfone.html", name: "TracFone", slug: "tracfone", carrierId: 10, brandColor: "hsl(230,70%,30%)", logo: tracfoneLogo },
  { path: "/ultra-mobile.html", name: "Ultra Mobile", slug: "ultra-mobile", carrierId: 25, brandColor: "hsl(270,50%,40%)", logo: ultraLogo },
  // US Cellular removed from the site (Oct 2026): its old URLs redirect to the home page (see the routes below).
  // AT&T FirstNet intentionally omitted — backend has no carrier entry, served by static ATT.tsx below.
  { path: "/pageplus-addon", name: "Page Plus Addon Balance", slug: "pageplusadd", carrierId: 50, brandColor: "hsl(0,70%,50%)", logo: pageplusLogo },
  // Red Pocket, Xbox and Movistar were removed from the site (Oct 2026); their old URLs redirect home (REMOVED_CARRIER_PATHS).
  { path: "/total-wireless", name: "Total Wireless", slug: "total-wireless", carrierId: 79, brandColor: "hsl(200,70%,40%)" },
  // Verizon Wireless Flexi intentionally omitted — backend has no carrier entry, served by static Verizon.tsx below.
];

// Legacy `-espanol.html` URLs (kept as redirects to /es/* for backward compatibility)
const legacyEspanolRedirects: Array<[string, string]> = [
  ["/s1-espanol.html", "/es/s1.html"],
  ["/topup-crc-espanol.html", "/es/topup-crc.html"],
  ["/metropcs-espanol.html", "/es/metropcs.html"],
  ["/tmobile-flexi-espanol.html", "/es/tmobile-flexi.html"],
  ["/topup-at-espanol.html", "/es/topup-at.html"],
  ["/verizon-espanol", "/es/verizon"],
  ["/boost-espanol.html", "/es/boost.html"],
  ["/straight-talk-espanol.html", "/es/straight-talk.html"],
  ["/h2o-espanol.html", "/es/h2o.html"],
  ["/lyca-espanol.html", "/es/lyca.html"],
  ["/net10-espanol.html", "/es/net10.html"],
  ["/pageplus-espanol.html", "/es/pageplus.html"],
  ["/tracfone-espanol.html", "/es/tracfone.html"],
  ["/ultra-mobile-espanol.html", "/es/ultra-mobile.html"],
  ["/us-cellular-espanol.html", "/es"],
  ["/verizon-wireless-flexi-espanol.html", "/es/verizon-wireless-flexi.html"],
];

// Carriers removed from the site (Parvez via CellPay Lead, Oct 2026): Red Pocket, Xbox, Movistar.
// Every old URL (plus its /es mirror) gets noindex and a client-side redirect to the home page.
const REMOVED_CARRIER_PATHS = [
  "/red-pocket", "/red-pocket/pay", "/red-pocket-mobile", "/red-pocket-mobile.html",
  "/xbox", "/xbox/pay",
  "/movistar", "/movistar.html", "/movistar/pay",
  "/movistar-flexi", "/movistar-flexi.html", "/movistar-flexi/pay",
];

// Carrier URLs typed without ".html" (Oct 2026): no route matched them, so they showed "page not found".
// Each goes to its real page (English -> English, /es -> /es); AliasRedirect keeps the query string and hash.
// /es/guest-* need no entry: EsFallback sends them to /guest-*, which redirects to /guest-*.html.
const NO_HTML_CARRIER_ALIASES: Array<[string, string]> = [
  ["/s1", "/s1.html"],
  ["/topup-crc", "/topup-crc.html"],
  ["/metropcs", "/metropcs.html"],
  ["/tmobile-flexi", "/tmobile-flexi.html"],
  ["/topup-at", "/topup-at.html"],
  ["/boost", "/boost.html"],
  ["/h2o", "/h2o.html"],
  ["/lyca", "/lyca.html"],
  ["/net10", "/net10.html"],
  ["/tracfone", "/tracfone.html"],
  ["/ultra-mobile", "/ultra-mobile.html"],
  ["/straight-talk", "/straight-talk.html"],
  ["/verizon-wireless-flexi", "/verizon-wireless-flexi.html"],
  ["/metro-pcs", "/metropcs.html"],
  ["/tmobile", "/tmobile-flexi.html"],
  ["/bmobile", "/boost.html"],
  ["/guest-metro-pcs", "/guest-metro-pcs.html"],
  ["/guest-metropcs", "/guest-metropcs.html"],
  ["/guest-boost", "/guest-boost.html"],
  ["/guest-h2o", "/guest-h2o.html"],
  ["/guest-pageplus", "/guest-pageplus.html"],
  ["/guest-simple-mobile", "/guest-simple-mobile.html"],
  ["/guest-net10", "/guest-net10.html"],
  ["/guest-lyca", "/guest-lyca.html"],
  ["/es/s1", "/es/s1.html"],
  ["/es/topup-crc", "/es/topup-crc.html"],
  ["/es/metropcs", "/es/metropcs.html"],
  ["/es/tmobile-flexi", "/es/tmobile-flexi.html"],
  ["/es/topup-at", "/es/topup-at.html"],
  ["/es/boost", "/es/boost.html"],
  ["/es/h2o", "/es/h2o.html"],
  ["/es/lyca", "/es/lyca.html"],
  ["/es/net10", "/es/net10.html"],
  ["/es/tracfone", "/es/tracfone.html"],
  ["/es/ultra-mobile", "/es/ultra-mobile.html"],
  ["/es/straight-talk", "/es/straight-talk.html"],
  ["/es/verizon-wireless-flexi", "/es/verizon-wireless-flexi.html"],
  ["/es/metro-pcs", "/es/metropcs.html"],
  ["/es/tmobile", "/es/tmobile-flexi.html"],
  ["/es/bmobile", "/es/boost.html"],
  ["/es/pageplus", "/es/pageplus.html"],
];

const TrackingCapture = () => {
  const location = useLocation();
  useEffect(() => {
    captureTrackingIdsFromUrl();
  }, [location.search]);
  usePresence();
  return null;
};

/** Spanish fallback: if no /es/* route matched, strip the `/es` prefix and redirect to English. */
const EsFallback = () => {
  const { pathname, search, hash } = useLocation();
  const stripped = pathname.replace(/^\/es(?=\/|$)/, "") || "/";
  return <Navigate to={`${stripped}${search}${hash}`} replace />;
};

/** Alias redirect that keeps the query string and hash (gclid/gbraid/wbraid/utm from Google Ads) on the target page. */
const AliasRedirect = ({ to }: { to: string }) => {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
};

/** Removed carrier URL: mark noindex, then hard-redirect home (query string kept, fresh page head). */
const RemovedCarrierRedirect = ({ to }: { to: string }) => {
  useEffect(() => {
    let tag = document.querySelector('meta[name="robots"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "robots");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", "noindex,follow");
    window.location.replace(`${to}${window.location.search}${window.location.hash}`);
  }, [to]);
  return null;
};

/** Friendly slug → canonical carrier slug mapping for legacy/marketing URLs. */
const SLUG_ALIASES: Record<string, string> = {
  cricket: "topup-crc",
  att: "topup-at",
  "at-t": "topup-at",
  "simple-mobile": "s1",
  simple: "s1",
  metro: "metropcs",
  "metro-pcs": "metropcs",
  tmobile: "tmobile-flexi",
  "t-mobile": "tmobile-flexi",
};

/** Catch-all:
 *  1) Legacy /{amount}-{slug}-prepaid-refill.html → LegacyAmountRedirect
 *  2) Generic /{slug}-espanol(.html)? or /{slug}-espanol/  → strip "-espanol" and redirect to /es/{slug}(.html)
 *  3) Otherwise render NotFound. */
const CatchAll = () => {
  const { pathname, search, hash } = useLocation();
  if (/^\/\d+-.+-prepaid-refill\.html$/i.test(pathname)) {
    return <LegacyAmountRedirect />;
  }
  // Match /<slug>-espanol or /<slug>-espanol.html with optional trailing slash
  const esp = pathname.match(/^\/(.+?)-espanol(\.html)?\/?$/i);
  if (esp) {
    const rawSlug = esp[1].toLowerCase();
    const slug = SLUG_ALIASES[rawSlug] || rawSlug;
    const ext = esp[2] || "";
    return <Navigate to={`/es/${slug}${ext}${search}${hash}`} replace />;
  }
  return <NotFound />;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TrackingCapture />
      <CheckoutPrefetch />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/es" element={<Home />} />


        {/* Carrier pages — English + /es/ mirrors, plus /{slug}/pay aliases */}
        {carrierRoutes.flatMap((c) => {
          // Derive a clean slug from the canonical path: strip leading "/" and trailing ".html"
          const cleanSlug = c.path.replace(/^\//, "").replace(/\.html$/, "");
          const payPath = `/${cleanSlug}/pay`;
          const renderEn = (
            <DynamicCarrier
              carrierName={c.name}
              carrierSlug={c.slug}
              carrierId={c.carrierId}
              brandColor={c.brandColor}
              logo={c.logo}
            />
          );
          const renderEs = (
            <DynamicCarrier
              lang="es"
              carrierName={c.name}
              carrierSlug={c.slug}
              carrierId={c.carrierId}
              brandColor={c.brandColor}
              logo={c.logo}
            />
          );
          return [
            <Route key={`en-${c.path}`} path={c.path} element={renderEn} />,
            <Route key={`es-${c.path}`} path={`/es${c.path}`} element={renderEs} />,
            // /{slug}/pay aliases → redirect to canonical carrier page (avoid duplicate-content SEO flags)
            <Route key={`en-pay-${c.path}`} path={payPath} element={<AliasRedirect to={c.path} />} />,
            <Route key={`es-pay-${c.path}`} path={`/es${payPath}`} element={<AliasRedirect to={`/es${c.path}`} />} />,
          ];
        })}

        {/* Straight Talk — static hardcoded page (no backend carrier entry). */}
        <Route path="/straight-talk.html" element={<StraightTalk />} />
        <Route path="/es/straight-talk.html" element={<StraightTalk />} />
        <Route path="/straight-talk/pay" element={<AliasRedirect to="/straight-talk.html" />} />
        <Route path="/es/straight-talk/pay" element={<AliasRedirect to="/es/straight-talk.html" />} />

        {/* US Cellular — removed from the site (Oct 2026): every old URL goes to the home page (query string and hash kept). */}
        <Route path="/us-cellular" element={<AliasRedirect to="/" />} />
        <Route path="/us-cellular.html" element={<AliasRedirect to="/" />} />
        <Route path="/us-cellular/pay" element={<AliasRedirect to="/" />} />
        <Route path="/es/us-cellular" element={<AliasRedirect to="/es" />} />
        <Route path="/es/us-cellular.html" element={<AliasRedirect to="/es" />} />
        <Route path="/es/us-cellular/pay" element={<AliasRedirect to="/es" />} />

        {/* Verizon Wireless Flexi — reuses static Verizon.tsx (no backend carrier entry). */}
        <Route path="/verizon-wireless-flexi.html" element={<Verizon />} />
        <Route path="/es/verizon-wireless-flexi.html" element={<Verizon />} />
        <Route path="/verizon-wireless-flexi/pay" element={<AliasRedirect to="/verizon-wireless-flexi.html" />} />
        <Route path="/es/verizon-wireless-flexi/pay" element={<AliasRedirect to="/es/verizon-wireless-flexi.html" />} />

        {/* Legacy carrier URL aliases → canonical carrier pages */}
        <Route path="/verizon.html" element={<AliasRedirect to="/verizon" />} />
        <Route path="/es/verizon.html" element={<AliasRedirect to="/es/verizon" />} />
        <Route path="/tmobile.html" element={<AliasRedirect to="/tmobile-flexi.html" />} />
        <Route path="/es/tmobile.html" element={<AliasRedirect to="/es/tmobile-flexi.html" />} />
        <Route path="/bmobile.html" element={<AliasRedirect to="/boost.html" />} />
        <Route path="/es/bmobile.html" element={<AliasRedirect to="/es/boost.html" />} />
        {/* Total Wireless .html — render the page directly (no redirect) so gclid/utm params survive for Google Ads. */}
        <Route
          path="/total-wireless.html"
          element={
            <DynamicCarrier
              carrierName="Total Wireless"
              carrierSlug="total-wireless"
              carrierId={79}
              brandColor="hsl(200,70%,40%)"
            />
          }
        />
        <Route
          path="/es/total-wireless.html"
          element={
            <DynamicCarrier
              lang="es"
              carrierName="Total Wireless"
              carrierSlug="total-wireless"
              carrierId={79}
              brandColor="hsl(200,70%,40%)"
            />
          }
        />
        <Route path="/users/login" element={<AliasRedirect to="/login" />} />
        <Route path="/users/login/" element={<AliasRedirect to="/login" />} />
        <Route path="/es/users/login" element={<AliasRedirect to="/es/login" />} />


        {/* AT&T FirstNet — reuses static ATT.tsx (no backend carrier entry). */}
        <Route path="/att-firstnet" element={<ATT />} />
        <Route path="/es/att-firstnet" element={<ATT />} />
        <Route path="/att-firstnet/pay" element={<AliasRedirect to="/att-firstnet" />} />
        <Route path="/es/att-firstnet/pay" element={<AliasRedirect to="/es/att-firstnet" />} />

        {/* Legacy Google Ads landing URLs — keep working for crawlers/bots */}
        <Route path="/amount.php" element={<AmountRedirect />} />
        {/* H2O Wireless legacy/alt paths (handle both '+' and '-' separators) */}
        {(["/h2o-wireless", "/h2o+wireless", "/h2o-wireless/bill+payment", "/h2o-wireless/bill-payment", "/h2o+wireless/bill+payment"]).map((p) => (
          <Route
            key={p}
            path={p}
            element={
              <DynamicCarrier
                carrierName="H2O Wireless"
                carrierSlug="h2o"
                carrierId={6}
                brandColor="hsl(195,85%,50%)"
                logo={h2oLogo}
              />
            }
          />
        ))}
        {/* PagePlus path-style alias */}
        <Route path="/pageplus" element={<AliasRedirect to="/pageplus.html" />} />
        {/* Metro PCS legacy alias → canonical /metropcs.html */}
        <Route path="/metro-pcs.html" element={<AliasRedirect to="/metropcs.html" />} />
        <Route path="/es/metro-pcs.html" element={<AliasRedirect to="/es/metropcs.html" />} />
        {/* Metro PCS guest/one-time payment landing — renders full Metro PCS content (no redirect) so Google Ads sees real content. */}
        <Route
          path="/guest-metro-pcs.html"
          element={
            <DynamicCarrier
              carrierName="Metro PCS"
              carrierSlug="metropcs"
              carrierId={38}
              brandColor="hsl(270,60%,32%)"
              logo={metroLogo}
              seoTitleOverride="Metro PCS Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a Metro by T-Mobile (Metro PCS) guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="Metro PCS Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your Metro by T-Mobile (Metro PCS) bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        {/* Metro PCS guest landing, alternate URL used by Google Ads (was a 404). */}
        <Route
          path="/guest-metropcs.html"
          element={
            <DynamicCarrier
              carrierName="Metro PCS"
              carrierSlug="metropcs"
              carrierId={38}
              brandColor="hsl(270,60%,32%)"
              logo={metroLogo}
              seoTitleOverride="Metro PCS Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a Metro by T-Mobile (Metro PCS) guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="Metro PCS Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your Metro by T-Mobile (Metro PCS) bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        {/* Boost Mobile guest landing used by Google Ads (was a 404). */}
        <Route
          path="/guest-boost.html"
          element={
            <DynamicCarrier
              carrierName="Boost Mobile"
              carrierSlug="boost"
              carrierId={36}
              brandColor="hsl(27,100%,50%)"
              logo={boostLogo}
              seoTitleOverride="Boost Mobile Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a Boost Mobile guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="Boost Mobile Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your Boost Mobile bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        {/* Guest/one-time payment landing pages — render full DynamicCarrier (no redirect) so Google Ads sees real content. */}
        <Route
          path="/guest-h2o.html"
          element={
            <DynamicCarrier
              carrierName="H2O Wireless"
              carrierSlug="h2o"
              carrierId={6}
              brandColor="hsl(195,85%,50%)"
              logo={h2oLogo}
              seoTitleOverride="H2O Wireless Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make an H2O Wireless guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="H2O Wireless Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your H2O Wireless bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        <Route
          path="/guest-pageplus.html"
          element={
            <DynamicCarrier
              carrierName="Page Plus"
              carrierSlug="pageplus"
              carrierId={1}
              brandColor="hsl(0,70%,50%)"
              logo={pageplusLogo}
              seoTitleOverride="Page Plus Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a Page Plus Cellular guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="Page Plus Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your Page Plus Cellular bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        <Route
          path="/guest-simple-mobile.html"
          element={
            <DynamicCarrier
              carrierName="Simple Mobile"
              carrierSlug="s1"
              carrierId={15}
              brandColor="hsl(101,67%,44%)"
              logo={simpleMobileLogo}
              seoTitleOverride="Simple Mobile Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a Simple Mobile guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="Simple Mobile Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your Simple Mobile bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        <Route
          path="/guest-net10.html"
          element={
            <DynamicCarrier
              carrierName="Net10 Wireless"
              carrierSlug="net10"
              carrierId={7}
              brandColor="hsl(195,100%,50%)"
              logo={net10Logo}
              seoTitleOverride="NET10 Wireless Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a NET10 Wireless guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="NET10 Wireless Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your NET10 Wireless bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />
        <Route
          path="/guest-lyca.html"
          element={
            <DynamicCarrier
              carrierName="Lyca Mobile"
              carrierSlug="lyca"
              carrierId={29}
              brandColor="hsl(220,50%,22%)"
              logo={lycaLogo}
              seoTitleOverride="Lycamobile Guest Payment — One-Time Refill | CellPay"
              seoDescriptionOverride="Make a Lycamobile guest payment online. No login needed — enter your phone number, choose your 30-day plan, and pay securely."
              seoH1Override="Lycamobile Guest Payment — One-Time Refill, No login needed"
              seoIntroOverride="Pay your Lycamobile bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment."
            />
          }
        />

        {/* GO-1 / GO-1b / GO-2: dedicated ad landers. noindex, ads only, legal footer only. Clean + .html URLs. */}
        <Route
          path="/go/boost"
          element={
            <GoLander
              carrierName="Boost Mobile"
              carrierSlug="boost"
              carrierId={36}
              brandColor="hsl(27,100%,50%)"
              logo={boostLogo}
              h1="Pay Your Boost Bill Without Signing In"
              title="Pay Your Boost Bill Without Signing In | CellPay"
              description="Pay your Boost Mobile bill without signing in. Enter the phone number, pick the amount, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/boost.html"
          element={
            <GoLander
              carrierName="Boost Mobile"
              carrierSlug="boost"
              carrierId={36}
              brandColor="hsl(27,100%,50%)"
              logo={boostLogo}
              h1="Pay Your Boost Bill Without Signing In"
              title="Pay Your Boost Bill Without Signing In | CellPay"
              description="Pay your Boost Mobile bill without signing in. Enter the phone number, pick the amount, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/metro"
          element={
            <GoLander
              carrierName="Metro PCS"
              carrierSlug="metropcs"
              carrierId={38}
              brandColor="hsl(270,60%,32%)"
              logo={metroLogo}
              h1="Pay Your Metro Bill as a Guest"
              title="Pay Your Metro Bill as a Guest | CellPay"
              description="Pay your Metro by T-Mobile (Metro PCS) bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/metro.html"
          element={
            <GoLander
              carrierName="Metro PCS"
              carrierSlug="metropcs"
              carrierId={38}
              brandColor="hsl(270,60%,32%)"
              logo={metroLogo}
              h1="Pay Your Metro Bill as a Guest"
              title="Pay Your Metro Bill as a Guest | CellPay"
              description="Pay your Metro by T-Mobile (Metro PCS) bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/simple-mobile"
          element={
            <GoLander
              carrierName="Simple Mobile"
              carrierSlug="s1"
              carrierId={15}
              brandColor="hsl(101,67%,44%)"
              logo={simpleMobileLogo}
              h1="Pay Your Simple Mobile Bill Online"
              title="Pay Your Simple Mobile Bill Online | CellPay"
              description="Pay your Simple Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/simple-mobile.html"
          element={
            <GoLander
              carrierName="Simple Mobile"
              carrierSlug="s1"
              carrierId={15}
              brandColor="hsl(101,67%,44%)"
              logo={simpleMobileLogo}
              h1="Pay Your Simple Mobile Bill Online"
              title="Pay Your Simple Mobile Bill Online | CellPay"
              description="Pay your Simple Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/cricket"
          element={
            <GoLander
              carrierName="Cricket Wireless"
              carrierSlug="topup-crc"
              carrierId={45}
              brandColor="hsl(82,60%,42%)"
              logo={cricketLogo}
              h1="Pay Your Cricket Bill as a Guest"
              title="Pay Your Cricket Bill as a Guest | CellPay"
              description="Pay your Cricket Wireless bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/cricket.html"
          element={
            <GoLander
              carrierName="Cricket Wireless"
              carrierSlug="topup-crc"
              carrierId={45}
              brandColor="hsl(82,60%,42%)"
              logo={cricketLogo}
              h1="Pay Your Cricket Bill as a Guest"
              title="Pay Your Cricket Bill as a Guest | CellPay"
              description="Pay your Cricket Wireless bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/att"
          element={
            <GoLander
              carrierName="AT&T Prepaid"
              carrierSlug="topup-at"
              carrierId={3}
              brandColor="hsl(196,100%,44%)"
              logo={attLogo}
              h1="Pay Your AT&T Prepaid Bill Online"
              title="Pay Your AT&T Prepaid Bill Online | CellPay"
              description="Pay or refill your AT&T Prepaid bill online. Guest OK — enter the phone number, pick the amount, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/att.html"
          element={
            <GoLander
              carrierName="AT&T Prepaid"
              carrierSlug="topup-at"
              carrierId={3}
              brandColor="hsl(196,100%,44%)"
              logo={attLogo}
              h1="Pay Your AT&T Prepaid Bill Online"
              title="Pay Your AT&T Prepaid Bill Online | CellPay"
              description="Pay or refill your AT&T Prepaid bill online. Guest OK — enter the phone number, pick the amount, pay. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/ultra"
          element={
            <GoLander
              carrierName="Ultra Mobile"
              carrierSlug="ultra-mobile"
              carrierId={25}
              brandColor="hsl(270,50%,40%)"
              logo={ultraLogo}
              h1="Pay Your Ultra Mobile Bill Online"
              title="Pay Your Ultra Mobile Bill Online | CellPay"
              description="Pay your Ultra Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/ultra.html"
          element={
            <GoLander
              carrierName="Ultra Mobile"
              carrierSlug="ultra-mobile"
              carrierId={25}
              brandColor="hsl(270,50%,40%)"
              logo={ultraLogo}
              h1="Pay Your Ultra Mobile Bill Online"
              title="Pay Your Ultra Mobile Bill Online | CellPay"
              description="Pay your Ultra Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay."
            />
          }
        />

        {/* GO-1b / GO-2: ES ad landers. Fully Spanish UI. noindex. No Total Wireless. */}
        <Route
          path="/es/go/metro"
          element={
            <GoLander
              lang="es"
              carrierName="Metro PCS"
              carrierSlug="metropcs"
              carrierId={38}
              brandColor="hsl(270,60%,32%)"
              logo={metroLogo}
              h1="Pague su factura de Metro como invitado"
              title="Pague su factura de Metro como invitado | CellPay"
              description="Pague su Metro by T-Mobile (Metro PCS) como invitado. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />
        <Route
          path="/es/go/metro.html"
          element={
            <GoLander
              lang="es"
              carrierName="Metro PCS"
              carrierSlug="metropcs"
              carrierId={38}
              brandColor="hsl(270,60%,32%)"
              logo={metroLogo}
              h1="Pague su factura de Metro como invitado"
              title="Pague su factura de Metro como invitado | CellPay"
              description="Pague su Metro by T-Mobile (Metro PCS) como invitado. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />
        <Route
          path="/es/go/boost"
          element={
            <GoLander
              lang="es"
              carrierName="Boost Mobile"
              carrierSlug="boost"
              carrierId={36}
              brandColor="hsl(27,100%,50%)"
              logo={boostLogo}
              h1="Pague Boost sin iniciar sesión"
              title="Pague Boost sin iniciar sesión | CellPay"
              description="Pague su Boost Mobile sin iniciar sesión. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />
        <Route
          path="/es/go/boost.html"
          element={
            <GoLander
              lang="es"
              carrierName="Boost Mobile"
              carrierSlug="boost"
              carrierId={36}
              brandColor="hsl(27,100%,50%)"
              logo={boostLogo}
              h1="Pague Boost sin iniciar sesión"
              title="Pague Boost sin iniciar sesión | CellPay"
              description="Pague su Boost Mobile sin iniciar sesión. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />
        <Route
          path="/es/go/cricket"
          element={
            <GoLander
              lang="es"
              carrierName="Cricket Wireless"
              carrierSlug="topup-crc"
              carrierId={45}
              brandColor="hsl(82,60%,42%)"
              logo={cricketLogo}
              h1="Pague Cricket en línea"
              title="Pague Cricket en línea | CellPay"
              description="Pague su Cricket Wireless en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />
        <Route
          path="/es/go/cricket.html"
          element={
            <GoLander
              lang="es"
              carrierName="Cricket Wireless"
              carrierSlug="topup-crc"
              carrierId={45}
              brandColor="hsl(82,60%,42%)"
              logo={cricketLogo}
              h1="Pague Cricket en línea"
              title="Pague Cricket en línea | CellPay"
              description="Pague su Cricket Wireless en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />

        {/* GO-ES-ST Batch A: EN + ES Straight Talk ad landers (keep legacy /straight-talk.html). */}
        <Route
          path="/go/straight-talk"
          element={
            <GoLander
              carrierName="Straight Talk"
              carrierSlug="straight-talk"
              carrierId={333370}
              brandColor="hsl(72,74%,44%)"
              logo={straightTalkLogo}
              h1="Pay Your Straight Talk Bill Online"
              title="Pay Your Straight Talk Bill Online | CellPay"
              description="Pay your Straight Talk bill online. No login. Pay for anyone. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/go/straight-talk.html"
          element={
            <GoLander
              carrierName="Straight Talk"
              carrierSlug="straight-talk"
              carrierId={333370}
              brandColor="hsl(72,74%,44%)"
              logo={straightTalkLogo}
              h1="Pay Your Straight Talk Bill Online"
              title="Pay Your Straight Talk Bill Online | CellPay"
              description="Pay your Straight Talk bill online. No login. Pay for anyone. Low service fee shown before you pay."
            />
          }
        />
        <Route
          path="/es/go/straight-talk"
          element={
            <GoLander
              lang="es"
              carrierName="Straight Talk"
              carrierSlug="straight-talk"
              carrierId={333370}
              brandColor="hsl(72,74%,44%)"
              logo={straightTalkLogo}
              h1="Pague Straight Talk en línea"
              title="Pague Straight Talk en línea | CellPay"
              description="Pague su Straight Talk en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />
        <Route
          path="/es/go/straight-talk.html"
          element={
            <GoLander
              lang="es"
              carrierName="Straight Talk"
              carrierSlug="straight-talk"
              carrierId={333370}
              brandColor="hsl(72,74%,44%)"
              logo={straightTalkLogo}
              h1="Pague Straight Talk en línea"
              title="Pague Straight Talk en línea | CellPay"
              description="Pague su Straight Talk en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar."
            />
          }
        />

        {/* Removed carriers (Red Pocket, Xbox, Movistar) — noindex + redirect to the home page. */}
        {REMOVED_CARRIER_PATHS.flatMap((p) => [
          <Route key={`removed-${p}`} path={p} element={<RemovedCarrierRedirect to="/" />} />,
          <Route key={`removed-es-${p}`} path={`/es${p}`} element={<RemovedCarrierRedirect to="/es" />} />,
        ])}
        <Route path="/movistar-espanol.html" element={<RemovedCarrierRedirect to="/es" />} />
        <Route path="/movistar-flexi-espanol.html" element={<RemovedCarrierRedirect to="/es" />} />
        {/* Carrier URLs typed without ".html" → the real page (query string and hash kept). */}
        {NO_HTML_CARRIER_ALIASES.map(([from, to]) => (
          <Route key={`nohtml-${from}`} path={from} element={<AliasRedirect to={to} />} />
        ))}


        {/* Legacy `-espanol` URLs → redirect to canonical /es/* */}
        {legacyEspanolRedirects.map(([from, to]) => (
          <Route key={from} path={from} element={<AliasRedirect to={to} />} />
        ))}

        {/* Checkout / confirmation flow — English + /es/ mirrors. Same components,
            language is detected from URL pathname inside each page. */}
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/es/checkout" element={<Checkout />} />
        <Route path="/payment-callback" element={<PaymentCallback />} />
        <Route path="/es/payment-callback" element={<PaymentCallback />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/es/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/checkout/cashapp-return" element={<CashAppReturn />} />
        <Route path="/es/checkout/cashapp-return" element={<CashAppReturn />} />

        {/* Account & content pages */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot" element={<AliasRedirect to="/forgot-password" />} />
        <Route path="/es/forgot-password" element={<ForgotPassword />} />
        <Route path="/es/forgot" element={<AliasRedirect to="/es/forgot-password" />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/about-us.html" element={<AliasRedirect to="/about-us" />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/contact-us.html" element={<AliasRedirect to="/contact-us" />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/faq.html" element={<AliasRedirect to="/faq" />} />
        <Route path="/how-to-use" element={<HowToUse />} />
        <Route path="/how-to-use.html" element={<AliasRedirect to="/how-to-use" />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/privacy-policy.html" element={<AliasRedirect to="/privacy-policy" />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/terms-and-conditions.html" element={<AliasRedirect to="/terms-and-conditions" />} />
        <Route path="/returns-policy" element={<ReturnsPolicy />} />
        <Route path="/returns-policy.html" element={<AliasRedirect to="/returns-policy" />} />
        <Route path="/returns-and-refunds-policy" element={<AliasRedirect to="/returns-policy" />} />
        <Route path="/returns-and-refunds-policy.html" element={<AliasRedirect to="/returns-policy" />} />
        <Route path="/es/returns-and-refunds-policy.html" element={<AliasRedirect to="/returns-policy" />} />
        <Route path="/digital-millennium-copyright-act-dmca-compliance.html" element={<DMCA />} />
        <Route path="/es/digital-millennium-copyright-act-dmca-compliance.html" element={<DMCA />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />

        {/* Customer login/register (matches legacy cellpay.us URLs) */}
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/register" element={<Login mode="register" />} />
        <Route path="/customer/account/login" element={<Login mode="login" />} />
        <Route path="/customer/account/login/" element={<Login mode="login" />} />
        <Route path="/customer/account/create" element={<Login mode="register" />} />
        <Route path="/customer/account/create/" element={<Login mode="register" />} />
        <Route path="/es/login" element={<Login mode="login" />} />
        <Route path="/es/customer/account/login" element={<Login mode="login" />} />

        {/* Fallback: any unmatched /es/* path → strip /es and redirect to English. */}
        <Route path="/es/*" element={<EsFallback />} />
        <Route path="*" element={<CatchAll />} />
      </Routes>
      </Suspense>
      <Toaster />
      {HELP_CHAT_ENABLED && (
        <HelpChatBoundary>
          <Suspense fallback={null}>
            <HelpChat />
          </Suspense>
        </HelpChatBoundary>
      )}
    </BrowserRouter>
  </AuthProvider>
);

export default App;
