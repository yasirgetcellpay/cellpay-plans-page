import { describe, it, expect, beforeEach } from "vitest";
import { applySeoHead } from "@/lib/seo";

const EXPECTED_ORIGIN = "https://refill.cellpay.us";

// Every plans / carrier route the app serves (kept in sync with src/App.tsx).
const PLANS_ROUTES: string[] = [
  // English carrier pages
  "/s1.html",
  "/topup-crc.html",
  "/metropcs.html",
  "/metro-pcs.html",
  "/tmobile-flexi.html",
  "/topup-at.html",
  "/verizon",
  "/boost.html",
  "/h2o.html",
  "/lyca.html",
  "/net10.html",
  "/pageplus.html",
  "/tracfone.html",
  "/ultra-mobile.html",
  "/pageplus-addon",
  "/red-pocket",
  "/total-wireless",
  "/xbox",
  // Static carrier pages
  "/straight-talk.html",
  "/us-cellular.html",
  "/verizon-wireless-flexi.html",
  "/att-firstnet",
  // Legacy/alt landing routes
  "/red-pocket-mobile.html",
  "/h2o-wireless",
  // Spanish mirrors (sample)
  "/es/s1.html",
  "/es/verizon",
  "/es/att-firstnet",
  "/es/red-pocket-mobile.html",
];

function resetHead() {
  document.head.innerHTML = "";
  document.title = "";
}

describe("SEO head on plans pages", () => {
  beforeEach(resetHead);

  it.each(PLANS_ROUTES)("sets a self-referencing canonical + OG metadata for %s", (path) => {
    const title = `Test title for ${path}`;
    const description = `Test description for ${path}`;

    applySeoHead({ title, description, path });

    const expectedUrl = `${EXPECTED_ORIGIN}${path}`;

    // <title>
    expect(document.title).toBe(title);

    // Canonical: exactly one, absolute, project domain, route-specific
    const canonicals = document.head.querySelectorAll('link[rel="canonical"]');
    expect(canonicals).toHaveLength(1);
    const canonicalHref = canonicals[0].getAttribute("href");
    expect(canonicalHref).toBe(expectedUrl);
    expect(canonicalHref!.startsWith("https://")).toBe(true);

    // og:url matches canonical
    const ogUrl = document.head.querySelector('meta[property="og:url"]');
    expect(ogUrl?.getAttribute("content")).toBe(expectedUrl);

    // og:title / og:description present and correct
    expect(
      document.head.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    ).toBe(title);
    expect(
      document.head.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    ).toBe(description);

    // twitter mirrors
    expect(
      document.head.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
    ).toBe(title);
    expect(
      document.head.querySelector('meta[name="twitter:description"]')?.getAttribute("content"),
    ).toBe(description);

    // meta description
    expect(
      document.head.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toBe(description);
  });

  it("is idempotent — repeat calls do not duplicate canonical/OG tags", () => {
    const path = "/s1.html";
    applySeoHead({ title: "A", description: "a", path });
    applySeoHead({ title: "B", description: "b", path });

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);

    // Latest values win
    expect(document.title).toBe("B");
    expect(
      document.head.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    ).toBe("B");
  });

  it("falls back to window.location.pathname when path is omitted", () => {
    window.history.pushState({}, "", "/verizon");
    applySeoHead({ title: "T", description: "D" });
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(`${EXPECTED_ORIGIN}/verizon`);
  });
});
