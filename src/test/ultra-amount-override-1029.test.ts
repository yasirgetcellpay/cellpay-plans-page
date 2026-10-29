import { describe, expect, it } from "vitest"; // ULTRA-AMOUNT-OVERRIDE-1029
import { pickUltraOverride } from "@/pages/DynamicCarrier"; // ULTRA-AMOUNT-OVERRIDE-1029
describe("Ultra number-specific amount selection", () => { // ULTRA-AMOUNT-OVERRIDE-1029
  it("overrides catalog 29 with the single fixed amount 26", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    expect(pickUltraOverride(29, [{ amount: 26 }], [])).toEqual({ kind: "override", plan: { amount: 26 }, amount: 26 }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
  it("keeps an exact fixed amount of 26", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    expect(pickUltraOverride(26, [{ amount: 26 }], [])).toEqual({ kind: "match", plan: { amount: 26 }, amount: 26 }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
  it("keeps 30 in the number's 10–100 range", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    expect(pickUltraOverride(30, [], [{ rangeMin: 10, rangeMax: 100 }])).toEqual({ kind: "range", plan: { rangeMin: 10, rangeMax: 100 }, amount: 30 }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
  it("requires a pick for 29 when fixed amounts are 19 and 26", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    expect(pickUltraOverride(29, [{ amount: 19 }, { amount: 26 }], [])).toEqual({ kind: "pick" }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
  it("leaves the catalog path for an empty lookup", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    expect(pickUltraOverride(29, [], [])).toEqual({ kind: "none" }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
  it("prefers an eligible range over a fixed amount override", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    expect(pickUltraOverride(30, [{ amount: 26 }], [{ rangeMin: 10, rangeMax: 100 }])).toMatchObject({ kind: "range", amount: 30 }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
  it("includes both range boundaries", () => { // ULTRA-AMOUNT-OVERRIDE-1029
    for (const sel of [10, 100]) expect(pickUltraOverride(sel, [], [{ rangeMin: 10, rangeMax: 100 }])).toMatchObject({ kind: "range", amount: sel }); // ULTRA-AMOUNT-OVERRIDE-1029
  }); // ULTRA-AMOUNT-OVERRIDE-1029
}); // ULTRA-AMOUNT-OVERRIDE-1029