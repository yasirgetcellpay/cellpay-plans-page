// ULTRA-MDN-1029: MDN plan fields are added only when phone + plan match the active MDN plan.
import { describe, it, expect, afterEach } from "vitest";
import { applyUltraMdn, setUltraMdnActive } from "@/services/apiWrapper";

const ctx = { mdn: "3055551234", barcode: "00123456789012", planId: "777", carrierId: 55 };
afterEach(() => setUltraMdnActive(null));

describe("applyUltraMdn", () => {
  it("adds barcode as a string, carrierId, plan_id and MDN when matching", () => {
    setUltraMdnActive(ctx);
    const out = applyUltraMdn({ carrier_slug: "ultra-mobile", phone_number: "13055551234", plan_id: "777", amount: 30 });
    expect(out.barcode).toBe("00123456789012");
    expect(out.carrierId).toBe(55);
    expect(out.plan_id).toBe("777");
    expect(out.phone_number).toBe("3055551234");
    expect(out.amount).toBe(30);
  });
  it("never adds barcode when the phone differs", () => {
    setUltraMdnActive(ctx);
    expect(applyUltraMdn({ carrier_slug: "ultra-mobile", phone_number: "3055550000", plan_id: "777" }).barcode).toBeUndefined();
  });
  it("never adds barcode for an A plan or another carrier", () => {
    setUltraMdnActive(ctx);
    expect(applyUltraMdn({ carrier_slug: "ultra-mobile", phone_number: "3055551234", plan_id: "8279" }).barcode).toBeUndefined();
    expect(applyUltraMdn({ carrier_slug: "lyca", phone_number: "3055551234", plan_id: "777" }).barcode).toBeUndefined();
  });
  it("no active MDN plan = payload unchanged", () => {
    const p = { carrier_slug: "ultra-mobile", phone_number: "3055551234", plan_id: "777" };
    expect(applyUltraMdn(p)).toBe(p);
  });
});
