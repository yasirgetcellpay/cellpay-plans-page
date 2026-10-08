import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
// AEO-PAGES-1007: how-to-pay page text (shared with src/pages/HowToPay.tsx) for static raw HTML + JSON-LD.
import { HOW_TO_PAY_PAGES, howToPayJsonLd, howToPayStaticHtml } from "./src/content/howToPay";
// PAYCOPY-1008: payment methods named in raw HTML come from the shared list (follows src/config/paymentFlags.ts).
import { weAcceptLine, payBrandsComma, PAYPAL_SHOWN } from "./src/content/paymentMethods";
// PRIVACY-1007: privacy policy text (shared with src/pages/PrivacyPolicy.tsx) for the static raw HTML (EN + ES).
import { PRIVACY_PAGES, privacyMainHtml, type PpPage } from "./src/content/privacyPolicy";

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
  // GO-LANDERS-1007 Batch A: ES T-Mobile + ES Verizon shells
  "es/go/tmobile.html",
  "es/go/tmobile/index.html",
  "es/go/verizon.html",
  "es/go/verizon/index.html",
  // GO-LANDERS-1007 Batch B: Page Plus, Total Wireless, Tracfone (EN + ES) shells
  "go/pageplus.html",
  "go/pageplus/index.html",
  "go/totalwireless.html",
  "go/totalwireless/index.html",
  "go/tracfone.html",
  "go/tracfone/index.html",
  "es/go/pageplus.html",
  "es/go/pageplus/index.html",
  "es/go/totalwireless.html",
  "es/go/totalwireless/index.html",
  "es/go/tracfone.html",
  "es/go/tracfone/index.html",
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
  // PRIVACY-1007: Spanish privacy policy (indexable; www canonical + en/es hreflang via pairFor)
  "es/privacy-policy/index.html",
  "terms-and-conditions/index.html",
  "returns-policy/index.html",
  // DMCA page (real page, indexable): its only URL ends in .html, so it needs a static shell too.
  "digital-millennium-copyright-act-dmca-compliance.html",
  "es/digital-millennium-copyright-act-dmca-compliance.html",
  // AEO-PAGES-1007: how-to-pay pages (indexable, www canonical, en/es hreflang via pairFor)
  "how-to-pay/straight-talk/index.html",
  "es/como-pagar/straight-talk/index.html",
  "how-to-pay/att-prepaid/index.html",
  "es/como-pagar/att-prepaid/index.html",
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
        h1: "Pay Your Metro Bill as a Guest — Just the Phone Number",
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
        h1: "Pay Your Metro Bill as a Guest — Just the Phone Number",
        intro: "Pay Metro by T-Mobile as a guest. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/simple-mobile/index.html": {
        h1: "Pay Your Simple Mobile Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "es/go/metro.html": {
        h1: "Pague su factura de Metro como invitado — solo con el número de teléfono",
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
        h1: "Pague su factura de Metro como invitado — solo con el número de teléfono",
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
      // GO-LANDERS-1007 Batch A
      "es/go/tmobile.html": {
        h1: "Pague T-Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/tmobile/index.html": {
        h1: "Pague T-Mobile en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/verizon.html": {
        h1: "Pague Verizon Prepaid en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/verizon/index.html": {
        h1: "Pague Verizon Prepaid en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      // GO-LANDERS-1007 Batch B
      "go/pageplus.html": {
        h1: "Pay Your Page Plus Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/pageplus/index.html": {
        h1: "Pay Your Page Plus Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/totalwireless.html": {
        h1: "Pay Your Total Wireless Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/totalwireless/index.html": {
        h1: "Pay Your Total Wireless Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/tracfone.html": {
        h1: "Pay Your Tracfone Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "go/tracfone/index.html": {
        h1: "Pay Your Tracfone Bill Online",
        intro: "No login. Pay for anyone. Enter the number, pick a plan, pay. Low service fee shown before you pay.",
      },
      "es/go/pageplus.html": {
        h1: "Pague Page Plus en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/pageplus/index.html": {
        h1: "Pague Page Plus en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/totalwireless.html": {
        h1: "Pague Total Wireless en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/totalwireless/index.html": {
        h1: "Pague Total Wireless en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/tracfone.html": {
        h1: "Pague Tracfone en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
      },
      "es/go/tracfone/index.html": {
        h1: "Pague Tracfone en línea",
        intro: "Sin cuenta. Pague por otra persona. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar.",
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
      // EN-META-1007: boost / topup-crc / metropcs (+ metro-pcs variant) use the same title/description that
      // src/pages/DynamicCarrier.tsx sets at runtime for these pages (lang en). Keep in sync.
      "boost.html":                { title: "Boost Mobile Bill Payment Online | CellPay", description: "Recharge Boost Mobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "topup-crc.html":            { title: "Cricket Quick Pay — Pay Your Cricket Bill Online | CellPay", description: "Cricket Quick Pay on CellPay: refill any Cricket Wireless phone online. No login needed. All major cards & wallets. Pay your Cricket bill online now." },
      "h2o.html":                  { title: "H2O Wireless Refill — Online Top-Up | CellPay",        description: "Recharge H2O Wireless online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "lyca.html":                 { title: "Lycamobile Refill — Online Top-Up | CellPay",          description: "Recharge Lycamobile online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "metropcs.html":             { title: "Metro PCS Refill — Pay Metro by T-Mobile | CellPay", description: "Metro PCS pay bill online. Pay your Metro by T-Mobile prepaid bill with any card or wallet. No login needed. Low service fee shown before you pay." },
      "metro-pcs.html":            { title: "Metro PCS Refill — Pay Metro by T-Mobile | CellPay", description: "Metro PCS pay bill online. Pay your Metro by T-Mobile prepaid bill with any card or wallet. No login needed. Low service fee shown before you pay." },
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
      // GO-LANDERS-1007 Batch A
      "es/go/tmobile.html": { title: "Pague T-Mobile en línea | CellPay", description: "Pague su T-Mobile en línea. Sin cuenta. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/tmobile/index.html": { title: "Pague T-Mobile en línea | CellPay", description: "Pague su T-Mobile en línea. Sin cuenta. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/verizon.html": { title: "Pague Verizon Prepaid en línea | CellPay", description: "Pague su Verizon Prepaid en línea. Sin cuenta. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/verizon/index.html": { title: "Pague Verizon Prepaid en línea | CellPay", description: "Pague su Verizon Prepaid en línea. Sin cuenta. Escriba el número, elija el monto y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      // GO-LANDERS-1007 Batch B
      "go/pageplus.html": { title: "Pay Your Page Plus Bill Online | CellPay", description: "Pay your Page Plus bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/pageplus/index.html": { title: "Pay Your Page Plus Bill Online | CellPay", description: "Pay your Page Plus bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/totalwireless.html": { title: "Pay Your Total Wireless Bill Online | CellPay", description: "Pay your Total Wireless bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/totalwireless/index.html": { title: "Pay Your Total Wireless Bill Online | CellPay", description: "Pay your Total Wireless bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/tracfone.html": { title: "Pay Your Tracfone Bill Online | CellPay", description: "Pay your Tracfone bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "go/tracfone/index.html": { title: "Pay Your Tracfone Bill Online | CellPay", description: "Pay your Tracfone bill online. No login. Pay for anyone. Enter the phone number, pick a plan, pay. Low service fee shown before you pay." },
      "es/go/pageplus.html": { title: "Pague Page Plus en línea | CellPay", description: "Pague su Page Plus en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/pageplus/index.html": { title: "Pague Page Plus en línea | CellPay", description: "Pague su Page Plus en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/totalwireless.html": { title: "Pague Total Wireless en línea | CellPay", description: "Pague su Total Wireless en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/totalwireless/index.html": { title: "Pague Total Wireless en línea | CellPay", description: "Pague su Total Wireless en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/tracfone.html": { title: "Pague Tracfone en línea | CellPay", description: "Pague su Tracfone en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
      "es/go/tracfone/index.html": { title: "Pague Tracfone en línea | CellPay", description: "Pague su Tracfone en línea. Sin cuenta. Escriba el número, elija el plan y pague. Cargo por servicio bajo, mostrado antes de pagar." },
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
      // GO-LANDERS-1007 Batch A
      "es/go/tmobile.html", "es/go/tmobile/index.html",
      "es/go/verizon.html", "es/go/verizon/index.html",
      // GO-LANDERS-1007 Batch B
      "go/pageplus.html", "go/pageplus/index.html",
      "go/totalwireless.html", "go/totalwireless/index.html",
      "go/tracfone.html", "go/tracfone/index.html",
      "es/go/pageplus.html", "es/go/pageplus/index.html",
      "es/go/totalwireless.html", "es/go/totalwireless/index.html",
      "es/go/tracfone.html", "es/go/tracfone/index.html",
    ]);
    // GO-LANDERS-1007: /go shells that stay noindex,follow but still carry the www self-canonical + EN/ES hreflang pair in the raw HTML
    // (same canonical seo.ts sets at runtime). Both sides of each pair must be listed.
    const GO_LINKED = new Set<string>([
      "go/tmobile.html", "go/tmobile/index.html",
      "es/go/tmobile.html", "es/go/tmobile/index.html",
      "go/verizon.html", "go/verizon/index.html",
      "es/go/verizon.html", "es/go/verizon/index.html",
      // GO-LANDERS-1007 Batch B
      "go/pageplus.html", "go/pageplus/index.html",
      "go/totalwireless.html", "go/totalwireless/index.html",
      "go/tracfone.html", "go/tracfone/index.html",
      "es/go/pageplus.html", "es/go/pageplus/index.html",
      "es/go/totalwireless.html", "es/go/totalwireless/index.html",
      "es/go/tracfone.html", "es/go/tracfone/index.html",
    ]);
    // GO-COPY-1008: /go fee wording (same as goFeeCopy in GoLander.tsx). Route descriptions keep the old text in source.
    const goFeeCopy = (s: string): string =>
      s
        .replace("Low service fee shown before you pay", "Service fee shown before you pay")
        .replace("Cargo por servicio bajo, mostrado antes de pagar", "Cargo por servicio mostrado antes de pagar");
    // SEO-ES-META-1007: one carrier-named Spanish description for Spanish carrier pages.
    // SEO-ES-META: keep in sync with src/pages/DynamicCarrier.tsx (lang === "es" applySeoHead).
    const esCarrierDesc = (name: string) =>
      `Pague su factura de ${name} en línea. Sin cuenta y sin iniciar sesión. Puede pagar por otra persona. Verá el cargo por servicio antes de pagar.`;
    // SEO-ES-META-1007: raw title/description = the text these pages set at runtime (StraightTalk.tsx / Verizon.tsx, lang es).
    const ES_RUNTIME_META: Record<string, { title: string; description: string }> = {
      "es/straight-talk.html": {
        title: "Recarga Straight Talk en Línea | CellPay",
        description: "Recarga tu plan Straight Talk Wireless en línea con CellPay. Recarga segura enviada directamente a tu número.",
      },
      "es/verizon-wireless-flexi.html": {
        title: "Recarga Verizon Prepago en Línea | CellPay",
        description: "Recarga tu teléfono Verizon Prepago en línea con CellPay. Recarga segura enviada directamente a tu número Verizon. Puede tardar hasta 30 min en reflejarse.",
      },
    };
    // AEO-PAGES-1007: route -> how-to-pay page (title/description/lang from src/content/howToPay.ts)
    const HTP_BY_ROUTE = new Map(HOW_TO_PAY_PAGES.map((p) => [p.path.slice(1) + "/index.html", p] as const));
    const buildMeta = (route: string): Meta => {
      const htp = HTP_BY_ROUTE.get(route);
      if (htp) return { title: htp.title, description: htp.description, lang: htp.lang };
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
          description: "No login. Pay for yourself or someone else. Service fee shown before you pay.",
        };
        const isEs = route.startsWith("es/");
        return { ...meta, description: goFeeCopy(meta.description), noindex: true, lang: isEs ? "es" : "en" };
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
          description: esCarrierDesc("Verizon Wireless Prepaid"),
        },
        "total-wireless/index.html": {
          title: "Total Wireless Refills and Online Bill Payments",
          description: "Recharge your Total Wireless plan instantly online with CellPay online bill payments. Easy, fast and secure way to pay Total Wireless",
        },
        "es/total-wireless/index.html": {
          title: "Recarga de Total Wireless en Línea — Pague su Factura | CellPay",
          description: esCarrierDesc("Total Wireless"),
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
        // PRIVACY-1007: same title/description PrivacyPolicy.tsx sets at runtime (src/content/privacyPolicy.ts)
        "es/privacy-policy/index.html": {
          title: PRIVACY_PAGES.es.title,
          description: PRIVACY_PAGES.es.description,
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
          const esFixed = ES_RUNTIME_META[route]; // SEO-ES-META-1007
          return {
            title: esFixed
              ? esFixed.title
              : esLook
              ? `Recarga de ${esLook.name} en Línea — Pague su Factura | CellPay`
              : meta.title.replace(" | CellPay", " — Español | CellPay"),
            description: esFixed ? esFixed.description : esLook ? esCarrierDesc(esLook.name) : "Recarga en línea. Planes de 30 días, pago seguro. Cargo por servicio bajo, mostrado antes de pagar.",
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
    // GO-LANDERS-1007: logo is optional; without it the header shows the carrier name in its color (same as GoLander with no logo prop).
    const GO_LOOK: Record<string, { name: string; color: string; logo?: string }> = {
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
      // GO-LANDERS-1007 Batch B (key = /go path segment)
      pageplus: { name: "Page Plus", color: "hsl(0,70%,50%)", logo: "pageplus-logo.png" },
      totalwireless: { name: "Total Wireless", color: "hsl(200,70%,40%)" },
      tracfone: { name: "Tracfone", color: "hsl(230,70%,30%)", logo: "tracfone-logo.svg" },
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
    // GO-COPY-1008: wallet marks (keep byte-identical with GO_PAY_MARKS in GoLander.tsx).
    const GO_PAY_MARKS =
      '<svg width="16" height="16" viewBox="0 0 20 20" role="img" aria-label="Cash App"><rect width="20" height="20" rx="4" fill="#00D632"/><text x="10" y="14.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="13" fill="#fff">$</text></svg>' +
      (PAYPAL_SHOWN ? '<svg width="46" height="16" viewBox="0 0 46 16" role="img" aria-label="PayPal"><text x="0" y="12.5" font-family="Arial,sans-serif" font-weight="900" font-size="13" font-style="italic" fill="#003087">Pay</text><text x="23" y="12.5" font-family="Arial,sans-serif" font-weight="900" font-size="13" font-style="italic" fill="#009cde">Pal</text></svg>' : "") + // PAYCOPY-1008: PayPal mark only while PayPal is offered
      '<svg width="38" height="16" viewBox="0 0 48 20" role="img" aria-label="Apple Pay"><rect width="48" height="20" rx="4" fill="#000"/><path d="M11.4 7.1c-.4.5-1 .9-1.6.8-.1-.6.2-1.3.6-1.7.4-.5 1.1-.8 1.6-.9.1.7-.2 1.3-.6 1.8zm.6.9c-.9-.1-1.6.5-2 .5s-1-.5-1.7-.5c-.9 0-1.7.5-2.1 1.3-.9 1.6-.2 4 .7 5.3.4.6.9 1.3 1.6 1.3.6 0 .9-.4 1.7-.4s1 .4 1.7.4c.7 0 1.2-.6 1.6-1.3.5-.7.7-1.4.7-1.5-.1 0-1.4-.5-1.4-2.1 0-1.3 1.1-1.9 1.1-2-.6-.9-1.5-1-1.9-1z" fill="#fff"/><text x="18" y="14" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="#fff">Pay</text></svg>' +
      '<svg width="32" height="16" viewBox="0 0 40 20" role="img" aria-label="Google Pay"><rect x=".5" y=".5" width="39" height="19" rx="4" fill="#fff" stroke="#dadce0"/><text x="5" y="14" font-family="Arial,sans-serif" font-weight="700" font-size="11" fill="#4285F4">G</text><text x="16" y="14" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="#5f6368">Pay</text></svg>' +
      '<svg width="45" height="16" viewBox="0 0 56 20" role="img" aria-label="Klarna"><rect width="56" height="20" rx="4" fill="#FFA8CD"/><text x="28" y="14" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="10" fill="#0A0A0A">Klarna.</text></svg>';
    // SPEED-WWW-1008: Cricket /go landers (amount range, no plan grid) ship the loaded first screen too: steps line, phone + amount
    // fields (read-only until the app takes over), pay bar (disabled) and the FAQ questions (closed). Same classes/copy as the
    // loading state in GoLander.tsx (skeletonRange), so nothing moves when the app mounts and the FAQ is not a late LCP. Keep in sync.
    const GO_CRICKET_FAQ_Q: Record<"en" | "es", string[]> = {
      en: [
        "Can I pay my Cricket bill without signing in?", "Can I pay for someone else's Cricket line?",
        "Do I just need the Cricket phone number?", "Do I need to call Cricket to pay?", "How can I pay?",
        "How long does a Cricket refill take?", "What if the payment fails?", "How do I get help?",
      ],
      es: [
        "¿Puedo pagar mi factura de Cricket sin cuenta?", "¿Puedo pagar la línea de Cricket de otra persona?",
        "¿Solo necesito el número de teléfono de Cricket?", "¿Tengo que llamar a Cricket para pagar?", "¿Cómo puedo pagar?",
        "¿Cuánto tarda la recarga de Cricket?", "¿Qué pasa si el pago falla?", "¿Cómo pido ayuda?",
      ],
    };
    const goCricketScreen = (isEs: boolean, color: string): string => {
      const s = isEs
        ? { steps: "3 pasos: número → monto → pagar", phone: "Ingrese su número de teléfono de Cricket Wireless", amount: "Seleccione el monto",
            ph: "Ingrese un monto entre 5 - 250", help: "Ingrese el monto que desea recargar", pay: "PAGAR AHORA", faq: "Preguntas frecuentes" }
        : { steps: "3 steps: number → amount → pay", phone: "Enter Your Cricket Wireless Phone Number", amount: "Select Amount",
            ph: "Enter an amount between 5 - 250", help: "Enter the amount you want to recharge", pay: "PAY NOW", faq: "Common questions" };
      const inputCls = "w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center";
      const faqItems = GO_CRICKET_FAQ_Q[isEs ? "es" : "en"]
        .map(
          (q) =>
            `<div data-state="closed" data-orientation="vertical" class="border-b"><h3 data-orientation="vertical" data-state="closed" class="flex">` +
            `<button type="button" aria-expanded="false" data-state="closed" data-orientation="vertical" class="flex flex-1 items-center justify-between py-4 transition-all hover:underline [&[data-state=open]>svg]:rotate-180 text-left font-bold text-foreground" style="color:${color}">` +
            `${escAttr(q)}<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0 transition-transform duration-200"><path d="m6 9 6 6 6-6"></path></svg></button></h3></div>`
        )
        .join("");
      return (
        `<div class="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-3 pb-1 sm:pt-4" aria-busy="true">` +
        `<div class="bg-card rounded-xl shadow-lg border border-border p-3 sm:p-5 text-center">` +
        `<p class="text-[11px] sm:text-xs text-muted-foreground mb-3">${s.steps}</p>` +
        `<label class="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">${s.phone}</label>` +
        `<div class="relative mb-3"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>` +
        `<input type="tel" readonly tabindex="-1" placeholder="(XXX) XXX-XXXX" aria-label="${s.phone}" class="${inputCls}" value=""></div>` +
        `<label class="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">${s.amount}</label>` +
        `<div class="relative mb-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dollar-sign absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>` +
        `<input type="text" inputmode="numeric" readonly tabindex="-1" placeholder="${s.ph}" aria-label="${s.amount}" class="${inputCls}" value=""></div>` +
        `<p class="text-[10px] sm:text-xs text-muted-foreground mt-2">${s.help}</p>` +
        `</div></div>` +
        `<div class="max-w-[420px] mx-auto px-4 pb-24 sm:pb-8"><div class="hidden sm:flex justify-center">` +
        `<button type="button" disabled class="h-[48px] px-14 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2" style="background-color:${color}">${s.pay}</button></div></div>` +
        `<div data-help-dock-slot="" class="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pl-3 pr-[72px] py-2 flex items-center gap-2" style="padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 0.5rem)">` +
        `<div class="flex-1 text-left leading-tight"><p class="text-[10px] text-muted-foreground">Total</p><p class="text-base font-extrabold text-foreground">$—</p></div>` +
        `<button type="button" disabled class="flex-[2] h-[46px] rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2" style="background-color:${color}">${s.pay}</button></div>` +
        `<section class="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">` +
        `<h2 class="text-xl sm:text-2xl font-extrabold text-foreground mb-4 text-left">${s.faq}</h2>` +
        `<div class="w-full" data-orientation="vertical">${faqItems}</div></section>`
      );
    };
    const goFirstScreen = (route: string): string | null => {
      const content = GO_CONTENT[route];
      const slug = route.replace(/^es\//, "").replace(/^go\//, "").replace(/(\/index)?\.html$/, "");
      const look = GO_LOOK[slug];
      if (!content || !look) return null;
      const cellpayLogo = goAssetUrl("cellpay-logo.svg");
      if (!cellpayLogo) return null;
      const logo = look.logo ? goAssetUrl(look.logo) : null;
      const tagline = route.startsWith("es/") ? "Sin cuenta. Pague por usted o por otra persona." : "No login. Pay for yourself or someone else.";
      // SPEED-LANDER-LCP2: Autopay benefit in the static shell (same classes/copy as GoLander) so LCP can paint with H1.
      const isEs = route.startsWith("es/");
      const autoPayLine = isEs
        ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar — nunca está marcado de antemano."
        : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout — it is never pre-checked.";
      const feeLine = isEs
        ? "Cargo por servicio mostrado antes de pagar"
        : "Service fee shown before you pay";
      // GO-COPY-1008: same as GoLander (Boost no-call line; "En español" link on English pages).
      const noCallLine =
        slug === "boost"
          ? isEs
            ? "Sin llamar. Pague Boost en línea en 3 pasos."
            : "No phone call needed. Pay Boost online in 3 steps."
          : null;
      const esHref = isEs ? null : "/es/" + route.replace(/\/index\.html$/, "");
      // PAYCOPY-1008: shared list (same as GoLander PAY_METHODS)
      const payMethods = payBrandsComma();
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
        (noCallLine ? `<p class="text-xs sm:text-sm font-bold mt-1">${noCallLine}</p>` : "") +
        (esHref
          ? `<p class="text-xs sm:text-sm mt-1"><a href="${escAttr(esHref)}" lang="es" hreflang="es" class="font-semibold underline underline-offset-2">En español</a></p>`
          : "") +
        `</div></section>` +
        `<div class="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-2 pb-2">` +
        `<div class="bg-card rounded-xl border border-border px-3 py-3 sm:px-4 sm:py-3 text-left">` +
        `<label class="flex items-start gap-2">` +
        `<input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-input" style="accent-color:${look.color}">` +
        `<span class="text-[11px] sm:text-xs text-foreground leading-relaxed">${autoPayLine}</span>` +
        `</label>` +
        `<p class="mt-2 text-[11px] sm:text-xs font-semibold text-foreground text-center">${feeLine}</p>` +
        `<div class="mt-2 flex flex-wrap items-center justify-center gap-1.5">${GO_PAY_MARKS}</div>` +
        `<p class="mt-1 text-[10px] sm:text-[11px] text-muted-foreground leading-snug text-center">${payMethods}</p>` +
        `</div></div>` +
        (slug === "cricket"
          ? goCricketScreen(isEs, look.color)
          : `<div class="flex justify-center items-start py-16 flex-1 min-h-screen">` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle h-10 w-10 animate-spin text-muted-foreground"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>` +
            `</div>`) +
        `</div></div>`
      );
    };

    // LCP-ADS-1007: static first screen for DynamicCarrier pages (nav, colored headline bar, Auto Pay info card,
    // loading block) with the same classes/copy as DynamicCarrier.tsx, so LCP paints before the app code runs.
    // Uses data-go-prerender so main.tsx lets the browser paint it first. Keep in sync with DynamicCarrier.tsx.
    // Only routes in CARRIER_SHELLS get it; anything missing falls back to the old output (build never fails on it).
    // SPEED-WWW-1008: intrinsic logo sizes (width/height attributes, same numbers as LOGO_DIMS in DynamicCarrier.tsx), so the logo
    // box is reserved before the image arrives. CSS still sets the height; the width follows the image.
    const LOGO_DIMS: Record<string, [number, number]> = {
      "simple-mobile-logo.png": [479, 105], "cricket-logo.webp": [234, 52], "metro-logo.svg": [94, 41], "tmobile-logo.svg": [52, 52],
      "att-prepaid-logo.webp": [600, 600], "verizon-logo.png": [475, 106], "boost-logo.png": [225, 225], "h2o-logo.png": [241, 76],
      "lyca-logo.webp": [314, 123], "net10-logo.png": [140, 64], "pageplus-logo.png": [265, 73], "tracfone-logo.svg": [180, 84],
      "ultra-mobile-logo.png": [801, 501], "straight-talk-logo.svg": [117, 75],
    };
    const logoDims = (file?: string): string => {
      const d = file ? LOGO_DIMS[file] : undefined;
      return d ? ` width="${d[0]}" height="${d[1]}"` : "";
    };
    const CARRIER_LOOK: Record<string, { name: string; color: string; logo?: string }> = {
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
    // SPEED-WWW-1008: first-screen-only looks for /verizon (DynamicCarrier) and /total-wireless (DynamicCarrier, no logo: name in its
    // color). Kept out of CARRIER_LOOK on purpose, so the Spanish titles/meta built from CARRIER_LOOK stay exactly as they are today.
    const SHELL_ONLY_LOOK: Record<string, { name: string; color: string; logo?: string }> = {
      verizon: { name: "Verizon Wireless Prepaid", color: "hsl(0,100%,45%)", logo: "verizon-logo.png" },
      "total-wireless": { name: "Total Wireless", color: "hsl(200,70%,40%)" },
    };
    const CARRIER_SHELLS = new Set<string>([
      // LCP-ADS-1007 batch 1
      "metropcs.html", "metro-pcs.html", "es/metropcs.html", "metropcs-espanol.html",
      "boost.html", "es/boost.html", "boost-espanol.html",
      // LCP-ADS-1007 batch 2 (es only where the app's carrier name equals CARRIER_LOOK name)
      "topup-crc.html", "es/topup-crc.html", "s1.html", "es/s1.html", "net10.html", "h2o.html", "es/h2o.html",
      "lyca.html", "es/lyca.html", "pageplus.html", "es/pageplus.html", "tracfone.html",
      "ultra-mobile.html", "es/ultra-mobile.html", "topup-at.html",
      // LCP-ADS-1007 batch 3 (es names via CARRIER_ES_NAME)
      "es/net10.html", "es/tracfone.html", "es/topup-at.html", "tmobile-flexi.html", "es/tmobile-flexi.html",
      // SPEED-WWW-1008 (es/verizon not included: the app swaps in the API name "Verizon Wireless Flexi" after load)
      "verizon/index.html", "total-wireless/index.html", "es/total-wireless/index.html", "total-wireless.html", "es/total-wireless.html",
    ]);
    // Spanish carrier name the app shows when it differs from CARRIER_LOOK name (keeps the es H1 identical).
    const CARRIER_ES_NAME: Record<string, string> = {
      net10: "NET10", tracfone: "Tracfone", "topup-at": "AT&T", "tmobile-flexi": "T-Mobile Flexi",
    };
    // LCP-ADS-1007 batch 3: Verizon (Verizon.tsx) first screen = nav + red H1 bar; card area blank until React.
    const VERIZON_SHELLS = new Set<string>(["verizon-wireless-flexi.html", "es/verizon-wireless-flexi.html"]);
    const verizonFirstScreen = (): string | null => {
      const logo = goAssetUrl("verizon-logo.png");
      if (!logo) return null;
      return (
        `<div id="root" data-go-prerender="1">` +
        `<div class="min-h-screen bg-background font-sans antialiased">` +
        `<nav class="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style="border-color:rgb(230,0,0)">` +
        `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="relative flex justify-center h-14 sm:h-20 items-center">` +
        `<img src="${escAttr(logo)}" alt="Verizon Prepaid logo"${logoDims("verizon-logo.png")} class="h-[32px] sm:h-[44px] w-auto object-contain">` +
        `</div></div></nav>` +
        `<section class="text-primary-foreground" style="background-color:rgb(230,0,0)">` +
        `<div class="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">` +
        `<h1 class="text-xl md:text-2xl font-extrabold">Verizon Prepaid Bill Pay</h1>` +
        `</div></section>` +
        `<div class="min-h-screen"></div>` +
        `</div></div>`
      );
    };
    // SPEED-WWW-1008: Straight Talk (StraightTalk.tsx; /es shows the same English page) first screen = nav + H1 bar + phone box,
    // then a full-height blank until React renders (plans load into that space). Same classes/copy as StraightTalk.tsx; keep in sync.
    const STRAIGHT_TALK_SHELLS = new Set<string>(["straight-talk.html", "es/straight-talk.html"]);
    const straightTalkFirstScreen = (): string | null => {
      const logo = goAssetUrl("straight-talk-logo.svg");
      if (!logo) return null;
      const bc = "hsl(72,74%,44%)";
      return (
        `<div id="root" data-go-prerender="1">` +
        `<div class="min-h-screen bg-background font-sans antialiased">` +
        `<nav class="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style="border-color:${bc}">` +
        `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="relative flex justify-center h-14 sm:h-20 items-center">` +
        `<img src="${escAttr(logo)}" alt="Straight Talk"${logoDims("straight-talk-logo.svg")} class="h-[32px] sm:h-[44px] w-auto object-contain">` +
        `</div></div></nav>` +
        `<section class="text-foreground" style="background-color:${bc}">` +
        `<div class="max-w-7xl mx-auto px-5 py-3 sm:px-6 lg:px-8 text-center">` +
        `<h1 class="text-xl md:text-2xl font-extrabold">Straight Talk Prepaid Refill</h1>` +
        `</div></section>` +
        `<div class="max-w-[280px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">` +
        `<div class="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">` +
        `<label class="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">Enter Your Straight Talk Phone Number</label>` +
        `<div class="relative mb-1 sm:mb-2">` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>` +
        `<input type="tel" readonly tabindex="-1" placeholder="(XXX) XXX-XXXX" class="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(72,74%,44%)] focus:border-transparent text-center">` +
        `</div>` +
        `<p class="text-[10px] sm:text-xs text-muted-foreground">Enter the phone number you want to recharge</p>` +
        `</div></div>` +
        `<div class="min-h-screen"></div>` +
        `</div></div>`
      );
    };
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
      let slug = route.replace(/^es\//, "").replace(/-espanol\.html$/, ".html").replace(/\.html$/, "").replace(/\/index$/, "");
      if (slug === "metro-pcs") slug = "metropcs";
      const look = CARRIER_LOOK[slug] || SHELL_ONLY_LOOK[slug];
      if (!look) return null;
      // SPEED-WWW-1008: no logo (Total Wireless) = the carrier name in its color, same as DynamicCarrier without a logo prop.
      const logo = look.logo ? goAssetUrl(look.logo) : null;
      if (look.logo && !logo) return null;
      const esName = CARRIER_ES_NAME[slug] || look.name;
      const h1 = isEs
        ? `Soluciones Rápidas y Seguras para Recargas Prepagadas de ${esName}`
        : slug === "metropcs"
        ? "Metro PCS Pay Bill Online"
        : "Top Up Your Mobile Number—Online & Securely";
      const h2 = isEs
        ? `Transacciones Sencillas y Seguras para Usuarios Prepagados de ${esName}`
        : slug === "metropcs"
        ? "Pay your Metro by T-Mobile prepaid bill online. No login needed."
        : "No login needed. Enter your phone number, choose your plan, and you're recharged.";
      const info = isEs
        ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar — nunca está marcado de antemano. Cargo por servicio bajo, mostrado antes de pagar. " + weAcceptLine("es") // PAYCOPY-1008: shared payment list
        : "Optional: Auto Pay so you never miss a refill. You can turn it on at checkout — it is never pre-checked. Low service fee shown before you pay. " + weAcceptLine("en");
      return (
        `<div id="root" data-go-prerender="1">` +
        `<div class="min-h-screen bg-background font-sans antialiased">` +
        `<nav class="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style="border-color:${look.color}">` +
        `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="relative flex justify-center h-14 sm:h-20 items-center">` +
        (logo
          ? `<img src="${escAttr(logo)}" alt="${escAttr(look.name)} prepaid refill logo"${logoDims(look.logo)} class="h-[32px] sm:h-[44px] w-auto object-contain">`
          : `<span class="text-xl sm:text-2xl font-extrabold" style="color:${look.color}">${escAttr(look.name)}</span>`) +
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
    const homeFirstScreen = (lang: "en" | "es" = "en"): string | null => {
      const es = lang === "es";
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
        (es
          ? `<h1 class="text-2xl md:text-3xl font-extrabold leading-tight">Recargue su Teléfono Prepagado en Línea</h1>` +
            `<p class="text-sm sm:text-base opacity-95 mt-1.5">Recargas para más de 15 operadores · Sin necesidad de iniciar sesión</p>`
          : `<h1 class="text-2xl md:text-3xl font-extrabold leading-tight">Mobile Recharge &amp; Prepaid Phone Refills Online</h1>` +
            `<p class="text-sm sm:text-base opacity-95 mt-1.5">CellPay top-ups for 15+ US carriers · No login needed</p>`) +
        `</div></section>` +
        `<div class="min-h-screen"></div>` +
        `</div></div>` +
        `<script>(function(){if(${es ? `!/^\\/es\\/?$/.test(location.pathname)` : `location.pathname!=="/"`}){var r=document.getElementById("root");r.removeAttribute("data-go-prerender");r.innerHTML="";` +
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
      // AEO-PAGES-1007: /how-to-pay/x <-> /es/como-pagar/x
      const en = canonPath === "/es" ? "/" : canonPath.startsWith("/es/como-pagar/") ? canonPath.replace("/es/como-pagar/", "/how-to-pay/") : canonPath.replace(/^\/es(?=\/)/, "");
      const es = en === "/" ? "/es" : en.startsWith("/how-to-pay/") ? en.replace("/how-to-pay/", "/es/como-pagar/") : "/es" + en;
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
      // AEO-PAGES-1007: /terms and /about short URLs (App.tsx sends them to the full page)
      "terms/index.html": "terms-and-conditions/index.html", "about/index.html": "about-us/index.html",
    };

    // PRIVACY-1007: privacy policy pages carry the full policy in the raw HTML: Navbar look + the same <main> as
    // PrivacyPolicy.tsx (same classes), so the text paints before the app code runs and sits in the same place after.
    const PRIVACY_BY_ROUTE: Record<string, PpPage> = {
      "privacy-policy/index.html": PRIVACY_PAGES.en,
      "es/privacy-policy/index.html": PRIVACY_PAGES.es,
    };
    const privacyFirstScreen = (pg: PpPage): string => {
      const logo = goAssetUrl("cellpay-logo.svg");
      const nav = logo
        ? `<nav class="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">` +
          `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="relative flex justify-center h-14 sm:h-20 items-center">` +
          `<a href="/" aria-label="CellPay home" class="flex items-center"><img src="${escAttr(logo)}" alt="CellPay" class="h-8 sm:h-11 w-auto object-contain"></a>` +
          `</div></div>` +
          navMenu +
          `</nav>`
        : "";
      return `<div id="root"><div class="min-h-screen flex flex-col bg-background">${nav}${privacyMainHtml(pg)}</div></div>`;
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
      } else if (GO_LINKED.has(route)) {
        // GO-LANDERS-1007: noindex /go pair: self-canonical (www) + hreflang en/es/x-default.
        const goLinks = seoHeadLinks(routeToPath(route), true);
        out = out.replace(/<\/head>/i, () => `  ${goLinks}\n  </head>`);
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
          : VERIZON_SHELLS.has(route)
          ? verizonFirstScreen()
          : STRAIGHT_TALK_SHELLS.has(route)
          ? straightTalkFirstScreen()
          : route === "es/index.html"
          ? homeFirstScreen("es")
          : null;
      } catch {
        goScreen = null;
      }
      // AEO-PAGES-1007: how-to-pay pages: static article + JSON-LD (FAQPage/HowTo/Breadcrumb) in the raw HTML.
      const htpPage = HTP_BY_ROUTE.get(route);
      if (htpPage) {
        try {
          const ld = `<script type="application/ld+json" data-htp="1">${howToPayJsonLd(htpPage)}</script>`;
          const body = howToPayStaticHtml(htpPage);
          out = out.replace(/<\/head>/i, () => `  ${ld}\n  </head>`).replace(/<div id="root"><\/div>/i, () => body);
        } catch {
          /* keep plain shell */
        }
      }
      // PRIVACY-1007: full privacy policy text in the raw HTML (EN + ES). Any problem keeps the plain shell.
      const ppPage = PRIVACY_BY_ROUTE[route];
      if (ppPage) {
        try {
          const body = privacyFirstScreen(ppPage);
          out = out.replace(/<div id="root"><\/div>/i, () => body);
        } catch {
          /* keep plain shell */
        }
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
          `<p style="font-size:16px;line-height:1.55;margin:0;color:#334155">${escAttr(GO_SHELLS.has(route) ? goFeeCopy(guest.intro) : guest.intro)}</p>` +
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
