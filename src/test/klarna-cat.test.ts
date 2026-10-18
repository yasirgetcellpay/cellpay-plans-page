import { describe, it, expect, vi } from "vitest"; // KLARNA-CAT-1017
import { readFileSync } from "node:fs"; // KLARNA-CAT-1017
import ts from "typescript"; // KLARNA-CAT-1017
import { klarnaCategoryIds, pickKlarnaCategory, klarnaLocale } from "@/lib/klarnaCategory"; // KLARNA-CAT-1017
const page = readFileSync("src/pages/Checkout.tsx", "utf8"); // KLARNA-CAT-1017
const promiseStart = page.indexOf("    return new Promise<void>((resolve) => {", page.indexOf("  const handleKlarna = async")); // KLARNA-CAT-1017
const promiseEnd = page.indexOf("\n  };", promiseStart); // KLARNA-CAT-1017
const promiseJS = ts.transpile(page.slice(promiseStart, promiseEnd), { target: ts.ScriptTarget.ES2022 }); // KLARNA-CAT-1017
describe("KLARNA-CAT-1017", () => { // KLARNA-CAT-1017
  it("reads only valid identifiers in session order, capped at five", () => { // KLARNA-CAT-1017
    expect(klarnaCategoryIds({ payment_method_categories: [{ identifier: "pay_now" }, { identifier: "pay_over_time" }] })).toEqual(["pay_now", "pay_over_time"]); // KLARNA-CAT-1017
    for (const value of [null, undefined, {}, { payment_method_categories: "pay_now" }]) expect(klarnaCategoryIds(value)).toEqual([]); // KLARNA-CAT-1017
    expect(klarnaCategoryIds({ payment_method_categories: [null, {}, { identifier: 12 }, { identifier: "Pay_now" }, { identifier: "pay-now" }, { identifier: "a".repeat(31) }, { identifier: "pay_later" }] })).toEqual(["pay_later"]); // KLARNA-CAT-1017
    expect(klarnaCategoryIds({ payment_method_categories: Array.from({ length: 6 }, () => ({ identifier: "pay_now" })) })).toHaveLength(5); // KLARNA-CAT-1017
  }); // KLARNA-CAT-1017
  it.each([[ ["pay_now", "pay_over_time"], "pay_over_time" ], [ ["pay_later", "pay_now"], "pay_later" ], [ ["pay_now"], "pay_now" ], [ [], "pay_over_time" ]])("selects the offered category %j", (ids, expected) => { // KLARNA-CAT-1017
    expect(pickKlarnaCategory(ids as string[])).toBe(expected); // KLARNA-CAT-1017
  }); // KLARNA-CAT-1017
  it("uses US English or Spanish locale", () => { // KLARNA-CAT-1017
    expect(klarnaLocale("es")).toBe("es-US"); expect(klarnaLocale("en")).toBe("en-US"); // KLARNA-CAT-1017
  }); // KLARNA-CAT-1017
  it.each(["ok", "no_form", "error", "throw", "timeout"])("loads before authorizing exactly once: %s", async (mode) => { // KLARNA-CAT-1017
    vi.useFakeTimers(); // KLARNA-CAT-1017
    try { // KLARNA-CAT-1017
      let late: ((res: unknown) => void) | undefined; // KLARNA-CAT-1017
      const events: unknown[][] = []; // KLARNA-CAT-1017
      const authorize = vi.fn((_opts, _data, cb) => cb({ approved: false, show_form: false })); // KLARNA-CAT-1017
      const load = vi.fn((_opts, _data, cb) => { late = cb; if (mode === "throw") throw new Error("SDK load failed"); if (mode !== "timeout") cb(mode === "ok" ? { show_form: true } : mode === "error" ? { error: true } : { show_form: false }); }); // KLARNA-CAT-1017
      const names = ["klarnaPayments", "klarnaCategory", "klarnaLoc", "trackKlarna", "readKlarnaSrc", "phone10", "klarnaAttempt", "klarnaFirstName", "klarnaLastName", "emailCleanRef", "klarnaPhone", "klarnaAddress", "klarnaCity", "klarnaCountry", "klarnaState", "klarnaZip", "normalizeRegionCode", "patchFunds", "setErrorMsg", "setSubmitting", "klarnaErrKeys"]; // KLARNA-CAT-1017 // DBT-FOLLOWUP-1017
      const run = new Function(...names, promiseJS); // KLARNA-CAT-1017
      const result = run({ load, authorize }, "pay_over_time", "es-US", (...args: unknown[]) => events.push(args), () => "method_list", "", "1", "", "", { current: "" }, "", "", "", "US", "", "", () => "", vi.fn(), vi.fn(), vi.fn(), () => undefined); // KLARNA-CAT-1017 // DBT-FOLLOWUP-1017
      if (mode === "timeout") { expect(authorize).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(8000); } // KLARNA-CAT-1017
      await result; late?.({ show_form: true }); await vi.advanceTimersByTimeAsync(9000); // KLARNA-CAT-1017
      expect(load).toHaveBeenCalledWith({ container: "#klarna-payments-container", payment_method_category: "pay_over_time" }, { locale: "es-US" }, expect.any(Function)); // KLARNA-CAT-1017
      expect(authorize).toHaveBeenCalledTimes(1); expect(authorize.mock.calls[0]?.[0]).toEqual({ payment_method_category: "pay_over_time" }); // KLARNA-CAT-1017
      expect(authorize.mock.calls[0]?.[1]).toMatchObject({ locale: "es-US" }); // KLARNA-CAT-1017
      expect(events[0]?.[3]).toMatchObject({ klarna_result: "declined", klarna_category: "pay_over_time", klarna_load: mode === "throw" ? "error" : mode, klarna_approved: false, klarna_show_form: false }); // KLARNA-CAT-1017
    } finally { vi.useRealTimers(); } // KLARNA-CAT-1017
  }); // KLARNA-CAT-1017
}); // KLARNA-CAT-1017