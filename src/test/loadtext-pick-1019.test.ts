// LOADTEXT-PICK-1019: LoadText picker (categories, EN/ES text, Metro/Boost/Cricket wording, unknown text, buttons, proxy copy in sync).
import { describe, it, expect } from "vitest";
import { splitLoadText, loadTextPick, loadTextFrom, isCcRefund, pickReasonText, pickFullText, pickRefundLine, pickButtons, isPayWordCarrier } from "@/lib/loadTextPick";
import { categorizeLoadText as proxyCategorize, isCcRefundBody } from "../../supabase/functions/_shared/loadTextCategory";

const EXAMPLE = "Invalid Request | Invalid Request & Unprocessable Transaction | Resource not found";
const RAW = { Result: "Error", TransResult: "ccRefund", LoadText: EXAMPLE };

 describe("LOADTEXT-PICK-1019 split + categories", () => {
  it("splits the example on ' | ' and ' & '", () => {
    expect(splitLoadText(EXAMPLE)).toEqual(["Invalid Request", "Invalid Request", "Unprocessable Transaction", "Resource not found"]);
  });
  it("example -> number problem (most specific wins), no unknown parts", () => {
    const p = loadTextPick(EXAMPLE);
    expect(p?.category).toBe("number");
    expect(p?.unknown).toBe(false);
  });
  it.each([
    ["Invalid Request | Resource not found", "number"],
    ["invalid number", "number"],
    ["Invalid Phone Number", "number"],
    ["This is not a valid subscriber", "number"],
    ["Line suspended", "number"],
    ["Subscriber Not Found", "number"],
    ["Unprocessable Transaction | Plan does not match", "plan"],
    ["Customer not eligible", "plan"],
    ["Does not qualify for this offer", "plan"],
    ["Invalid Amount", "amount"],
    ["Product discontinued", "amount"],
    ["Invalid denomination & Invalid Request", "amount"],
    ["Recent transaction exists", "cooldown"],
    ["Already refilled today", "cooldown"],
    ["Too soon to retry", "cooldown"],
    ["Invalid Request", "generic"],
    ["Unprocessable Transaction & Timeout", "generic"],
    ["Request timed out | Not approved", "generic"],
    ["Invalid Amount | Plan does not match | Too soon", "plan"],
    ["Recent | Invalid Amount", "amount"],
    ["RESOURCE NOT FOUND | too soon", "number"],
  ])("%s -> %s", (text, cat) => {
    expect(loadTextPick(text)?.category).toBe(cat);
  });
  it("unknown text -> generic bucket, flagged unknown with the part kept for logging", () => {
    const p = loadTextPick("Zorblax failure 42 | Invalid Request");
    expect(p?.category).toBe("generic");
    expect(p?.unknown).toBe(true);
    expect(p?.unknownParts).toEqual(["Zorblax failure 42"]);
  });
  it("unknown part next to a specific one: specific shown, unknown part still logged", () => {
    const p = loadTextPick("Weird thing | Invalid Amount");
    expect(p?.category).toBe("amount");
    expect(p?.unknownParts).toEqual(["Weird thing"]);
  });
  it("empty / missing LoadText -> null (existing refund card unchanged)", () => {
    expect(loadTextPick("")).toBeNull();
    expect(loadTextPick("  |  ")).toBeNull();
    expect(loadTextPick(null)).toBeNull();
  });
  it("proxy copy gives identical results", () => {
    for (const t of [EXAMPLE, "Invalid Amount", "Too soon", "Plan does not match & x", "Zorblax", "Invalid Request", "Line suspended | Invalid Amount"]) {
      expect(proxyCategorize(t)).toEqual(loadTextPick(t));
    }
  });
});

 describe("LOADTEXT-PICK-1019 reply parsing", () => {
  it("reads load_text set by the proxy, and LoadText nested in data / data.data", () => {
    expect(loadTextFrom({ success: true, data: { status: false }, load_text: EXAMPLE })).toBe(EXAMPLE);
    expect(loadTextFrom({ success: true, data: RAW })).toBe(EXAMPLE);
    expect(loadTextFrom({ success: true, data: { success: true, data: { status: false, ...RAW } } })).toBe(EXAMPLE);
    expect(loadTextFrom({ success: true, data: { status: false, message: "x" } })).toBeNull();
  });
  it("detects TransResult ccRefund (client and proxy)", () => {
    expect(isCcRefund({ success: true, data: RAW })).toBe(true);
    expect(isCcRefund({ success: true, data: { data: { transresult: "CCREFUND" } } })).toBe(true);
    expect(isCcRefund({ success: true, data: { TransResult: "OK" } })).toBe(false);
    expect(isCcRefundBody(RAW)).toBe(true);
    expect(isCcRefundBody({ data: { TransResult: "ok" } })).toBe(false);
  });
});

 describe("LOADTEXT-PICK-1019 customer text", () => {
  const all = ["number", "plan", "amount", "cooldown", "generic"] as const;
  it("EN texts", () => {
    expect(pickReasonText("number", "en", "Simple Mobile", "s1")).toBe("We couldn't find this number with Simple Mobile. Please double-check the number and carrier.");
    expect(pickReasonText("plan", "en", "T-Mobile", "tmobile")).toBe("This number is on a different plan type. Please check you picked the right carrier/plan.");
    expect(pickReasonText("amount", "en", "Ultra Mobile", "ultra")).toBe("This amount isn't available right now. Please try a different amount.");
    expect(pickReasonText("cooldown", "en", "Simple Mobile", "s1")).toBe("This number was just refilled. Please try again later.");
    expect(pickReasonText("generic", "en", "Simple Mobile", "s1")).toBe("Your refill didn't go through. Please check the number and plan and try again.");
    expect(pickReasonText("generic", "en", "Simple Mobile", "s1", "Carrier-specific reason.")).toBe("Carrier-specific reason.");
  });
  it("ES texts use usted", () => {
    expect(pickReasonText("number", "es", "Simple Mobile", "s1")).toBe("No encontramos este número con Simple Mobile. Verifique el número y la compañía.");
    expect(pickReasonText("plan", "es", "T-Mobile", "tmobile")).toBe("Este número tiene otro tipo de plan. Verifique que eligió la compañía y el plan correctos.");
    expect(pickReasonText("amount", "es", "Ultra Mobile", "ultra")).toBe("Este monto no está disponible en este momento. Elija otro monto.");
    expect(pickReasonText("cooldown", "es", "Simple Mobile", "s1")).toBe("Este número acaba de recibir una recarga. Inténtelo de nuevo más tarde.");
    for (const c of all) expect(pickFullText(c, "es", "Simple Mobile", "s1")).not.toMatch(/\btú\b|\btu\b|cualquier/i);
  });
  it("always appends the refund line", () => {
    for (const c of all) {
      expect(pickFullText(c, "en", "Simple Mobile", "s1").endsWith("You have not been charged. Your payment was refunded.")).toBe(true);
      expect(pickFullText(c, "es", "Simple Mobile", "s1").endsWith("No se le ha cobrado. Su pago fue reembolsado.")).toBe(true);
    }
    expect(pickRefundLine("en")).toBe("You have not been charged. Your payment was refunded.");
  });
  it("Metro, Boost and Cricket never say refill / recarga", () => {
    for (const [slug, name] of [["metropcs", "Metro by T-Mobile"], ["boost", "Boost Mobile"], ["cricket", "Cricket Wireless"]]) {
      expect(isPayWordCarrier(slug, name)).toBe(true);
      for (const c of all) for (const l of ["en", "es"]) {
        const s = pickFullText(c, l, name, slug);
        expect(s).not.toMatch(/refill|recarga/i);
      }
      expect(pickReasonText("cooldown", "en", name, slug)).toBe("A payment was just made on this number. Please try again later.");
      expect(pickReasonText("cooldown", "es", name, slug)).toBe("Se acaba de hacer un pago en este número. Inténtelo de nuevo más tarde.");
      expect(pickReasonText("generic", "en", name, slug)).toBe("Your payment didn't go through. Please check the number and plan and try again.");
    }
  });
  it("never shows raw LoadText or a provider name", () => {
    for (const c of all) for (const l of ["en", "es"]) {
      const s = pickFullText(c, l, "Simple Mobile", "s1");
      expect(s).not.toMatch(/cell\s*pay|invalid request|unprocessable|resource not found|ccrefund|pay cell/i);
    }
  });
  it("empty carrier name falls back to a neutral word", () => {
    expect(pickReasonText("number", "en", "", "x")).toContain("with your carrier.");
    expect(pickReasonText("number", "es", "", "x")).toContain("con su compañía.");
  });
});

 describe("LOADTEXT-PICK-1019 buttons", () => {
  const s1Base = [{ label: "Straight Talk", action: "to_carrier", to_carrier: "straight-talk" }, { label: "Total Wireless", action: "to_carrier", to_carrier: "total-wireless" }, { label: "Change number", action: "number" }];
  it("number -> edit number first, then carrier switches (or choose another carrier)", () => {
    expect(pickButtons("number", "en", s1Base)?.map((b) => b.action)).toEqual(["number", "to_carrier", "to_carrier"]);
    expect(pickButtons("number", "en", [])?.map((b) => b.action)).toEqual(["number", "other_carrier"]);
    expect(pickButtons("number", "es", [])?.[0].label).toBe("Corregir número");
  });
  it("plan -> switch carrier first", () => {
    expect(pickButtons("plan", "en", s1Base)?.map((b) => b.action)).toEqual(["to_carrier", "to_carrier", "number"]);
    expect(pickButtons("plan", "en", [])?.map((b) => b.action)).toEqual(["other_carrier", "number"]);
  });
  it("amount -> pick another amount first", () => {
    expect(pickButtons("amount", "en", s1Base)?.map((b) => b.action)).toEqual(["amount", "number"]);
    expect(pickButtons("amount", "es", [])?.[0].label).toBe("Elegir otro monto");
  });
  it("cooldown -> no immediate retry", () => {
    const b = pickButtons("cooldown", "en", s1Base);
    expect(b?.map((x) => x.action)).toEqual(["ok"]);
    expect(b?.some((x) => /try again/i.test(x.label))).toBe(false);
  });
  it("generic -> null (existing buttons kept)", () => {
    expect(pickButtons("generic", "en", s1Base)).toBeNull();
  });
});
