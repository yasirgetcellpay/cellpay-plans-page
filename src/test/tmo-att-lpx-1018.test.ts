// TMO-ATT-LPX-1018: T-Mobile lander copy, AT&T/other carriers unchanged, keywords.
import { describe, expect, it } from "vitest";
import { goLpxForCarrier, goLpxForRoute, goSublineFor } from "../content/goCopy";
import { goKeywordsFor } from "../content/goPage";

const tmo = {
  en: {
    h1: "Pay Your T-Mobile Prepaid Bill as a Guest",
    subline: "T-Mobile Prepaid refill or bill pay with just the phone number, without signing in. Pay for yourself or someone else with a debit or credit card.",
    title: "Pay My T-Mobile Prepaid Bill or Refill as a Guest | CellPay",
  },
  es: {
    h1: "Pague su factura de T-Mobile sin iniciar sesión",
    subline: "Pague el teléfono T-Mobile como invitado: solo su número, sin cuenta. Tarjeta de débito o crédito.",
    title: "Pagar factura de T-Mobile en línea | CellPay",
  },
};
const descs = [
  "Pay your T-Mobile bill as a guest with just the phone number. No sign-in, no account. Debit or credit card. Service fee shown before you pay.",
  "Pague su factura de T-Mobile en línea como invitado. Solo el número de teléfono, sin iniciar sesión. Tarjeta de débito o crédito. Cargo por servicio mostrado antes de pagar.",
  "Pay your AT&T Prepaid bill online as a guest. Just the phone number, pick the amount, pay. Service fee shown before you pay.",
];
const kw = {
  tmobile: {
    en: "T-Mobile pay bill, pay my T-Mobile bill, pay T-Mobile bill as guest, pay T-Mobile with phone number, pay T-Mobile without signing in",
    es: "pagar T-Mobile, pagar factura de T-Mobile, pagar el teléfono T-Mobile, pagar T-Mobile sin cuenta",
  },
  "topup-at": {
    en: "AT&T Prepaid pay bill, pay AT&T bill, ATT prepaid pay bill, pay AT&T Prepaid as guest, AT&T pay my bill prepaid",
    es: "pagar AT&T Prepago, pagar factura de AT&T, pago de AT&T Prepago sin cuenta",
  },
};

describe("TMO-ATT-LPX-1018", () => {
  it.each(["en", "es"] as const)("T-Mobile %s copy", (lang) => {
    expect(goLpxForCarrier("tmobile", lang)).toEqual(tmo[lang]);
  });

  it.each([
    ["go/tmobile.html", "en"], ["go/tmobile/index.html", "en"],
    ["es/go/tmobile.html", "es"], ["es/go/tmobile/index.html", "es"],
  ] as const)("route %s", (route, lang) => {
    expect(goLpxForRoute(route)?.h1).toBe(tmo[lang].h1);
    expect(goLpxForRoute(route)?.subline).toBe(tmo[lang].subline);
  });

  it("AT&T copy unchanged", () => {
    expect(goLpxForCarrier("topup-at", "en")).toEqual({
      h1: "Pay Your AT&T Prepaid Bill Without Signing In",
      subline: "AT&T Prepaid (ATT) guest pay by phone number: no login. Debit or credit card.",
      title: "Pay Your AT&T Prepaid Bill Without Signing In | CellPay",
    });
    expect(goLpxForCarrier("topup-at", "es")).toEqual({
      h1: "Pague su factura de AT&T Prepago sin iniciar sesión",
      subline: goSublineFor("AT&T", "es"),
      title: "Pague su factura de AT&T Prepago sin iniciar sesión | CellPay",
    });
  });

  it.each(["tmobile", "topup-at"] as const)("keywords for %s", (slug) => {
    expect(goKeywordsFor(slug, "en")).toBe(kw[slug].en);
    expect(goKeywordsFor(slug, "es")).toBe(kw[slug].es);
  });

  it("other keywords unchanged", () => {
    expect(goKeywordsFor("metropcs", "en")).toContain("MetroPCS pay bill");
    expect(goKeywordsFor("boost", "en")).toContain("Boost Mobile pay bill");
    expect(goKeywordsFor("topup-crc", "en")).toContain("Cricket pay bill");
  });

  it("Boost and Metro unchanged", () => {
    expect(goLpxForCarrier("boost", "en")?.h1).toBe("Pay Your Boost Mobile Bill as a Guest");
    expect(goLpxForCarrier("metropcs", "en")?.h1).toBe("MetroPCS Bill Payment Online — Pay as a Guest");
  });

  it("no refill wording", () => {
    const all = [...Object.values(tmo.en), ...Object.values(tmo.es), ...descs, kw.tmobile.en, kw.tmobile.es, kw["topup-at"].en, kw["topup-at"].es];
    for (const s of all) expect(s).not.toMatch(/refill|recarg/i);
  });
});
