import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/**
 * Lovable's static host returns 404 for any URL ending in `.html` (it treats it
 * as a missing asset instead of doing the SPA fallback). To keep our carrier
 * URLs like `/tmobile-flexi.html`, `/boost.html`, `/es/topup-crc.html`, etc.
 * working for crawlers (Google AdsBot in particular), emit a copy of the built
 * `index.html` at each of those paths after the bundle is written.
 *
 * Keep this list in sync with carrierRoutes / legacyEspanolRedirects in
 * `src/App.tsx`. Adding extra entries is harmless.
 */
const HTML_ROUTES = [
  "s1.html",
  "topup-crc.html",
  "metropcs.html",
  "metro-pcs.html",
  "guest-metro-pcs.html",
  "guest-h2o.html",
  "guest-pageplus.html",
  "guest-simple-mobile.html",
  "guest-net10.html",
  "guest-lyca.html",
  "guest-metropcs.html",
  "guest-boost.html",
  // GO-1 dedicated ad landers (EN): .html shells + folder shells for clean /go/* URLs
  "go/boost.html",
  "go/metro.html",
  "go/simple-mobile.html",
  "go/boost/index.html",
  "go/metro/index.html",
  "go/simple-mobile/index.html",
  // GO-1b: ES /es/go/* + Ultra EN shells
  "es/go/metro.html",
  "es/go/boost.html",
  "es/go/cricket.html",
  "es/go/metro/index.html",
  "es/go/boost/index.html",
  "es/go/cricket/index.html",
  "go/ultra.html",
  "go/ultra/index.html",
  // GO-2: Cricket + AT&T EN shells
  "go/cricket.html",
  "go/att.html",
  "go/cricket/index.html",
  "go/att/index.html",
  // GO-ES-ST Batch A: Straight Talk EN + ES shells
  "go/straight-talk.html",
  "go/straight-talk/index.html",
  "es/go/straight-talk.html",
  "es/go/straight-talk/index.html",
  // GO-ES-SM: ES Simple Mobile shells
  "es/go/simple-mobile.html",
  "es/go/simple-mobile/index.html",
  // GO-ES-ULTRA: ES Ultra Mobile shells
  "es/go/ultra.html",
  "es/go/ultra/index.html",
  // GO-ES-LYCA: ES Lyca Mobile shells
  "es/go/lyca.html",
  "es/go/lyca/index.html",
  // GO-ES-H2O: ES H2O Wireless shells
  "es/go/h2o.html",
  "es/go/h2o/index.html",
  // GO-ES-NET10: ES Net10 Wireless shells
  "es/go/net10.html",
  "es/go/net10/index.html",
  // GO-ES-ATT: ES AT&T Prepaid shells
  "es/go/att.html",
  "es/go/att/index.html",
  // GO-EN-MISSING: EN Net10 / H2O / Lyca / T-Mobile / Verizon shells
  "go/net10.html",
  "go/net10/index.html",
  "go/h2o.html",
  "go/h2o/index.html",
  "go/lyca.html",
  "go/lyca/index.html",
  "go/tmobile.html",
  "go/tmobile/index.html",
  "go/verizon.html",
  "go/verizon/index.html",
  "tmobile-flexi.html",
  "topup-at.html",
  "boost.html",
  "straight-talk.html",
  "h2o.html",
  "lyca.html",
  "net10.html",
  "pageplus.html",
  "tracfone.html",
  "ultra-mobile.html",
  "es/ultra-mobile.html",
  "verizon-wireless-flexi.html",
  "total-wireless.html",
  // Spanish mirrors
  "es/s1.html",
  "es/topup-crc.html",
  "es/metropcs.html",
  "es/metro-pcs.html",
  "es/tmobile-flexi.html",
  "es/topup-at.html",
  "es/boost.html",
  "es/straight-talk.html",
  "es/h2o.html",
  "es/lyca.html",
  "es/net10.html",
  "es/pageplus.html",
  "es/tracfone.html",
  "es/verizon-wireless-flexi.html",
  "es/total-wireless.html",
  // Legacy `-espanol.html` URLs (App.tsx redirects them to /es/* client-side)
  "s1-espanol.html",
  "topup-crc-espanol.html",
  "metropcs-espanol.html",
  "tmobile-flexi-espanol.html",
  "topup-at-espanol.html",
  "boost-espanol.html",
  "straight-talk-espanol.html",
  "h2o-espanol.html",
  "lyca-espanol.html",
  "net10-espanol.html",
  "pageplus-espanol.html",
  "tracfone-espanol.html",
  "ultra-mobile-espanol.html",
  "us-cellular-espanol.html",
  "verizon-wireless-flexi-espanol.html",
  // H2O alt paths used by older Google Ads campaigns
  "h2o-wireless/index.html",
  "h2o-wireless/bill-payment/index.html",
  // PagePlus path-style alias
  "pageplus/index.html",
  // Carriers removed from the site (Red Pocket, Movistar, Xbox, US Cellular; Oct 2026): noindex
  // shells only. App.tsx redirects these URLs to the home page.
  "red-pocket-mobile.html",
  "es/red-pocket-mobile.html",
  "movistar.html",
  "es/movistar.html",
  "movistar-flexi.html",
  "es/movistar-flexi.html",
  "us-cellular.html",
  "es/us-cellular.html",
  // Removed-carrier URLs without ".html": folder shells so the host serves them noindex (not the indexable SPA fallback).
  "xbox/index.html",
  "es/xbox/index.html",
  "red-pocket/index.html",
  "es/red-pocket/index.html",
  "red-pocket-mobile/index.html",
  "es/red-pocket-mobile/index.html",
  "movistar/index.html",
  "es/movistar/index.html",
  "movistar-flexi/index.html",
  "es/movistar-flexi/index.html",
  // Old alias .html URLs that App.tsx redirects (query + hash kept): static noindex shells so the host serves the app, not a 404.
  "verizon.html",
  "es/verizon.html",
  "tmobile.html",
  "es/tmobile.html",
  "bmobile.html",
  "es/bmobile.html",
  "about-us.html",
  "contact-us.html",
  "faq.html",
  "how-to-use.html",
  "privacy-policy.html",
  "terms-and-conditions.html",
  "returns-policy.html",
  "returns-and-refunds-policy.html",
  "es/returns-and-refunds-policy.html",
  "es/privacy-policy.html",
  "es/terms-and-conditions.html",
  "es/returns-policy.html",
  // SEO-SHELL-1: indexable clean sitemap paths (folder/index.html) so raw HTML title/description
  // match the page (not the home shell). Home "/" stays the root index.html. Keep no-host rule.
  "es/index.html",
  "verizon/index.html",
  "es/verizon/index.html",
  "total-wireless/index.html",
  "es/total-wireless/index.html",
  "att-firstnet/index.html",
  "es/att-firstnet/index.html",
  "about-us/index.html",
  "contact-us/index.html",
  "faq/index.html",
  "how-to-use/index.html",
  "privacy-policy/index.html",
  "terms-and-conditions/index.html",
  "returns-policy/index.html",
  // DMCA page (real page, indexable): its only URL ends in .html, so it needs a static shell too.
  "digital-millennium-copyright-act-dmca-compliance.html",
  "es/digital-millennium-copyright-act-dmca-compliance.html",
  // Admin SPA routes — emit as folder/index.html so self-hosted servers
  // (which don't do SPA fallback) serve the React app on direct refresh.
  "admin/index.html",
  "admin/login/index.html",
  "admin/visitors/index.html",
  "admin/breakdowns/index.html",
  "admin/customers/index.html",
  "admin/transactions/index.html",
];

