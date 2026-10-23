// CHECKOUT-TIMEOUT-1023
import { describe, expect, it, vi } from "vitest";
import { CHECKOUT_TIMEOUT_MS, outcomeOfError, isOutcomeUnknown, confirmingMessage, logAttempt } from "@/lib/checkoutTimeout";

describe("CHECKOUT-TIMEOUT-1023", () => {
  it("uses a 120 second client timeout", () => { expect(CHECKOUT_TIMEOUT_MS).toBe(120000); });
  it("treats timeout, network, 502 and 504 as outcome unknown", () => {
    expect(isOutcomeUnknown(outcomeOfError(new Error("x"), true))).toBe(true);
    expect(isOutcomeUnknown(outcomeOfError(new Error("Failed to fetch"), false))).toBe(true);
    expect(isOutcomeUnknown(outcomeOfError({ status: 502 }, false))).toBe(true);
    expect(isOutcomeUnknown(outcomeOfError({ cpStatus: 504 }, false))).toBe(true);
    expect(isOutcomeUnknown(outcomeOfError({ status: 400 }, false))).toBe(false);
  });
  it("shows the exact EN/ES confirming wording", () => {
    expect(confirmingMessage("en")).toBe("We're confirming your payment, please don't pay again.");
    expect(confirmingMessage("es")).toBe("Estamos confirmando su pago, por favor no vuelva a pagar.");
  });
  it("logs only attemptId, outcome and durationMs", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logAttempt("abc", "timeout", 120000.4);
    expect(spy).toHaveBeenCalledWith('[checkout-attempt] {"attemptId":"abc","outcome":"timeout","durationMs":120000}');
    spy.mockRestore();
  });
});
