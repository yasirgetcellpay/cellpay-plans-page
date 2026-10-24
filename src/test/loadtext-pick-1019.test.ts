// REFILL-ERROR-MSG-1024: classify supplied replies and recovery actions, with synchronized proxy rules.
import { describe, it, expect } from "vitest";
import { splitLoadText, loadTextPick, loadTextFrom, isCcRefund, pickButtons } from "@/lib/loadTextPick";
import { categorizeLoadText as proxyCategorize, isCcRefundBody } from "../../supabase/functions/_shared/loadTextCategory";
import { readFileSync } from "node:fs";
import ts from "typescript";

const cases = [
  ["Invalid Request | Resource not found", "amount"],
  ["product not sold | invalid phone number", "amount"],
  ["Resource not found | plan does not match", "amount"],
  ["Invalid Amount | invalid number", "number"],
  ["Invalid Amount | Plan does not match", "plan"],
  ["Subscriber not found", "number"],
  ["Invalid Phone Number", "number"],
  ["invalid MIN", "number"],
  ["invalid MDN", "number"],
  ["not a valid subscriber", "number"],
  ["phone number not found with the selected carrier", "number"],
  ["Line suspended", "number"],
  ["Invalid Card | Selected Plan does not match", "plan"],
  ["Customer not eligible", "plan"],
  ["Does not qualify for this offer", "plan"],
  ["Invalid Amount", "amount"],
  ["Product discontinued", "amount"],
  ["Invalid denomination & Invalid Request", "amount"],
  ["refill was completed on this line recently", "cooldown"],
  ["Recent transaction exists", "cooldown"],
  ["Already refilled today", "cooldown"],
  ["Too soon to retry", "cooldown"],
  ["TXN Error: 1065 Invalid transaction state | Invalid Amount", "system"],
  ["Invalid transaction state | Subscriber not found", "number"],
  ["Invalid transaction state | Selected Plan does not match", "plan"],
  ["Invalid transaction state | product not sold", "amount"],
  ["error on params", "system"],
  ["vendor system error", "system"],
  ["Unprocessable Transaction & Timeout", "system"],
  ["Request timed out | Not approved", "system"],
  ["terminal refused", "system"],
  ["Invalid Amount | Timeout", "amount"],
  ["Too soon | Timeout", "cooldown"],
  ["Invalid Request", "generic"],
  ["Invalid Card", "generic"],
  ["Unknown error 42", "generic"],
] as const;

describe("REFILL-ERROR-MSG-1024 categories", () => {
  it.each(cases)("%s -> %s", (text, category) => {
    expect(loadTextPick(text)?.category).toBe(category);
    expect(proxyCategorize(text)).toEqual(loadTextPick(text));
  });
  it("splits vendor parts and leaves Invalid Card unknown, not number", () => {
    expect(splitLoadText("Invalid Card | Selected Plan does not match & Timeout")).toEqual(["Invalid Card", "Selected Plan does not match", "Timeout"]);
    expect(loadTextPick("Invalid Card | Selected Plan does not match")?.unknownParts).toEqual(["Invalid Card"]);
  });
  it("missing/blank LoadText preserves the generic fallback", () => {
    for (const value of [null, "", "  |  "]) expect(loadTextPick(value)).toBeNull();
  });
  it("reads reply.load_text before nested LoadText", () => {
    expect(loadTextFrom({ load_text: "Invalid Amount", data: { LoadText: "Subscriber not found" } })).toBe("Invalid Amount");
    expect(loadTextFrom({ data: { data: { LoadText: "Timeout" } } })).toBe("Timeout");
  });
  it("keeps auto-refund detection unchanged", () => {
    for (const reply of [{ data: { TransResult: "ccRefund" } }, { data: { data: { transresult: "CCREFUND" } } }]) {
      expect(isCcRefund(reply)).toBe(true);
      expect(isCcRefundBody(reply)).toBe(true);
    }
    expect(isCcRefund({ TransResult: "OK" })).toBe(false);
  });
});

describe("REFILL-ERROR-MSG-1024 recovery actions", () => {
  it.each([
    ["number", ["number", "other_carrier"]],
    ["plan", ["plan"]],
    ["amount", ["amount"]],
    ["cooldown", ["ok"]],
    ["system", ["try_again"]],
    ["generic", ["try_again"]],
  ] as const)("%s recovery", (category, actions) => {
    for (const lang of ["en", "es"]) expect(pickButtons(category, lang)?.map((button) => button.action)).toEqual(actions);
  });
});

describe("REFILL-ERROR-MSG-1024 analytics isolation", () => {
  const source = readFileSync("src/pages/Checkout.tsx", "utf8");
  const helpers = source.slice(source.indexOf("const refillErrorEvent ="), source.indexOf("const setPurchasePending ="));
  const compiled = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = (stored: string | null, throwing = false) => {
    const events: unknown[] = [];
    let removed = false;
    const storage = { getItem: () => stored, removeItem: () => { removed = true; } };
    const window = { dataLayer: { push: (event: unknown) => { if (throwing) throw Error("analytics unavailable"); events.push(event); } } };
    new Function("window", "sessionStorage", compiled + "; refillErrorRetrySuccess();")(window, storage);
    return { events, removed };
  };
  it("fires the previous shown category/carrier and clears the same-session flag", () => {
    expect(run(JSON.stringify({ category: "system", carrier: "s1" }))).toEqual({ events: [{ event: "refill_error_retry_success", category: "system", carrier: "s1" }], removed: true });
    expect(run(null)).toEqual({ events: [], removed: false });
  });
  it("analytics/storage errors never throw into the payment flow", () => {
    expect(() => run(JSON.stringify({ category: "amount", carrier: "s1" }), true)).not.toThrow();
    expect(() => run("bad JSON")).not.toThrow();
  });
});
