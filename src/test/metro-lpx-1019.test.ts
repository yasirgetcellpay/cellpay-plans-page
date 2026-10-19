// METRO-LPX-1019 + METRO-FEECOPY-1019: approved Metro copy and fee wording.
import { describe, expect, it } from "vitest";
import { goLpxForCarrier, goLpxForRoute } from "../content/goCopy";
import { feeCopy1019 } from "../lib/feeCopy1019";

const EN = { h1: "MetroPCS Bill Payment Online — Pay as a Guest", title: "MetroPCS Bill Payment Online — Pay as a Guest | CellPay" };
const ES = { h1: "Pagar Metro PCS en línea con tarjeta, sin cuenta", title: "Pagar Metro PCS en línea como invitado | CellPay" };

describe("METRO-LPX-1019", () => {
  it("metropcs en/es title and h1", () => {
    expect(goLpxForCarrier("metropcs", "en")).toMatchObject(EN);
    expect(goLpxForCarrier("metropcs", "es")).toMatchObject(ES);
  });
  it.each([["go/metro.html", EN], ["go/metro/index.html", EN], ["es/go/metro.html", ES], ["es/go/metro/index.html", ES]] as const)("route %s", (r, want) => {
    expect(goLpxForRoute(r)).toMatchObject(want);
  });
  it.each(["en", "es"] as const)("no refill wording in Metro %s", (lang) => {
    for (const v of Object.values(goLpxForCarrier("metropcs", lang) ?? {})) expect(v).not.toMatch(/refill|recarg/i);
  });
  it("other rows unchanged", () => {
    expect(goLpxForCarrier("tmobile", "en")?.title).toBe("Pay My T-Mobile Bill as a Guest by Phone Number | CellPay");
    expect(goLpxForCarrier("topup-at", "en")?.h1).toBe("Pay Your AT&T Prepaid Bill Without Signing In");
    expect(goLpxForCarrier("boost", "es")?.h1).toBe("Pague su factura de Boost como invitado");
    expect(goLpxForCarrier("topup-crc", "en")?.title).toBe("Pay Your Cricket Bill as a Guest | CellPay");
  });
});

describe("METRO-FEECOPY-1019", () => {
  const en = "Low service fee shown before you pay.";
  const es1 = "Cargo por servicio bajo, mostrado antes de pagar.";
  const es2 = "Cargo por servicio mostrado antes de pagar.";
  it("rewrites Metro EN/ES and Boost ES", () => {
    expect(feeCopy1019("metropcs", "en", en)).toBe("Service fee shown before you pay.");
    expect(feeCopy1019("metropcs", "es", es1)).toBe("La tarifa de servicio se muestra antes de pagar.");
    expect(feeCopy1019("boost", "es", es2)).toBe("La tarifa de servicio se muestra antes de pagar.");
  });
  it("leaves Boost EN, Cricket and T-Mobile unchanged", () => {
    expect(feeCopy1019("boost", "en", en)).toBe(en);
    expect(feeCopy1019("topup-crc", "es", es1)).toBe(es1);
    expect(feeCopy1019("tmobile", "en", en)).toBe(en);
  });
});
