// LPX-1017: owner-requested copy checks; no payment, catalog or routing behavior changes.
import { describe, expect, it } from "vitest";
import { goFaqList, goAutoPayLine, goKeywordsFor } from "../content/goPage";
import { goLpxForCarrier } from "../content/goCopy";

describe("LPX-1017", () => {
  for (const slug of ["metropcs", "boost", "topup-crc"]) {
    it.each(["en", "es"] as const)(`${slug} %s FAQs use payment wording`, (lang) => {
      expect(JSON.stringify(goFaqList(slug, lang))).not.toMatch(/refill|recarg/i);
    });
  }
  it("keeps Tracfone refill FAQs", () => {
    expect(JSON.stringify(goFaqList("tracfone", "en"))).toContain("refill");
  });
  it("uses payment in Boost's first Auto Pay sentence", () => {
    expect(goAutoPayLine("boost", "en").split(". ")[0] + ".").toMatch(/payment\.$/);
  });
  it("keeps refill in Tracfone's first Auto Pay sentence", () => {
    expect(goAutoPayLine("tracfone", "en").split(". ")[0] + ".").toMatch(/refill\.$/);
  });
  it.each(["boost", "tracfone"])("%s Spanish Auto Pay uses usted", (slug) => {
    expect(goAutoPayLine(slug, "es")).toContain("lo marque o llegue");
  });
  it("sets Metro's English headline and title", () => {
    const copy = goLpxForCarrier("metropcs", "en");
    expect(copy?.h1).toContain("MetroPCS Bill Payment Online");
    expect(copy?.title).toBe("MetroPCS Bill Payment Online — Pay as a Guest | CellPay"); // METRO-LPX-1019
  });
  it("sets Metro's Spanish headline", () => {
    expect(goLpxForCarrier("metropcs", "es")?.h1?.startsWith("Pagar Metro PCS en línea")).toBe(true); // METRO-LPX-1019
  });
  it("sets Cricket's Spanish headline and debit-card subline", () => {
    const copy = goLpxForCarrier("topup-crc", "es");
    expect(copy?.h1?.startsWith("Pagar Cricket por teléfono")).toBe(true);
    expect(copy?.subline).toContain("Tarjeta de débito");
  });
  it("sets T-Mobile's Spanish headline", () => {
    expect(goLpxForCarrier("tmobile", "es")?.h1).toBe("Pague su factura de T-Mobile sin iniciar sesión"); // TMO-ATT-LPX-1018
  });
  it("sets T-Mobile's English subline and preserves its derived title", () => {
    const copy = goLpxForCarrier("tmobile", "en");
    expect(copy?.subline).toBe("T-Mobile Prepaid refill or bill pay with just the phone number, without signing in. Pay for yourself or someone else with a debit or credit card."); // TMO-ATT-LPX-1018
    expect(copy?.title).toBe("Pay My T-Mobile Prepaid Bill or Refill as a Guest | CellPay"); // TMO-ATT-LPX-1018
  });
  it("sets AT&T's English guest-pay subline", () => {
    expect(goLpxForCarrier("topup-at", "en")?.subline.startsWith("AT&T Prepaid (ATT) guest pay")).toBe(true);
  });
  it("Boost keywords do not say refill", () => {
    expect(goKeywordsFor("boost", "en")).toBeDefined();
    expect(goKeywordsFor("boost", "en")).not.toContain("refill");
  });
  it("leaves Tracfone keywords unchanged", () => {
    expect(goKeywordsFor("tracfone", "en")).toBeUndefined();
  });
});