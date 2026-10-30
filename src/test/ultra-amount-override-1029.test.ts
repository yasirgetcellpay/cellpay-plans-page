import { describe, expect, it } from "vitest"; // ULTRA-BPATH-FIX-1029
import { pickUltraOverride } from "@/pages/DynamicCarrier"; // ULTRA-BPATH-FIX-1029
describe("Ultra number-specific amount selection", () => { // ULTRA-BPATH-FIX-1029
  it("prompts instead of changing catalog 29 to the single fixed amount 26", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(29, [{ amount: 26 }], [], "plan")).toEqual({ kind: "pick" }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("keeps an exact fixed amount of 26", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(26, [{ amount: 26 }], [], "plan")).toEqual({ kind: "match", plan: { amount: 26 }, amount: 26 }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("keeps 30 in the number's 10–100 range", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(30, [], [{ rangeMin: 10, rangeMax: 100 }], "custom")).toEqual({ kind: "range", plan: { rangeMin: 10, rangeMax: 100 }, amount: 30 }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("requires a pick for 29 when fixed amounts are 19 and 26", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(29, [{ amount: 19 }, { amount: 26 }], [], "plan")).toEqual({ kind: "pick" }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("returns none for an empty lookup", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(29, [], [], "plan")).toEqual({ kind: "none" }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("prefers an eligible range over a fixed amount override", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(30, [{ amount: 26 }], [{ rangeMin: 10, rangeMax: 100 }], "custom")).toMatchObject({ kind: "range", amount: 30 }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("includes both range boundaries", () => { // ULTRA-BPATH-FIX-1029
    for (const sel of [10, 100]) expect(pickUltraOverride(sel, [], [{ rangeMin: 10, rangeMax: 100 }], "custom")).toMatchObject({ kind: "range", amount: sel }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("prompts for plan-mode 29 even with a 10–100 wallet range", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(29, [{ amount: 26 }], [{ rangeMin: 10, rangeMax: 100 }], "plan")).toEqual({ kind: "pick" }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("does not require a pick when multiple fixed entries have no usable amounts", () => { // ULTRA-BPATH-FIX-1029
    expect(pickUltraOverride(29, [{ amount: 0 }, { amount: NaN }], [], "plan")).toEqual({ kind: "none" }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
}); // ULTRA-BPATH-FIX-1029