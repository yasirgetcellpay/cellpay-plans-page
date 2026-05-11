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
  "us-cellular.html",
  "verizon-wireless-flexi.html",
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
  "es/ultra-mobile.html",
  "es/us-cellular.html",
  "es/verizon-wireless-flexi.html",
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
  // Legacy Google Ads landing URL — served as SPA so AmountRedirect can run
  "amount.php",
  // H2O alt paths used by older Google Ads campaigns
  "h2o-wireless/index.html",
  "h2o-wireless/bill-payment/index.html",
  // PagePlus path-style alias
  "pageplus/index.html",
  // Red Pocket legacy .html URL (alias to /red-pocket SPA route)
  "red-pocket-mobile.html",
  "es/red-pocket-mobile.html",
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

    // Per-route SEO metadata for static alias HTML files.
    // Bots and social scrapers read the static HTML before JS runs, so each
    // alias must ship its own <title>, description, canonical, OG, hreflang,
    // and (for legacy redirect shells) noindex,follow.
    const SITE = "https://refill.cellpay.us";
    type Meta = {
      title: string;
      description: string;
      noindex?: boolean;
      lang?: string;
      enPath?: string; // for hreflang pairing
      esPath?: string;
    };
    const CARRIER_META: Record<string, { title: string; description: string }> = {
      "topup-at.html":             { title: "AT&T Prepaid Refill — Instant Top-Up | CellPay",        description: "Recharge your AT&T Prepaid phone instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "boost.html":                { title: "Boost Mobile Refill — Instant Top-Up | CellPay",        description: "Recharge Boost Mobile online instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "topup-crc.html":            { title: "Cricket Wireless Refill — Instant Top-Up | CellPay",    description: "Recharge Cricket Wireless instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "h2o.html":                  { title: "H2O Wireless Refill — Instant Top-Up | CellPay",        description: "Recharge H2O Wireless instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "lyca.html":                 { title: "Lycamobile Refill — Instant Top-Up | CellPay",          description: "Recharge Lycamobile instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "metropcs.html":             { title: "Metro by T-Mobile Refill — Instant Top-Up | CellPay",   description: "Recharge Metro by T-Mobile instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "metro-pcs.html":            { title: "Metro PCS Refill — Instant Top-Up | CellPay",           description: "Recharge Metro PCS instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "net10.html":                { title: "Net10 Wireless Refill — Instant Top-Up | CellPay",      description: "Recharge Net10 Wireless instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "pageplus.html":             { title: "Page Plus Cellular Refill — Instant Top-Up | CellPay",  description: "Recharge Page Plus Cellular instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "s1.html":                   { title: "Simple Mobile Refill — Instant Top-Up | CellPay",       description: "Recharge Simple Mobile instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "tmobile-flexi.html":        { title: "T-Mobile Prepaid Refill — Instant Top-Up | CellPay",    description: "Recharge T-Mobile Prepaid instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "tracfone.html":             { title: "TracFone Refill — Instant Top-Up | CellPay",            description: "Recharge TracFone instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "ultra-mobile.html":         { title: "Ultra Mobile Refill — Instant Top-Up | CellPay",        description: "Recharge Ultra Mobile instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "us-cellular.html":          { title: "US Cellular Refill — Instant Top-Up | CellPay",         description: "Recharge US Cellular instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "verizon-wireless-flexi.html": { title: "Verizon Prepaid Refill — Instant Top-Up | CellPay",   description: "Recharge Verizon Prepaid instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "straight-talk.html":        { title: "Straight Talk Refill — Instant Top-Up | CellPay",       description: "Recharge Straight Talk instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
      "red-pocket-mobile.html":    { title: "Red Pocket Mobile Refill — Instant Top-Up | CellPay",   description: "Recharge Red Pocket Mobile instantly. All 30-day plans, secure checkout, no fees, delivered in seconds." },
    };
    const ES_TITLE_PREFIX: Record<string, string> = {};
    const buildMeta = (route: string): Meta => {
      // Legacy per-amount redirect shells: noindex,follow
      if (/^\d+-.+-prepaid-refill\.html$/.test(route)) {
        return {
          title: "Prepaid Refill | CellPay",
          description: "Recharge your prepaid phone instantly with CellPay.",
          noindex: true,
          lang: "en",
        };
      }
      // Espanol legacy aliases: noindex,follow (they redirect to /es/*)
      if (route.endsWith("-espanol.html")) {
        return {
          title: "Recarga de Teléfono Prepago | CellPay",
          description: "Recarga tu teléfono prepago al instante con CellPay.",
          noindex: true,
          lang: "es",
        };
      }
      // amount.php legacy
      if (route === "amount.php") {
        return {
          title: "Recarga de Teléfono | CellPay",
          description: "Elige tu operador para recargar tu teléfono prepago.",
          noindex: true,
          lang: "en",
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
      // Spanish carrier mirror
      if (route.startsWith("es/")) {
        const base = route.slice(3);
        const meta = CARRIER_META[base];
        if (meta) {
          return {
            title: meta.title.replace(" | CellPay", " — Español | CellPay"),
            description: "Recarga al instante. Planes de 30 días, pago seguro, sin comisiones, entrega en segundos.",
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
        description: "Recharge any US prepaid carrier instantly with CellPay.",
        lang: "en",
      };
    };

    const escAttr = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const renderHtml = (route: string): string => {
      const meta = buildMeta(route);
      const url = `${SITE}/${route.replace(/\/index\.html$/, "/")}`;
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

      // og:url, og:title, og:description
      out = out.replace(
        /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${url}" />`,
      );
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

      // hreflang pairing
      const extras: string[] = [];
      if (meta.enPath && meta.esPath) {
        extras.push(`<link rel="alternate" hreflang="en" href="${SITE}${meta.enPath}" />`);
        extras.push(`<link rel="alternate" hreflang="es" href="${SITE}${meta.esPath}" />`);
        extras.push(`<link rel="alternate" hreflang="x-default" href="${SITE}${meta.enPath}" />`);
      }
      if (extras.length) {
        out = out.replace(/<\/head>/i, `  ${extras.join("\n  ")}\n  </head>`);
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
