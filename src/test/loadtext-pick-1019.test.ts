// LOADTEXT-PICK-1019: LoadText picker (categories, EN/ES text, Metro/Boost/Cricket wording, unknown text, buttons, proxy copy in sync).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript"; // REFILL-ERROR-MSG-1024
import { splitLoadText, loadTextPick, loadTextFrom, isCcRefund, pickReasonText, pickFullText, pickRefundLine, pickButtons, isPayWordCarrier } from "@/lib/loadTextPick";
import { categorizeLoadText as proxyCategorize, isCcRefundBody } from "../../supabase/functions/_shared/loadTextCategory";

const EXAMPLE = "Invalid Request | Invalid Request & Unprocessable Transaction | Resource not found";
const RAW = { Result: "Error", TransResult: "ccRefund", LoadText: EXAMPLE };

 describe("LOADTEXT-PICK-1019 split + categories", () => {
  it("splits the example on ' | ' and ' & '", () => {
    expect(splitLoadText(EXAMPLE)).toEqual(["Invalid Request", "Invalid Request", "Unprocessable Transaction", "Resource not found"]);
  });
  it("example -> amount problem (most specific wins), no unknown parts", () => {
    const p = loadTextPick(EXAMPLE);
    expect(p?.category).toBe("amount");
    expect(p?.unknown).toBe(false);
  });
  it.each([
    ["product not sold | invalid phone number", "amount"], // REFILL-ERROR-MSG-1024
    ["Resource not found | Selected Plan does not match", "amount"],
    ["Invalid Amount | invalid phone number", "number"],
    ["TXN Error: 1065 Invalid transaction state | Invalid Amount", "system"],
    ["Invalid transaction state | Subscriber not found", "number"],
    ["Invalid transaction state | Selected Plan does not match", "plan"],
    ["Invalid Card | Selected Plan does not match", "plan"],
    ["Invalid Card", "generic"],
    ["error on params", "system"],
    ["vendor system error", "system"],
    ["terminal refused", "system"],
    ["refill was completed on this line recently", "cooldown"],
    ["Invalid Amount | Timeout", "amount"],
    ["Too soon | Timeout", "cooldown"],
    ["Invalid Request | Resource not found", "amount"],
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
    ["Unprocessable Transaction & Timeout", "system"],
    ["Request timed out | Not approved", "system"],
    ["Invalid Amount | Plan does not match | Too soon", "plan"],
    ["Recent | Invalid Amount", "amount"],
    ["RESOURCE NOT FOUND | too soon", "amount"],
  ])("%s -> %s", (text, cat) => {
    expect(loadTextPick(text)?.category).toBe(cat);
    expect(proxyCategorize(text)).toEqual(loadTextPick(text)); // REFILL-ERROR-MSG-1024
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

 describe("LOADTEXT-PICK-1019 buttons", () => {
  const s1Base = [{ label: "Straight Talk", action: "to_carrier", to_carrier: "straight-talk" }, { label: "Total Wireless", action: "to_carrier", to_carrier: "total-wireless" }, { label: "Change number", action: "number" }];
  it("number -> edit number first, then carrier switches (or choose another carrier)", () => {
    expect(pickButtons("number", "en", s1Base)?.map((b) => b.action)).toEqual(["number", "other_carrier"]);
    expect(pickButtons("number", "en", [])?.map((b) => b.action)).toEqual(["number", "other_carrier"]);
    expect(pickButtons("number", "es", [])?.[0].label).toBe("Corregir número");
  });
  it("plan -> existing plan/amount list action", () => {
    expect(pickButtons("plan", "en", s1Base)?.map((b) => b.action)).toEqual(["amount"]);
    expect(pickButtons("plan", "en", [])?.map((b) => b.action)).toEqual(["amount"]);
  });
  it("amount -> pick another amount first", () => {
    expect(pickButtons("amount", "en", s1Base)?.map((b) => b.action)).toEqual(["amount"]);
    expect(pickButtons("amount", "es", [])?.[0].label).toBe("Elegir otro monto");
  });
  it("cooldown -> no immediate retry", () => {
    const b = pickButtons("cooldown", "en", s1Base);
    expect(b?.map((x) => x.action)).toEqual(["ok"]);
    expect(b?.some((x) => /try again/i.test(x.label))).toBe(false);
  });
  it("system -> manual existing retry action", () => { // REFILL-ERROR-MSG-1024
    expect(pickButtons("system", "en", s1Base)?.map((b) => b.action)).toEqual(["try_again"]);
  });
  it("generic -> null (existing buttons kept)", () => {
    expect(pickButtons("generic", "en", s1Base)).toBeNull();
    expect(pickButtons("generic", "es", [])).toBeNull(); // REFILL-ERROR-MSG-1024
  });
});

// REFILL-ERROR-MSG-1024: concrete no-LoadText/generic fallback and analytics behavior.
describe("REFILL-ERROR-MSG-1024 generic recovery and session analytics", () => {
  it("no/unknown LoadText keeps the existing cause-button fallback", () => {
    for (const text of [null, "", "Invalid Card", "unknown vendor response"]) {
      const pick = loadTextPick(text);
      expect(pick ? pickButtons(pick.category, "en") : null).toBeNull();
    }
  });
  const source = readFileSync("src/pages/Checkout.tsx", "utf8");
  const helpers = source.slice(source.indexOf("const refillErrorEvent ="), source.indexOf("const setPurchasePending ="));
  const compiled = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  it("tracks previous category/carrier once then clears the session flag", () => {
    const events: unknown[] = [];
    let stored: string | null = JSON.stringify({ category: "system", carrier: "s1" });
    const window = { dataLayer: events };
    const storage = { getItem: () => stored, removeItem: () => { stored = null; } };
    new Function("window", "sessionStorage", compiled + "; refillErrorRetrySuccess(); refillErrorRetrySuccess();")(window, storage);
    expect(events).toEqual([{ event: "refill_error_retry_success", category: "system", carrier: "s1" }]);
    expect(stored).toBeNull();
  });
  it("analytics failure cannot throw into checkout", () => {
    const window = { dataLayer: { push: () => { throw Error("blocked"); } } };
    const storage = { getItem: () => JSON.stringify({ category: "amount", carrier: "s1" }), removeItem: () => {} };
    expect(() => new Function("window", "sessionStorage", compiled + "; refillErrorRetrySuccess();")(window, storage)).not.toThrow();
  });
});
