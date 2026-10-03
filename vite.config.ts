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
  "us-cellular.html",
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
  "es/us-cellular.html",
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
  // Carriers removed from the site (Red Pocket, Movistar, Xbox; Oct 2026): noindex
  // shells only. App.tsx redirects these URLs to the home page.
  "red-pocket-mobile.html",
  "es/red-pocket-mobile.html",
  "movistar.html",
  "es/movistar.html",
  "movistar-flexi.html",
  "es/movistar-flexi.html",
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
      "us-cellular.html":          { title: "US Cellular Refill — Online Top-Up | CellPay",         description: "Recharge US Cellular online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "verizon-wireless-flexi.html": { title: "Verizon Prepaid Refill — Online Top-Up | CellPay",   description: "Recharge Verizon Prepaid online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "straight-talk.html":        { title: "Straight Talk Refill — Online Top-Up | CellPay",       description: "Recharge Straight Talk online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "guest-metropcs.html":       { title: "Metro PCS Guest Refill — Online Top-Up | CellPay",      description: "Recharge Metro PCS as a guest. No login needed. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "guest-boost.html":          { title: "Boost Mobile Guest Refill — Online Top-Up | CellPay",   description: "Recharge Boost Mobile as a guest. No login needed. All 30-day plans, secure checkout. Low service fee shown before you pay." },
      "total-wireless.html":       { title: "Total Wireless Refill — Online Top-Up | CellPay",       description: "Recharge Total Wireless online. All 30-day plans, secure checkout. Low service fee shown before you pay." },
    };
    const ES_TITLE_PREFIX: Record<string, string> = {};
    // Carriers removed from the site (Oct 2026). Their old URLs keep a noindex shell.
    const REMOVED_CARRIER_SHELLS = new Set([
      "red-pocket-mobile.html", "es/red-pocket-mobile.html",
      "movistar.html", "es/movistar.html",
      "movistar-flexi.html", "es/movistar-flexi.html",
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
      // Removed carriers (Red Pocket, Movistar, Xbox): generic noindex,follow shell;
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
      // Spanish carrier mirror
      if (route.startsWith("es/")) {
        const base = route.slice(3);
        const meta = CARRIER_META[base];
        if (meta) {
          return {
            title: meta.title.replace(" | CellPay", " — Español | CellPay"),
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

      // hreflang: not emitted in the static HTML. It must be an absolute URL and this file is
      // served on two hosts; each host's own sitemap carries the en/es/x-default alternates.

      // Inject H1 + intro into the static body for guest landing pages so
      // crawlers see real above-the-fold content in raw HTML (before JS).
      // React's createRoot replaces #root children on hydration, so users
      // briefly see this fallback then the full app mounts — no lasting
      // visual change to the app's design.
      const guest = GUEST_CONTENT[route];
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
