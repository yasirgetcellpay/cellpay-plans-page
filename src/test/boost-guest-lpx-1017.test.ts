// BOOST-GUEST-LPX-1017: owner-requested Boost copy and unchanged-carrier checks.
import { describe, expect, it } from "vitest";
import { goLpxForCarrier, goLpxForRoute } from "../content/goCopy";
import { goAutoPayLine } from "../content/goPage";

const copy = {
  en: {
    h1: "Pay Your Boost Mobile Bill as a Guest",
    subline: "Just your phone number — no login. Pay with debit or credit card.",
    title: "Pay Your Boost Mobile Bill as a Guest | CellPay",
  },
  es: {
    h1: "Pague su factura de Boost como invitado",
    subline: "Solo su número de teléfono, sin iniciar sesión. Tarjeta de débito o crédito.",
    title: "Pague su factura de Boost como invitado | CellPay",
  },
};

describe("BOOST-GUEST-LPX-1017", () => {
  it.each(["en", "es"] as const)("uses the exact %s Boost copy", (lang) => {
    expect(goLpxForCarrier("boost", lang)).toEqual(copy[lang]);
  });

  it.each([
    ["go/boost.html", "en"],
    ["go/boost/index.html", "en"],
    ["es/go/boost.html", "es"],
    ["es/go/boost/index.html", "es"],
  ] as const)("shares headline and subtitle with %s", (route, lang) => {
    expect(goLpxForRoute(route)?.h1).toBe(copy[lang].h1);
    expect(goLpxForRoute(route)?.subline).toBe(copy[lang].subline);
  });

  it.each(["en", "es"] as const)("has no refill wording in %s Boost copy", (lang) => {
    for (const value of Object.values(goLpxForCarrier("boost", lang) ?? {})) {
      expect(value).not.toMatch(/refill|recarg/i);
    }
  });

  it("preserves Metro English copy", () => {
    expect(goLpxForCarrier("metropcs", "en")).toEqual({
      h1: "MetroPCS Bill Payment Online — Pay as a Guest",
      subline: "No login or PIN. Enter the Metro by T-Mobile phone number and pay online with a debit or credit card.",
      title: "Pay Your MetroPCS Bill as a Guest | CellPay",
    });
  });

  it("leaves Tracfone without a copy override", () => {
    expect(goLpxForCarrier("tracfone", "en")).toBeNull();
  });

  it("preserves AT&T English Auto Pay refill wording", () => {
    expect(goAutoPayLine("topup-at", "en")).toContain("refill");
  });

  it("preserves T-Mobile Spanish Auto Pay recarga wording", () => {
    expect(goAutoPayLine("tmobile", "es")).toContain("recarga");
  });
});