// Legacy per-amount product URLs from the old PHP site, e.g. /40-topup-at-prepaid-refill.html.
// These are still indexed by Google Merchant Center. Emit static shells so the host returns
// 200 (not 404), then App.tsx CatchAll redirects them client-side to the category page.
const LEGACY_AMOUNT_SLUGS = [
  "topup-at", "metropcs", "boost", "tmobile-flexi", "topup-crc",
  "s1", "verizon-wireless-flexi", "h2o", "lyca", "net10",
  "pageplus", "tracfone", "ultra-mobile", "us-cellular", "straight-talk",
  "red-pocket-mobile", "total-wireless",
];
const LEGACY_AMOUNT_VALUES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
  55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
  110, 115, 120, 125, 150, 175, 200, 225, 250, 300,
];
for (const slug of LEGACY_AMOUNT_SLUGS) {
  for (const amt of LEGACY_AMOUNT_VALUES) {
    HTML_ROUTES.push(`${amt}-${slug}-prepaid-refill.html`);
  }
}

const htmlAliasPlugin = (): Plugin => ({
  name: "lovable-html-route-aliases",
  apply: "build",
  closeBundle() {
    const outDir = path.resolve(__dirname, "dist");
    const indexPath = path.join(outDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error(
        "[html-route-aliases] dist/index.html is missing — cannot emit alias HTML files.",
      );
    }
    const html = fs.readFileSync(indexPath, "utf-8");
    // Guest landing pages: H1 + intro paragraph injected into the static
    // shell body so crawlers (Google AdsBot, etc.) see real above-the-fold
    // content in raw HTML, not just after React hydration.
    const GUEST_CONTENT: Record<string, { h1: string; intro: string }> = {
      "guest-metro-pcs.html": {
        h1: "Metro PCS Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your Metro by T-Mobile (Metro PCS) bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-h2o.html": {
        h1: "H2O Wireless Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your H2O Wireless bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-pageplus.html": {
        h1: "Page Plus Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your Page Plus Cellular bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-simple-mobile.html": {
        h1: "Simple Mobile Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your Simple Mobile bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-net10.html": {
        h1: "NET10 Wireless Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your NET10 Wireless bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-lyca.html": {
        h1: "Lycamobile Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your Lycamobile bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-metropcs.html": {
        h1: "Metro PCS Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your Metro by T-Mobile (Metro PCS) bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
      "guest-boost.html": {
        h1: "Boost Mobile Guest Payment — One-Time Refill, No login needed",
        intro: "Pay your Boost Mobile bill as a guest online. Enter your phone number, pick a 30-day plan, and check out securely. No login needed. Your refill is sent to your line after payment.",
      },
    };

    // GO-1 ad landers: H1 + intro in static shell for AdsBot; pages are noindex (see GO_SHELLS).
    const GO_CONTENT: Record<string, { h1: string; intro: string }> = {
      "go/boost.html": {
        h1: "Pay Your Boost Bill Without Signing In",
        intro: "No login. Pay for anyone. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/metro.html": {
        h1: "Pay Your Metro Bill as a Guest",
        intro: "Pay Metro by T-Mobile as a guest. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/simple-mobile.html": {
        h1: "Pay Your Simple Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/boost/index.html": {
        h1: "Pay Your Boost Bill Without Signing In",
        intro: "No login. Pay for anyone. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/metro/index.html": {
        h1: "Pay Your Metro Bill as a Guest",
        intro: "Pay Metro by T-Mobile as a guest. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/simple-mobile/index.html": {
        h1: "Pay Your Simple Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "es/go/metro.html": {
        h1: "Pague su factura de Metro como invitado",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/boost.html": {
        h1: "Pague Boost sin iniciar sesión",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/cricket.html": {
        h1: "Pague Cricket en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/metro/index.html": {
        h1: "Pague su factura de Metro como invitado",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/boost/index.html": {
        h1: "Pague Boost sin iniciar sesión",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/cricket/index.html": {
        h1: "Pague Cricket en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "go/ultra.html": {
        h1: "Pay Your Ultra Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/ultra/index.html": {
        h1: "Pay Your Ultra Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/cricket.html": {
        h1: "Pay Your Cricket Bill as a Guest",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/att.html": {
        h1: "Pay Your AT&T Prepaid Bill Online",
        intro: "Guest OK. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/cricket/index.html": {
        h1: "Pay Your Cricket Bill as a Guest",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/att/index.html": {
        h1: "Pay Your AT&T Prepaid Bill Online",
        intro: "Guest OK. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/straight-talk.html": {
        h1: "Pay Your Straight Talk Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/straight-talk/index.html": {
        h1: "Pay Your Straight Talk Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "es/go/straight-talk.html": {
        h1: "Pague Straight Talk en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/straight-talk/index.html": {
        h1: "Pague Straight Talk en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/simple-mobile.html": {
        h1: "Pague Simple Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/simple-mobile/index.html": {
        h1: "Pague Simple Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/ultra.html": {
        h1: "Pague Ultra Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/ultra/index.html": {
        h1: "Pague Ultra Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/lyca.html": {
        h1: "Pague Lyca Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/lyca/index.html": {
        h1: "Pague Lyca Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/h2o.html": {
        h1: "Pague H2O Wireless en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/h2o/index.html": {
        h1: "Pague H2O Wireless en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/net10.html": {
        h1: "Pague Net10 en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/net10/index.html": {
        h1: "Pague Net10 en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/att.html": {
        h1: "Pague AT&T Prepaid en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/att/index.html": {
        h1: "Pague AT&T Prepaid en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "go/net10.html": {
        h1: "Pay Your Net10 Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/net10/index.html": {
        h1: "Pay Your Net10 Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/h2o.html": {
        h1: "Pay Your H2O Wireless Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/h2o/index.html": {
        h1: "Pay Your H2O Wireless Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/lyca.html": {
        h1: "Pay Your Lyca Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/lyca/index.html": {
        h1: "Pay Your Lyca Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/tmobile.html": {
        h1: "Pay Your T-Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/tmobile/index.html": {
        h1: "Pay Your T-Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/verizon.html": {
        h1: "Pay Your Verizon Prepaid Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
      "go/verizon/index.html": {
        h1: "Pay Your Verizon Prepaid Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick the amount, pay. Low service fee shown before you pay.",
      },
    };


    // Per-route SEO metadata for static alias HTML files.
    // Bots and social scrapers read the static HTML before JS runs, so each
    // alias ships its own <title>, description, OG title/description
    // and (for legacy redirect shells) noindex,follow.
    // These files are served on refill.cellpay.us AND www.cellpay.us (separate sites,
    // each self-canonical), so the static HTML never names a host: no absolute canonical,
    // og:url or hreflang here. At runtime src/lib/seo.ts sets canonical + og:url to the
    // current host; hreflang lives in each host's own sitemap (sitemap-refill.xml / sitemap-www.xml).
    type Meta = {
      title: string;
      description: string;
      noindex?: boolean;
      lang?: string;
      enPath?: string; // for hreflang pairing
      esPath?: string;
      canonical?: string; // static self-canonical, relative: resolves to the host that serves the file
    };
    const CARRIER_META: Record<string, { title: string; description: string }> = {
      "topup-at.html":             { title: "AT&T Prepaid Refill — Online Top-Up | CellPay",        description: "Recharge your AT&T Prepaid phone online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "boost.html":                { title: "Boost Mobile Refill — Online Top-Up | CellPay",        description: "Recharge Boost Mobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "topup-crc.html":            { title: "Cricket Wireless Refill — Online Top-Up | CellPay",    description: "Recharge Cricket Wireless online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "h2o.html":                  { title: "H2O Wireless Refill — Online Top-Up | CellPay",        description: "Recharge H2O Wireless online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "lyca.html":                 { title: "Lycamobile Refill — Online Top-Up | CellPay",          description: "Recharge Lycamobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "metropcs.html":             { title: "Metro by T-Mobile Refill — Online Top-Up | CellPay",   description: "Recharge Metro by T-Mobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "metro-pcs.html":            { title: "Metro PCS Refill — Online Top-Up | CellPay",           description: "Recharge Metro PCS online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "guest-metro-pcs.html":      { title: "Metro PCS Guest Refill — Online Top-Up | CellPay",     description: "Recharge Metro PCS as a guest. No login needed. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "guest-h2o.html":            { title: "H2O Wireless Guest Refill — Online Top-Up | CellPay",  description: "Make an H2O Wireless guest payment online. No login needed — pick a 30-day plan, pay securely, and your refill is sent to your line after payment." },
      "guest-pageplus.html":       { title: "Page Plus Guest Refill — Online Top-Up | CellPay",     description: "Pay your Page Plus Cellular bill as a guest. No login needed — pick a 30-day plan, check out securely, and your refill is sent to your line after payment." },
      "guest-simple-mobile.html":  { title: "Simple Mobile Guest Refill — Online Top-Up | CellPay", description: "Make a Simple Mobile guest payment online. No login needed — pick a 30-day plan, pay securely, and your refill is sent to your line after payment." },
      "guest-net10.html":          { title: "NET10 Wireless Guest Refill — Online Top-Up | CellPay",description: "Pay your NET10 Wireless bill as a guest. No login needed — pick a 30-day plan, check out securely, and your refill is sent to your line after payment." },
      "guest-lyca.html":           { title: "Lycamobile Guest Refill — Online Top-Up | CellPay",    description: "Make a Lycamobile guest payment online. No login needed — pick a 30-day plan, pay securely, and your refill is sent to your line after payment." },
      "net10.html":                { title: "Net10 Wireless Refill — Online Top-Up | CellPay",      description: "Recharge Net10 Wireless online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "pageplus.html":             { title: "Page Plus Cellular Refill — Online Top-Up | CellPay",  description: "Recharge Page Plus Cellular online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "s1.html":                   { title: "Simple Mobile Refill — Online Top-Up | CellPay",       description: "Recharge Simple Mobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "tmobile-flexi.html":        { title: "T-Mobile Prepaid Refill — Online Top-Up | CellPay",    description: "Recharge T-Mobile Prepaid online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "tracfone.html":             { title: "TracFone Refill — Online Top-Up | CellPay",            description: "Recharge TracFone online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "ultra-mobile.html":         { title: "Ultra Mobile Refill — Online Top-Up | CellPay",        description: "Recharge Ultra Mobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "verizon-wireless-flexi.html": { title: "Verizon Prepaid Refill — Online Top-Up | CellPay",   description: "Recharge Verizon Prepaid online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "straight-talk.html":        { title: "Straight Talk Refill — Online Top-Up | CellPay",       description: "Recharge Straight Talk online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "guest-metropcs.html":       { title: "Metro PCS Guest Refill — Online Top-Up | CellPay",      description: "Recharge Metro PCS as a guest. No login needed. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "guest-boost.html":          { title: "Boost Mobile Guest Refill — Online Top-Up | CellPay",   description: "Recharge Boost Mobile as a guest. No login needed. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "total-wireless.html":       { title: "Total Wireless Refill — Online Top-Up | CellPay",       description: "Recharge Total Wireless online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      // GO-1 / GO-2 titles (noindex applied via GO_SHELLS in buildMeta)
      "go/boost.html":             { title: "Pay Your Boost Bill Without Signing In | CellPay", description: "Pay your Boost Mobile bill without signing in. Enter the phone number, pick the amount, pay. Low service fee shown before you pay." },
      "go/metro.html":             { title: "Pay Your Metro Bill as a Guest | CellPay", description: "Pay your Metro by T-Mobile (Metro PCS) bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/simple-mobile.html":     { title: "Pay Your Simple Mobile Bill Online | CellPay", description: "Pay your Simple Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay." },
      "go/boost/index.html":       { title: "Pay Your Boost Bill Without Signing In | CellPay", description: "Pay your Boost Mobile bill without signing in. Enter the phone number, pick the amount, pay. Low service fee shown before you pay." },
      "go/metro/index.html":       { title: "Pay Your Metro Bill as a Guest | CellPay", description: "Pay your Metro by T-Mobile (Metro PCS) bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/simple-mobile/index.html": { title: "Pay Your Simple Mobile Bill Online | CellPay", description: "Pay your Simple Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay." },
      // GO-1b / GO-2 ES + Ultra + Cricket/ATT
      "es/go/metro.html": { title: "Pague su factura de Metro como invitado | CellPay", description: "Pague su Metro by T-Mobile como invitado. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/boost.html": { title: "Pague Boost sin iniciar sesión | CellPay", description: "Pague su Boost Mobile sin iniciar sesión. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/cricket.html": { title: "Pague Cricket en línea | CellPay", description: "Pague su Cricket en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/metro/index.html": { title: "Pague su factura de Metro como invitado | CellPay", description: "Pague su Metro by T-Mobile como invitado. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/boost/index.html": { title: "Pague Boost sin iniciar sesión | CellPay", description: "Pague su Boost Mobile sin iniciar sesión. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/cricket/index.html": { title: "Pague Cricket en línea | CellPay", description: "Pague su Cricket en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "go/ultra.html": { title: "Pay Your Ultra Mobile Bill Online | CellPay", description: "Pay your Ultra Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay." },
      "go/ultra/index.html": { title: "Pay Your Ultra Mobile Bill Online | CellPay", description: "Pay your Ultra Mobile bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay." },
      "go/cricket.html": { title: "Pay Your Cricket Bill as a Guest | CellPay", description: "Pay your Cricket Wireless bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/att.html": { title: "Pay Your AT&T Prepaid Bill Online | CellPay", description: "Pay or refill your AT&T Prepaid bill online. Guest OK. Low service fee shown before you pay." },
      "go/cricket/index.html": { title: "Pay Your Cricket Bill as a Guest | CellPay", description: "Pay your Cricket Wireless bill as a guest. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/att/index.html": { title: "Pay Your AT&T Prepaid Bill Online | CellPay", description: "Pay or refill your AT&T Prepaid bill online. Guest OK. Low service fee shown before you pay." },
      // GO-ES-ST Batch A
      "go/straight-talk.html": { title: "Pay Your Straight Talk Bill Online | CellPay", description: "Pay your Straight Talk bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay." },
      "go/straight-talk/index.html": { title: "Pay Your Straight Talk Bill Online | CellPay", description: "Pay your Straight Talk bill online. Enter the phone number, pick a plan, pay. No login. Low service fee shown before you pay." },
      "es/go/straight-talk.html": { title: "Pague Straight Talk en línea | CellPay", description: "Pague su Straight Talk en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/straight-talk/index.html": { title: "Pague Straight Talk en línea | CellPay", description: "Pague su Straight Talk en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-ES-SM
      "es/go/simple-mobile.html": { title: "Pague Simple Mobile en línea | CellPay", description: "Pague su Simple Mobile en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/simple-mobile/index.html": { title: "Pague Simple Mobile en línea | CellPay", description: "Pague su Simple Mobile en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-ES-ULTRA
      "es/go/ultra.html": { title: "Pague Ultra Mobile en línea | CellPay", description: "Pague su Ultra Mobile en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/ultra/index.html": { title: "Pague Ultra Mobile en línea | CellPay", description: "Pague su Ultra Mobile en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-ES-LYCA
      "es/go/lyca.html": { title: "Pague Lyca Mobile en línea | CellPay", description: "Pague su Lyca Mobile en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/lyca/index.html": { title: "Pague Lyca Mobile en línea | CellPay", description: "Pague su Lyca Mobile en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-ES-H2O
      "es/go/h2o.html": { title: "Pague H2O Wireless en línea | CellPay", description: "Pague su H2O Wireless en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/h2o/index.html": { title: "Pague H2O Wireless en línea | CellPay", description: "Pague su H2O Wireless en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-ES-NET10
      "es/go/net10.html": { title: "Pague Net10 en línea | CellPay", description: "Pague su Net10 en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/net10/index.html": { title: "Pague Net10 en línea | CellPay", description: "Pague su Net10 en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-ES-ATT
      "es/go/att.html": { title: "Pague AT&T Prepaid en línea | CellPay", description: "Pague su AT&T Prepaid en línea. Sin cuenta. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/att/index.html": { title: "Pague AT&T Prepaid en línea | CellPay", description: "Pague su AT&T Prepaid en línea. Sin cuenta. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "go/net10.html": { title: "Pay Your Net10 Bill Online | CellPay", description: "Pay your Net10 bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/net10/index.html": { title: "Pay Your Net10 Bill Online | CellPay", description: "Pay your Net10 bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/h2o.html": { title: "Pay Your H2O Wireless Bill Online | CellPay", description: "Pay your H2O Wireless bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/h2o/index.html": { title: "Pay Your H2O Wireless Bill Online | CellPay", description: "Pay your H2O Wireless bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/lyca.html": { title: "Pay Your Lyca Mobile Bill Online | CellPay", description: "Pay your Lyca Mobile bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/lyca/index.html": { title: "Pay Your Lyca Mobile Bill Online | CellPay", description: "Pay your Lyca Mobile bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/tmobile.html": { title: "Pay Your T-Mobile Bill Online | CellPay", description: "Pay your T-Mobile bill online. No login. Pay for anyone. Enter the phone number, pick the amount, pay. Low service fee shown before you pay." },
      "go/tmobile/index.html": { title: "Pay Your T-Mobile Bill Online | CellPay", description: "Pay your T-Mobile bill online. No login. Pay for anyone. Enter the phone number, pick the amount, pay. Low service fee shown before you pay." },
      "go/verizon.html": { title: "Pay Your Verizon Prepaid Bill Online | CellPay", description: "Pay or refill your Verizon Prepaid bill online. Guest OK — enter the phone number, pick the amount, pay. Low service fee shown before you pay." },
      "go/verizon/index.html": { title: "Pay Your Verizon Prepaid Bill Online | CellPay", description: "Pay or refill your Verizon Prepaid bill online. Guest OK — enter the phone number, pick the amount, pay. Low service fee shown before you pay." },
    };
    const ES_TITLE_PREFIX: Record<string, string> = {};
    // Carriers removed from the site (Oct 2026). Their old URLs keep a noindex shell.
    const REMOVED_CARRIER_SHELLS = new Set([
      "red-pocket-mobile.html", "es/red-pocket-mobile.html",
      "movistar.html", "es/movistar.html",
      "movistar-flexi.html", "es/movistar-flexi.html",
      "us-cellular.html", "es/us-cellular.html",
      "xbox/index.html", "es/xbox/index.html",
      "red-pocket/index.html", "es/red-pocket/index.html",
      "red-pocket-mobile/index.html", "es/red-pocket-mobile/index.html",
      "movistar/index.html", "es/movistar/index.html",
      "movistar-flexi/index.html", "es/movistar-flexi/index.html",
    ]);
    // Old alias .html URLs (App.tsx redirects them; query string and hash kept). Static shell only so the host does not 404.
    const ALIAS_REDIRECT_SHELLS = new Set([
      "verizon.html", "es/verizon.html",
      "tmobile.html", "es/tmobile.html",
      "bmobile.html", "es/bmobile.html",
      "about-us.html", "contact-us.html",
      "faq.html", "how-to-use.html",
      "privacy-policy.html", "terms-and-conditions.html",
      "returns-policy.html", "returns-and-refunds-policy.html",
      "es/returns-and-refunds-policy.html", "es/privacy-policy.html",
      "es/terms-and-conditions.html", "es/returns-policy.html",
    ]);
    // GO-1 dedicated ad landers: always noindex,follow (ads only; not for organic).
    const GO_SHELLS = new Set([
      "go/boost.html", "go/metro.html", "go/simple-mobile.html",
      "go/boost/index.html", "go/metro/index.html", "go/simple-mobile/index.html",
      // GO-1b
      "es/go/metro.html", "es/go/boost.html", "es/go/cricket.html",
      "es/go/metro/index.html", "es/go/boost/index.html", "es/go/cricket/index.html",
      "go/ultra.html", "go/ultra/index.html",
      // GO-2
      "go/cricket.html", "go/att.html",
      "go/cricket/index.html", "go/att/index.html",
      // GO-ES-ST Batch A
      "go/straight-talk.html", "go/straight-talk/index.html",
      "es/go/straight-talk.html", "es/go/straight-talk/index.html",
      // GO-ES-SM
      "es/go/simple-mobile.html", "es/go/simple-mobile/index.html",
      // GO-ES-ULTRA
      "es/go/ultra.html", "es/go/ultra/index.html",
      // GO-ES-LYCA
      "es/go/lyca.html", "es/go/lyca/index.html",
      // GO-ES-H2O
      "es/go/h2o.html", "es/go/h2o/index.html",
      // GO-ES-NET10
      "es/go/net10.html", "es/go/net10/index.html",
      // GO-ES-ATT
      "es/go/att.html", "es/go/att/index.html",
      // GO-EN-MISSING
      "go/net10.html", "go/net10/index.html",
      "go/h2o.html", "go/h2o/index.html",
      "go/lyca.html", "go/lyca/index.html",
      "go/tmobile.html", "go/tmobile/index.html",
      "go/verizon.html", "go/verizon/index.html",
    ]);
    const buildMeta = (route: string): Meta => {
      // Legacy per-amount redirect shells: noindex,follow
      if (/^\d+-.+-prepaid-refill\.html$/.test(route)) {
        return {
          title: "Prepaid Refill | CellPay",
          description: "Recharge your prepaid phone online with CellPay.",
          noindex: true,
          lang: "en",
        };
      }
      // Espanol legacy aliases: noindex,follow (they redirect to /es/*)
      if (route.endsWith("-espanol.html")) {
        return {
          title: "Recarga de Teléfono Prepago | CellPay",
          description: "Recarga tu teléfono prepago en línea con CellPay.",
          noindex: true,
          lang: "es",
        };
      }
      // Admin shells: noindex
      if (route.startsWith("admin/")) {
        return {
          title: "Admin | CellPay",
          description: "CellPay administration.",
          noindex: true,
          lang: "en",
        };
      }
      // GO-1 dedicated ad landers: noindex,follow (titles from CARRIER_META)
      if (GO_SHELLS.has(route)) {
        const meta = CARRIER_META[route] || {
          title: "Pay Your Bill Online | CellPay",
          description: "No login. Pay for anyone. Low service fee shown before you pay.",
        };
        const isEs = route.startsWith("es/");
        return { ...meta, noindex: true, lang: isEs ? "es" : "en" };
      }
      // Removed carriers (Red Pocket, Movistar, Xbox, US Cellular): generic noindex,follow shell;
      // the React route sends visitors to the home page.
      if (REMOVED_CARRIER_SHELLS.has(route)) {
        const isEs = route.startsWith("es/");
        return {
          title: "CellPay — Mobile Recharge & Prepaid Phone Refills Online",
          description: isEs
            ? "Recargas de teléfonos prepago para más de 15 operadores de EE. UU. con CellPay."
            : "Mobile recharge and prepaid refills for 15+ US carriers with CellPay.",
          noindex: true,
          lang: isEs ? "es" : "en",
        };
      }
      // SEO-SHELL-1: clean sitemap paths (indexable). Titles/descriptions match applySeoHead at runtime.
      // Not in ALIAS_REDIRECT_SHELLS (those .html twins stay noindex redirects).
      const SITE_PAGE_META: Record<string, { title: string; description: string }> = {
        "es/index.html": {
          title: "Recargas Móviles y Pagos Prepagados en Línea | CellPay",
          description: "Recargas prepagadas para más de 15 operadores de EE. UU.: AT&T, T-Mobile, Metro, Cricket, Verizon, Boost y más. Sin iniciar sesión. Cargo por servicio bajo, mostrado antes de pagar.",
        },
        "verizon/index.html": {
          title: "Verizon Prepaid Refill — Pay Bill Online | CellPay",
          description: "Refill any Verizon Prepaid phone online. No My Verizon login, all major cards & wallets. Pay your Verizon Prepaid bill online on CellPay.",
        },
        "es/verizon/index.html": {
          title: "Recarga de Verizon Wireless Prepaid en Línea — Pague su Factura | CellPay",
          description: "Recarga en línea. Planes de 30 días, pago seguro. Cargo por servicio bajo, mostrado antes de pagar.",
        },
        "total-wireless/index.html": {
          title: "Total Wireless Refills and Online Bill Payments",
          description: "Recharge your Total Wireless plan instantly online with CellPay online bill payments. Easy, fast and secure way to pay Total Wireless",
        },
        "es/total-wireless/index.html": {
          title: "Recarga de Total Wireless en Línea — Pague su Factura | CellPay",
          description: "Recarga en línea. Planes de 30 días, pago seguro. Cargo por servicio bajo, mostrado antes de pagar.",
        },
        "att-firstnet/index.html": {
          title: "AT&T Prepaid Refill Online | CellPay",
          description: "Refill your AT&T Prepaid phone online with CellPay. Secure online top-up from $5 to $150, sent directly to your number.",
        },
        "es/att-firstnet/index.html": {
          title: "Recarga AT&T Prepago en Línea | CellPay",
          description: "Recarga tu teléfono AT&T Prepaid en línea con CellPay. Recarga en línea segura desde $5 hasta $150, enviada directamente a tu número.",
        },
        "about-us/index.html": {
          title: "About CellPay — Online Prepaid Wireless Refills",
          description: "Learn about CellPay, an independent online prepaid refill service supporting 15+ US wireless carriers with online top-ups, secure checkout, and a low service fee shown before you pay.",
        },
        "contact-us/index.html": {
          title: "Contact CellPay Support — Help With Your Prepaid Refill",
          description: "Need help with a CellPay refill? Email support@getcellpay.com. Business hours, response times, and tips for resolving common refill issues.",
        },
        "faq/index.html": {
          title: "Prepaid Refill FAQ — CellPay Help & Answers",
          description: "Answers to the most common questions about CellPay prepaid refills: supported carriers, payment methods, delivery time, refunds, and account help.",
        },
        "how-to-use/index.html": {
          title: "How to Refill a Prepaid Phone Online — CellPay Guide",
          description: "Step-by-step guide to recharging a US prepaid phone with CellPay: pick a carrier, enter the number, choose a plan, pay securely, and get your top-up.",
        },
        "privacy-policy/index.html": {
          title: "Privacy Policy — CellPay",
          description: "How CellPay collects, uses, and protects customer information when you purchase a prepaid mobile refill: data we collect, how we share it, and your choices.",
        },
        "terms-and-conditions/index.html": {
          title: "Terms & Conditions — CellPay",
          description: "The terms governing your use of CellPay: services, pricing, payment, refill delivery, refund rules, account responsibilities, and limitations of liability.",
        },
        "returns-policy/index.html": {
          title: "Returns & Refunds Policy — CellPay",
          description: "CellPay's returns policy: completed refill payments are final and can't be refunded. How to contact support about a duplicate charge or a missing refill.",
        },
      };
      if (SITE_PAGE_META[route]) {
        const isEs = route === "es/index.html" || route.startsWith("es/");
        return { ...SITE_PAGE_META[route], lang: isEs ? "es" : "en" };
      }
      // Old alias .html URLs: noindex,follow shell; the React route redirects (query string and hash kept).
      if (ALIAS_REDIRECT_SHELLS.has(route)) {
        const isEs = route.startsWith("es/");
        return {
          title: "CellPay — Mobile Recharge & Prepaid Phone Refills Online",
          description: isEs
            ? "Recargas de teléfonos prepago para más de 15 operadores de EE. UU. con CellPay."
            : "Mobile recharge and prepaid refills for 15+ US carriers with CellPay.",
          noindex: true,
          lang: isEs ? "es" : "en",
        };
      }
      // DMCA page (real page, English only): indexable, canonical = the English URL (same as applySeoHead in DMCA.tsx).
      if (route === "digital-millennium-copyright-act-dmca-compliance.html" || route === "es/digital-millennium-copyright-act-dmca-compliance.html") {
        return {
          title: "DMCA Compliance — CellPay",
          description: "Digital Millennium Copyright Act (DMCA) compliance policy for CellPay, including how to submit a notice of alleged copyright infringement.",
          lang: "en",
          canonical: "/digital-millennium-copyright-act-dmca-compliance.html",
        };
      }
      // Spanish carrier mirror
      if (route.startsWith("es/")) {
        const base = route.slice(3);
        const meta = CARRIER_META[base];
        if (meta) {
          // GSC-DUP-1007: Spanish title (same text DynamicCarrier sets at runtime for lang="es").
          const esLook = CARRIER_LOOK[base.replace(/\.html$/, "")];
          return {
            title: esLook
              ? `Recarga de ${esLook.name} en Línea — Pague su Factura | CellPay`
              : meta.title.replace(" | CellPay", " — Español | CellPay"),
            description: "Recarga en línea. Planes de 30 días, pago seguro. Cargo por servicio bajo, mostrado antes de pagar.",
            lang: "es",
            esPath: "/" + route,
            enPath: "/" + base,
          };
        }
      }
      // English carrier
      const meta = CARRIER_META[route];
      if (meta) {
        return {
          ...meta,
          lang: "en",
          enPath: "/" + route,
          esPath: "/es/" + route,
        };
      }
      // Path-style aliases (h2o-wireless/, pageplus/)
      if (route === "h2o-wireless/index.html" || route === "h2o-wireless/bill-payment/index.html") {
        return { ...CARRIER_META["h2o.html"], lang: "en" };
      }
      if (route === "pageplus/index.html") {
        return { ...CARRIER_META["pageplus.html"], lang: "en" };
      }
      return {
        title: "Mobile Recharge & Prepaid Refills Online | CellPay",
        description: "Recharge any US prepaid carrier online with CellPay.",
        lang: "en",
      };
    };

    const escAttr = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // SPEED-1006b: /go/* and /es/go/* shells carry a static copy of GoLander's first screen (header, colored
    // headline bar, loading block) with the same classes, so the headline paints before the app code runs.
    // main.tsx lets the browser paint it, then React replaces #root with the same markup, so nothing moves.
    // Keep in sync with GoLander.tsx (header / headline bar / loading block) and the /go routes in App.tsx.
    const GO_LOOK: Record<string, { name: string; color: string; logo: string }> = {
      boost: { name: "Boost Mobile", color: "hsl(27,100%,50%)", logo: "boost-logo.png" },
      metro: { name: "Metro PCS", color: "hsl(270,60%,32%)", logo: "metro-logo.svg" },
      "simple-mobile": { name: "Simple Mobile", color: "hsl(101,67%,44%)", logo: "simple-mobile-logo.png" },
      cricket: { name: "Cricket Wireless", color: "hsl(82,60%,42%)", logo: "cricket-logo.webp" },
      att: { name: "AT&T Prepaid", color: "hsl(196,100%,44%)", logo: "att-prepaid-logo.webp" },
      ultra: { name: "Ultra Mobile", color: "hsl(270,50%,40%)", logo: "ultra-mobile-logo.png" },
      "straight-talk": { name: "Straight Talk", color: "hsl(72,74%,44%)", logo: "straight-talk-logo.svg" },
      lyca: { name: "Lyca Mobile", color: "hsl(220,50%,22%)", logo: "lyca-logo.webp" },
      h2o: { name: "H2O Wireless", color: "hsl(195,85%,50%)", logo: "h2o-logo.png" },
      net10: { name: "Net10 Wireless", color: "hsl(195,100%,50%)", logo: "net10-logo.png" },
      tmobile: { name: "T-Mobile", color: "hsl(330,100%,45%)", logo: "tmobile-logo.svg" },
      verizon: { name: "Verizon Wireless Prepaid", color: "hsl(0,100%,45%)", logo: "verizon-logo.png" },
    };
    const distAssets: string[] = (() => {
      try {
        return fs.readdirSync(path.join(outDir, "assets"));
      } catch {
        return [];
      }
    })();
    // Same URL the app gets for the image import: the hashed file in dist/assets, or the same data: URI
    // Vite inlines for small files (under 4 KB), so the browser reuses the image when React mounts.
    const goAssetUrl = (file: string): string | null => {
      const dot = file.lastIndexOf(".");
      const base = file.slice(0, dot);
      const ext = file.slice(dot + 1);
      const hit = distAssets.find(
        (f) =>
          f.startsWith(base + "-") &&
          f.endsWith("." + ext) &&
          /^[A-Za-z0-9_-]{8}$/.test(f.slice(base.length + 1, f.length - ext.length - 1)),
      );
      if (hit) return `/assets/${hit}`;
      const src = path.resolve(__dirname, "src/assets", file);
      if (!fs.existsSync(src)) return null;
      const buf = fs.readFileSync(src);
      if (buf.length >= 4096) return null;
      if (ext === "svg") {
        const s = buf.toString();
        if (s.includes("<text") || s.includes("<foreignObject") || /"[^"']*'[^"]*"|'[^'"]*"[^']*'/.test(s)) {
          return `data:image/svg+xml;base64,${buf.toString("base64")}`;
        }
        return (
          "data:image/svg+xml," +
          s
            .trim()
            .replace(/>\s+</g, "><")
            .replace(/"/g, "'")
            .replace(/%/g, "%25")
            .replace(/#/g, "%23")
            .replace(/</g, "%3c")
            .replace(/>/g, "%3e")
            .replace(/\s+/g, "%20")
        );
      }
      const mime: Record<string, string> = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };
      return mime[ext] ? `data:${mime[ext]};base64,${buf.toString("base64")}` : null;
    };
    const goFirstScreen = (route: string): string | null => {
      const content = GO_CONTENT[route];
      const slug = route.replace(/^es\//, "").replace(/^go\//, "").replace(/(\/index)?\.html$/, "");
      const look = GO_LOOK[slug];
      if (!content || !look) return null;
      const cellpayLogo = goAssetUrl("cellpay-logo.svg");
      if (!cellpayLogo) return null;
      const logo = goAssetUrl(look.logo);
      const tagline = route.startsWith("es/") ? "Sin cuenta. Pague por otra persona." : "No login. Pay for anyone.";
      // SPEED-LANDER-LCP2: Autopay benefit in the static shell (same classes/copy as GoLander) so LCP can paint with H1.
      const isEs = route.startsWith("es/");
      const autoPayLine = isEs
        ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar — nunca está marcado de antemano."
        : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout — it is never pre-checked.";
      const feeLine = isEs
        ? "Cargo por servicio bajo, mostrado antes de pagar"
        : "Low service fee shown before you pay";
      const payMethods =
        "Visa, Mastercard, American Express, Discover, Apple Pay, Google Pay, PayPal, Klarna, Cash App";
      const carrier = logo
        ? `<img src="${escAttr(logo)}" alt="${escAttr(look.name)} logo" width="94" height="28" class="h-[28px] sm:h-[36px] w-auto object-contain">`
        : `<span class="text-lg font-extrabold" style="color:${look.color}">${escAttr(look.name)}</span>`;
      return (
        `<div id="root" data-go-prerender="1">` +
        `<div class="min-h-screen bg-background font-sans antialiased flex flex-col">` +
        `<header class="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style="border-color:${look.color}">` +
        `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">` +
        `<div class="flex justify-center h-14 sm:h-16 items-center gap-3">` +
        `<img src="${escAttr(cellpayLogo)}" alt="CellPay" width="110" height="28" class="h-7 sm:h-8 w-auto">` +
        `<span class="text-muted-foreground text-sm hidden sm:inline">·</span>` +
        carrier +
        `</div></div></header>` +
        `<section class="text-primary-foreground" style="background-color:${look.color}">` +
        `<div class="max-w-7xl mx-auto px-5 py-3 sm:py-4 text-center">` +
        `<h1 class="text-lg sm:text-xl md:text-2xl font-extrabold leading-snug">${escAttr(content.h1)}</h1>` +
        `<p class="text-xs sm:text-sm opacity-90 mt-1">${tagline}</p>` +
        `</div></section>` +
        `<div class="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-2 pb-2">` +
        `<div class="bg-card rounded-xl border border-border px-3 py-3 sm:px-4 sm:py-3 text-left">` +
        `<label class="flex items-start gap-2">` +
        `<input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-input" style="accent-color:${look.color}">` +
        `<span class="text-[11px] sm:text-xs text-foreground leading-relaxed">${autoPayLine}</span>` +
        `</label>` +
        `<p class="mt-2 text-[11px] sm:text-xs font-semibold text-foreground text-center">${feeLine}</p>` +
        `<p class="mt-1 text-[10px] sm:text-[11px] text-muted-foreground leading-snug text-center">${payMethods}</p>` +
        `</div></div>` +
        `<div class="flex justify-center items-start py-16 flex-1 min-h-screen">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle h-10 w-10 animate-spin text-muted-foreground"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>` +
        `</div></div></div>`
      );
    };

    // LCP-ADS-1007: static first screen for DynamicCarrier pages (nav, colored headline bar, Auto Pay info card,
    // loading block) with the same classes/copy as DynamicCarrier.tsx, so LCP paints before the app code runs.
    // Uses data-go-prerender so main.tsx lets the browser paint it first. Keep in sync with DynamicCarrier.tsx.
    // Only routes in CARRIER_SHELLS get it; anything missing falls back to the old output (build never fails on it).
    const CARRIER_LOOK: Record<string, { name: string; color: string; logo: string }> = {
      s1: { name: "Simple Mobile", color: "hsl(101,67%,44%)", logo: "simple-mobile-logo.png" },
      "topup-crc": { name: "Cricket Wireless", color: "hsl(82,60%,42%)", logo: "cricket-logo.webp" },
      metropcs: { name: "Metro PCS", color: "hsl(270,60%,32%)", logo: "metro-logo.svg" },
      "tmobile-flexi": { name: "T-Mobile", color: "hsl(330,100%,45%)", logo: "tmobile-logo.svg" },
      "topup-at": { name: "AT&T Prepaid", color: "hsl(196,100%,44%)", logo: "att-prepaid-logo.webp" },
      boost: { name: "Boost Mobile", color: "hsl(27,100%,50%)", logo: "boost-logo.png" },
      h2o: { name: "H2O Wireless", color: "hsl(195,85%,50%)", logo: "h2o-logo.png" },
      lyca: { name: "Lyca Mobile", color: "hsl(220,50%,22%)", logo: "lyca-logo.webp" },
      net10: { name: "Net10 Wireless", color: "hsl(195,100%,50%)", logo: "net10-logo.png" },
      pageplus: { name: "Page Plus", color: "hsl(0,70%,50%)", logo: "pageplus-logo.png" },
      tracfone: { name: "TracFone", color: "hsl(230,70%,30%)", logo: "tracfone-logo.svg" },
      "ultra-mobile": { name: "Ultra Mobile", color: "hsl(270,50%,40%)", logo: "ultra-mobile-logo.png" },
    };
    const CARRIER_SHELLS = new Set<string>([
      // LCP-ADS-1007 batch 1
      "metropcs.html", "metro-pcs.html", "es/metropcs.html", "metropcs-espanol.html",
      "boost.html", "es/boost.html", "boost-espanol.html",
    ]);
    const NAV_ITEMS: Array<[string, string, string]> = [
      ["Domestic Payments", "/", ""],
      ["Bill Payments", "https://billpay.cellpay.us/billpayment", ` rel="noopener noreferrer"`],
      ["International Topups", "https://international.cellpay.us/international/", ` rel="noopener noreferrer"`],
      ["Accessories", "https://shop.cellpay.us/", ` rel="noopener noreferrer" target="_blank"`],
    ];
    const navMenu =
      `<div class="bg-[hsl(174,45%,12%)] text-white"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">` +
      `<ul class="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap py-2 sm:py-3 text-sm sm:text-base font-medium scrollbar-none">` +
      NAV_ITEMS.map(
        ([label, href, extra]) =>
          `<li><a href="${href}"${extra} class="inline-block px-3 sm:px-4 py-1.5 rounded-md hover:bg-white/10 transition-colors">${label}</a></li>`,
      ).join("") +
      `</ul></div></div>`;
    const carrierFirstScreen = (route: string): string | null => {
      const isEs = route.startsWith("es/") || route.endsWith("-espanol.html");
      let slug = route.replace(/^es\//, "").replace(/-espanol\.html$/, ".html").replace(/\.html$/, "");
      if (slug === "metro-pcs") slug = "metropcs";
      const look = CARRIER_LOOK[slug];
      if (!look) return null;
      const logo = goAssetUrl(look.logo);
      if (!logo) return null;
      const h1 = isEs
        ? `Soluciones Rápidas y Seguras para Recargas Prepagadas de ${look.name}`
        : slug === "metropcs"
        ? "Metro PCS Pay Bill Online"
        : "Top Up Your Mobile Number—Online & Securely";
      const h2 = isEs
        ? `Transacciones Sencillas y Seguras para Usuarios Prepagados de ${look.name}`
        : slug === "metropcs"
        ? "Pay your Metro by T-Mobile prepaid bill online. No login needed."
        : "No login needed. Enter your phone number, choose your plan, and you're recharged.";
      const info = isEs
        ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar — nunca está marcado de antemano. Cargo por servicio bajo, mostrado antes de pagar. Aceptamos Visa, Mastercard, American Express, Discover, Apple Pay, Google Pay, PayPal, Klarna y Cash App."
        : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout — it is never pre-checked. Low service fee shown before you pay. We accept Visa, Mastercard, American Express, Discover, Apple Pay, Google Pay, PayPal, Klarna and Cash App.";
      return (
        `<div id="root" data-go-prerender="1">` +
        `<div class="min-h-screen bg-background font-sans antialiased">` +
        `<nav class="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style="border-color:${look.color}">` +
        `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="relative flex justify-center h-14 sm:h-20 items-center">` +
        `<img src="${escAttr(logo)}" alt="${escAttr(look.name)} prepaid refill logo" class="h-[32px] sm:h-[44px] w-auto object-contain">` +
        `</div></div>` +
        navMenu +
        `</nav>` +
        `<section class="text-primary-foreground" style="background-color:${look.color}">` +
        `<div class="max-w-7xl mx-auto px-5 py-4 sm:py-5 sm:px-6 lg:px-8 text-center">` +
        `<h1 class="text-xl md:text-2xl font-extrabold">${escAttr(h1)}</h1>` +
        `<p class="text-sm opacity-90 mt-1">${escAttr(h2)}</p>` +
        `</div></section>` +
        `<div class="max-w-[420px] mx-auto px-4 pt-3">` +
        `<p class="bg-card rounded-xl border border-border px-3 py-2.5 text-xs text-foreground leading-relaxed text-center">${info}</p>` +
        `</div>` +
        `<div class="flex justify-center py-16 min-h-screen">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle h-10 w-10 animate-spin text-muted-foreground"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>` +
        `</div></div></div>`
      );
    };
    // LCP-ADS-1007: home page (/) first screen = Home.tsx nav + green headline bar; the rest is a full-height blank
    // until React renders (nothing visible moves). Written into dist/index.html with a guard script: any other path the
    // host serves index.html for (checkout, order confirmation, unknown paths) clears it before the first paint.
    const homeFirstScreen = (): string | null => {
      const cellpayLogo = goAssetUrl("cellpay-logo.svg");
      if (!cellpayLogo) return null;
      return (
        `<div id="root" data-go-prerender="1">` +
        `<div class="min-h-screen bg-background font-sans antialiased flex flex-col">` +
        `<nav class="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">` +
        `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="relative flex justify-center h-14 sm:h-20 items-center">` +
        `<div class="flex items-center"><img src="${escAttr(cellpayLogo)}" alt="CellPay" width="160" height="44" decoding="async" fetchpriority="high" class="h-8 sm:h-11 w-auto object-contain"></div>` +
        `</div></div>` +
        navMenu +
        `</nav>` +
        `<section class="bg-cellpay-green text-primary-foreground">` +
        `<div class="max-w-7xl mx-auto px-5 py-5 sm:py-6 sm:px-6 lg:px-8 text-center">` +
        `<h1 class="text-2xl md:text-3xl font-extrabold leading-tight">Mobile Recharge &amp; Prepaid Phone Refills Online</h1>` +
        `<p class="text-sm sm:text-base opacity-95 mt-1.5">CellPay top-ups for 15+ US carriers · No login needed</p>` +
        `</div></section>` +
        `<div class="min-h-screen"></div>` +
        `</div></div>` +
        `<script>(function(){if(location.pathname!=="/"){var r=document.getElementById("root");r.removeAttribute("data-go-prerender");r.innerHTML="";` +
        // GSC-DUP-1007: any other path served by this fallback file (unknown URLs, /index.html, checkout) is noindex and has no canonical/hreflang.
        `var m=document.querySelector('meta[name="robots"]');if(m)m.setAttribute("content","noindex,follow");` +
        `document.querySelectorAll('link[rel="canonical"],link[rel="alternate"][hreflang]').forEach(function(l){l.parentNode.removeChild(l);});}})();</script>`
      );
    };

    // GSC-DUP-1007: one canonical host for organic search (www). Static absolute canonical + hreflang helpers.
    // Both hosts serve this same file, so every tag points at https://www.cellpay.us (a tag, not a redirect).
    const WWW = "https://www.cellpay.us";
    const ROUTE_SET = new Set<string>(HTML_ROUTES);
    const VARIANT_CANON: Record<string, string> = {
      "metro-pcs.html": "/metropcs.html",
      "es/metro-pcs.html": "/es/metropcs.html",
      "total-wireless.html": "/total-wireless",
      "es/total-wireless.html": "/es/total-wireless",
    };
    const routeToPath = (route: string): string => {
      const p = "/" + route.replace(/(^|\/)index\.html$/, "");
      return p.length > 1 ? p.replace(/\/$/, "") : "/";
    };
    const canonicalPathFor = (route: string, meta: Meta): string =>
      meta.canonical || VARIANT_CANON[route] || routeToPath(route);
    const pairFor = (canonPath: string): [string, string] | null => {
      const en = canonPath === "/es" ? "/" : canonPath.replace(/^\/es(?=\/)/, "");
      const es = en === "/" ? "/es" : "/es" + en;
      const has = (p: string) => p === "/" || ROUTE_SET.has(p.slice(1)) || ROUTE_SET.has(p.slice(1) + "/index.html");
      return has(en) && has(es) ? [en, es] : null;
    };
    const seoHeadLinks = (canonPath: string, withHreflang: boolean): string => {
      const links = [`<link rel="canonical" href="${WWW}${canonPath}" />`];
      const pair = withHreflang ? pairFor(canonPath) : null;
      if (pair) {
        links.push(`<link rel="alternate" hreflang="en" href="${WWW}${pair[0]}" />`);
        links.push(`<link rel="alternate" hreflang="es" href="${WWW}${pair[1]}" />`);
        links.push(`<link rel="alternate" hreflang="x-default" href="${WWW}${pair[0]}" />`);
      }
      return links.join("\n    ");
    };
    // GSC-DUP-1007: variant URLs without ".html" (and stale /lp/*) get their own folder shell = the target page's HTML,
    // so the raw HTML carries the target's canonical. App.tsx sends them to the target on the same host.
    const VARIANT_SHELLS: Record<string, string> = {
      "boost/index.html": "boost.html", "bmobile/index.html": "boost.html",
      "metropcs/index.html": "metropcs.html", "metro-pcs/index.html": "metropcs.html",
      "s1/index.html": "s1.html", "topup-crc/index.html": "topup-crc.html",
      "tmobile-flexi/index.html": "tmobile-flexi.html", "tmobile/index.html": "tmobile-flexi.html",
      "topup-at/index.html": "topup-at.html", "h2o/index.html": "h2o.html", "lyca/index.html": "lyca.html",
      "net10/index.html": "net10.html", "tracfone/index.html": "tracfone.html",
      "ultra-mobile/index.html": "ultra-mobile.html", "straight-talk/index.html": "straight-talk.html",
      "verizon-wireless-flexi/index.html": "verizon-wireless-flexi.html",
      "es/boost/index.html": "es/boost.html", "es/metropcs/index.html": "es/metropcs.html",
      "es/s1/index.html": "es/s1.html", "es/topup-crc/index.html": "es/topup-crc.html",
      "es/tmobile-flexi/index.html": "es/tmobile-flexi.html", "es/topup-at/index.html": "es/topup-at.html",
      "es/ultra-mobile/index.html": "es/ultra-mobile.html",
      "lp/metro/index.html": "metropcs.html", "lp/boost/index.html": "boost.html",
    };

    const renderHtml = (route: string): string => {
      const meta = buildMeta(route);
      const url = `/${route.replace(/\/index\.html$/, "/")}`; // relative: resolves to whichever host serves the file
      let out = html;

      // <html lang="...">
      out = out.replace(/<html\s+lang="[^"]*"/i, `<html lang="${meta.lang || "en"}"`);

      // <title>
      out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escAttr(meta.title)}</title>`);

      // meta description
      out = out.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escAttr(meta.description)}" />`,
      );

      // canonical
      out = out.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${url}" />`,
      );

      // og:url must be absolute and the host is only known at runtime: drop any static og:url (seo.ts sets it).
      out = out.replace(/\s*<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, "");
      // og:title, og:description
      out = out.replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${escAttr(meta.title)}" />`,
      );
      out = out.replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${escAttr(meta.description)}" />`,
      );
      out = out.replace(
        /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:title" content="${escAttr(meta.title)}" />`,
      );
      out = out.replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:description" content="${escAttr(meta.description)}" />`,
      );

      // robots — only override when we want noindex
      if (meta.noindex) {
        out = out.replace(
          /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="robots" content="noindex,follow" />`,
        );
        // If no robots tag existed, inject one
        if (!/name="robots"/i.test(out)) {
          out = out.replace(/<\/head>/i, `  <meta name="robots" content="noindex,follow" />\n  </head>`);
        }
      }

      // GSC-DUP-1007: static absolute canonical to www on every indexable page (both hosts), plus hreflang en/es/x-default
      // when the page is self-canonical and has an EN/ES twin. noindex shells (/go, aliases, -espanol, removed carriers, admin)
      // get none. seo.ts sets the same canonical at runtime.
      out = out.replace(/\s*<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/gi, "");
      if (!meta.noindex) {
        const canonPath = canonicalPathFor(route, meta);
        const headLinks = seoHeadLinks(canonPath, !meta.canonical && canonPath === routeToPath(route));
        out = out.replace(/<\/head>/i, () => `  ${headLinks}\n  </head>`);
      }

      // Inject H1 + intro into the static body for guest landing pages so
      // crawlers see real above-the-fold content in raw HTML (before JS).
      // React's createRoot replaces #root children on hydration, so users
      // briefly see this fallback then the full app mounts — no lasting
      // visual change to the app's design.
      // SPEED-1006b: /go landers get the GoLander first screen instead (see goFirstScreen); any problem
      // building it falls back to the plain H1 + intro block below, so the build never fails on it.
      let goScreen: string | null = null;
      try {
        goScreen = GO_SHELLS.has(route)
          ? goFirstScreen(route)
          : CARRIER_SHELLS.has(route)
          ? carrierFirstScreen(route)
          : null;
      } catch {
        goScreen = null;
      }
      if (goScreen) {
        const screen = goScreen;
        out = out.replace(/<div id="root"><\/div>/i, () => screen);
      }
      const guest = goScreen ? undefined : GUEST_CONTENT[route] || GO_CONTENT[route];
      if (guest) {
        const prerender =
          `<div id="root">` +
          `<main role="main" style="font-family:'Open Sans',system-ui,Arial,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#0f172a;text-align:center">` +
          `<h1 style="font-size:28px;line-height:1.25;font-weight:800;margin:0 0 16px">${escAttr(guest.h1)}</h1>` +
          `<p style="font-size:16px;line-height:1.55;margin:0;color:#334155">${escAttr(guest.intro)}</p>` +
          `</main>` +
          `</div>`;
        out = out.replace(/<div id="root"><\/div>/i, prerender);
      }

      return out;
    };

    for (const route of HTML_ROUTES) {
      const dest = path.join(outDir, route);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, renderHtml(route));
    }
    // GSC-DUP-1007: variant folder shells (see VARIANT_SHELLS); never overwrite a route that has its own shell.
    for (const [variant, target] of Object.entries(VARIANT_SHELLS)) {
      if (ROUTE_SET.has(variant) || !ROUTE_SET.has(target)) continue;
      const dest = path.join(outDir, variant);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, renderHtml(target));
    }
    // LCP-ADS-1007: home first screen in dist/index.html (see homeFirstScreen). Any problem keeps the plain file.
    try {
      const homeScreen = homeFirstScreen();
      if (homeScreen && /<div id="root"><\/div>/i.test(html)) {
        // GSC-DUP-1007: home canonical + hreflang (www) in the raw HTML.
        const homeHead = `  ${seoHeadLinks("/", true)}\n  </head>`;
        fs.writeFileSync(
          indexPath,
          html.replace(/<div id="root"><\/div>/i, () => homeScreen).replace(/<\/head>/i, () => homeHead),
        );
      }
    } catch {
      /* keep plain index.html */
    }

    // Build regression check: every route in HTML_ROUTES must exist in dist/
    // with non-empty HTML content. Fails the build if anything is missing so
    // we can never silently ship a 404 for an advertised landing page again.
    const missing: string[] = [];
    const empty: string[] = [];
    for (const route of HTML_ROUTES) {
      const dest = path.join(outDir, route);
      if (!fs.existsSync(dest)) {
        missing.push(route);
        continue;
      }
      const stat = fs.statSync(dest);
      if (stat.size === 0) empty.push(route);
    }
    if (missing.length || empty.length) {
      const lines: string[] = ["[html-route-aliases] Build regression check FAILED."];
      if (missing.length) lines.push(`  Missing: ${missing.join(", ")}`);
      if (empty.length) lines.push(`  Empty:   ${empty.join(", ")}`);
      throw new Error(lines.join("\n"));
    }
    // eslint-disable-next-line no-console
    console.log(
      `[html-route-aliases] Verified ${HTML_ROUTES.length} alias HTML routes in dist/.`,
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    htmlAliasPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
