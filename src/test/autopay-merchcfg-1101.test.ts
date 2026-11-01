import { describe, expect, it } from "vitest"; // AUTOPAY-MERCHCFG-1101
import { classifyDecline, isAutopayMerchCfg, merchCfgOfferFor, MERCHCFG_COPY } from "../lib/declineRecovery"; // AUTOPAY-MERCHCFG-1101
describe("Auto Pay merchant configuration", () => { // AUTOPAY-MERCHCFG-1101
  it.each(["Decline - There is a problem with your CyberSource merchant configuration.", "MERCHANT CONFIGURATION"])("recognizes %s", (msg) => { expect(isAutopayMerchCfg(msg)).toBe(true); }); // AUTOPAY-MERCHCFG-1101
  it.each(["Insufficient funds", "Decline", "", null])("rejects %s", (msg) => { expect(isAutopayMerchCfg(msg)).toBe(false); }); // AUTOPAY-MERCHCFG-1101
  it("requires Auto Pay intent", () => { expect(merchCfgOfferFor("MERCHANT CONFIGURATION", false)).toBe(false); expect(merchCfgOfferFor("MERCHANT CONFIGURATION", true)).toBe(true); expect(merchCfgOfferFor("Decline", true)).toBe(false); }); // AUTOPAY-MERCHCFG-1101
  it("keeps funds classification", () => { expect(classifyDecline("Insufficient funds")).toBe("funds"); }); // AUTOPAY-MERCHCFG-1101
}); // AUTOPAY-MERCHCFG-1101