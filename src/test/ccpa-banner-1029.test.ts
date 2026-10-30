import { describe, expect, it } from "vitest";
import { ccpaAllowed, ccpaCalifornia } from "@/components/CcpaBar";

describe("CCPA-BANNER-1029 visibility rules", () => {
  it("excludes checkout even in preview", () => {
    for (const path of ["/checkout", "/es/checkout", "/checkout/", "/es/checkout/"]) {
      expect(ccpaAllowed(path, true, false, false)).toBe(false);
    }
    expect(ccpaAllowed("/go/metro", true, false, false)).toBe(true);
  });
  it("never shows after dismissal, including preview", () => {
    expect(ccpaAllowed("/", true, true, false)).toBe(false);
    expect(ccpaAllowed("/", false, false, false)).toBe(true);
  });
  it("honors GPC except for preview", () => {
    expect(ccpaAllowed("/", false, false, true)).toBe(false);
    expect(ccpaAllowed("/", true, false, true)).toBe(true);
  });
  it("requires Los Angeles timezone and a US trace result together", () => {
    expect(ccpaCalifornia("America/Los_Angeles", "US")).toBe(true);
    expect(ccpaCalifornia("America/New_York", "US")).toBe(false);
    expect(ccpaCalifornia("America/Los_Angeles", "CA")).toBe(false);
    expect(ccpaCalifornia("America/Los_Angeles", null)).toBe(false);
  });
});