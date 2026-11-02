import { describe, expect, it } from "vitest";
import { hasAutoPayEnrollment } from "../../supabase/functions/_shared/autopayEnrolled";
import { isAutoPayEnrolled, shouldHidePostPurchaseAutoPay } from "../components/AutoPayReceiptCard";

describe("AUTOPAY-RECEIPT-ENROLL-1102 server rule", () => {
  const row = (status: string, autopay: unknown, data: unknown) => ({ status, metadata: { autopay }, raw_response: { data } });
  it("requires successful Auto Pay with CustomerProfileId", () => {
    expect(hasAutoPayEnrollment(row("success", true, { CustomerProfileId: "profile" }))).toBe(true);
  });
  it("accepts customer_profile_id", () => {
    expect(hasAutoPayEnrollment(row("success", true, { customer_profile_id: "profile" }))).toBe(true);
  });
  it("accepts the true string", () => {
    expect(hasAutoPayEnrollment(row("success", "true", { CustomerProfileId: "profile" }))).toBe(true);
  });
  it("does not enroll without Auto Pay", () => {
    expect(hasAutoPayEnrollment(row("success", false, { CustomerProfileId: "profile" }))).toBe(false);
  });
  it("does not enroll a failed transaction", () => {
    expect(hasAutoPayEnrollment(row("failed", true, { CustomerProfileId: "profile" }))).toBe(false);
  });
  it.each([{}, { CustomerProfileId: "" }, { CustomerProfileId: "   " }, { CustomerProfileId: null }])("requires a non-empty profile: %j", (data) => {
    expect(hasAutoPayEnrollment(row("success", true, data))).toBe(false);
  });
  it("tolerates absent log data", () => { expect(hasAutoPayEnrollment(null)).toBe(false); });
  it("allows any qualifying row among the five", () => {
    expect([row("failed", true, {}), row("success", true, { CustomerProfileId: "profile" })].some(hasAutoPayEnrollment)).toBe(true);
  });
});

describe("receipt enrollment and post-purchase visibility", () => {
  it.each([
    [true, "receipt", null, true],
    [undefined, "receipt", "receipt", true],
    [false, "receipt", null, false],
    [false, "receipt", "other", false],
    [undefined, "", "", false],
  ] as const)("server=%s hash=%s session=%s enrolled=%s", (server, hashid, session, enrolled) => {
    expect(isAutoPayEnrolled(server, hashid, session)).toBe(enrolled);
    expect(shouldHidePostPurchaseAutoPay(server, hashid, session)).toBe(enrolled);
  });
});