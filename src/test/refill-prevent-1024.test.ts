// REFILL-PREVENT-1024
import { describe, it, expect, beforeEach, vi } from "vitest";
import { phoneFormatBad, isPlanMismatchLoadText, recordRetryBlock, checkRetryBlock, RP_BLOCK_MS, guidanceText, isDeadAmount, fetchDeadAmounts, _resetDeadMemo, isStPastDue, stPastDueText, rpVariant, withTimeout, retryBlockText, formatErrorText } from "@/lib/refillPrevent";
import { pickButtons } from "@/lib/loadTextPick";

beforeEach(() => { localStorage.clear(); document.cookie = "cp_rp=; max-age=0; path=/"; _resetDeadMemo(); });

describe("P1 phone format", () => {
  it("accepts a normal number", () => expect(phoneFormatBad("(213) 555-1234")).toBe(false));
  it("rejects fewer than 10 digits", () => expect(phoneFormatBad("213555123")).toBe(true));
  it("rejects leading 0 or 1", () => { expect(phoneFormatBad("0135551234")).toBe(true); expect(phoneFormatBad("1135551234")).toBe(true); });
  it("rejects 555-01xx", () => expect(phoneFormatBad("2135550142")).toBe(true));
  it("rejects all-same digits", () => expect(phoneFormatBad("7777777777")).toBe(true));
  it("has EN/ES error text", () => { expect(formatErrorText("en")).toBe("Please enter a valid 10-digit phone number."); expect(formatErrorText("es")).toBe("Ingrese un número de teléfono válido de 10 dígitos."); });
});

describe("A/B split", () => {
  it("assigns rp below 0.5 and sticks", () => { expect(rpVariant(Date.parse("2026-10-25T00:00:00Z"), () => 0.1)).toBe("rp"); expect(rpVariant(Date.parse("2026-10-25T00:00:00Z"), () => 0.9)).toBe("rp"); });
  it("no new assignment after 72h", () => expect(rpVariant(Date.parse("2026-10-28T00:00:00Z"), () => 0.1)).toBe("control"));
});

describe("P2 retry block", () => {
  it("matches the owner-approved LoadText triggers", () => {
    for (const t of ["TXN Error: 1065 Invalid transaction state", "Invalid Amount", "Selected Plan does not match", "not eligible", "PASTDUE"]) expect(isPlanMismatchLoadText(t)).toBe(true);
    expect(isPlanMismatchLoadText("Subscriber not found")).toBe(false);
  });
  it("blocks the identical payment for 30 minutes only", async () => {
    const now = 1_000_000;
    await recordRetryBlock("2135551234", "ultra-mobile", "8279", now);
    expect(await checkRetryBlock("(213) 555-1234", "ultra-mobile", "8279", now + 60_000)).toBe(true);
    expect(await checkRetryBlock("2135551234", "ultra-mobile", "8279", now + RP_BLOCK_MS + 1)).toBe(false);
  });
  it("never stores the raw phone", async () => {
    await recordRetryBlock("2135551234", "lyca", "1");
    expect(localStorage.getItem("cp_rp_block_v1")).not.toContain("2135551234");
  });
  it("a different plan clears the block; a different number is not blocked", async () => {
    await recordRetryBlock("2135551234", "lyca", "A");
    expect(await checkRetryBlock("3105551234", "lyca", "A")).toBe(false);
    expect(await checkRetryBlock("2135551234", "lyca", "B")).toBe(false);
    expect(await checkRetryBlock("2135551234", "lyca", "A")).toBe(false);
  });
  it("fails open when storage is broken", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    expect(await checkRetryBlock("2135551234", "lyca", "A")).toBe(false);
    spy.mockRestore();
  });
  it("timeout resolves to the fail-open value", async () => expect(await withTimeout(new Promise<boolean>(() => {}), 10, false)).toBe(false));
  it("block text", () => expect(retryBlockText("es")).toBe("Este plan no coincide con su línea. Elija otro plan."));
});

describe("P2b guidance", () => {
  it("Ultra and T-Mobile only", () => {
    expect(guidanceText("ultra-mobile", "en")).toBe("Pick the plan your line is on now. To change plans, use the Ultra app first.");
    expect(guidanceText("tmobile", "es")).toBe("Elija el monto de su plan mensual actual. El monto debe coincidir exactamente con su plan.");
    expect(guidanceText("lyca", "en")).toBeNull();
  });
});

describe("P4 dead amounts", () => {
  const list = [{ carrier_slug: "lyca", plan_id: "94000495", amount: 21 }, { carrier_slug: "ultra-mobile", plan_id: "8279", amount: 24 }];
  it("marks the Lyca $21 plan", () => expect(isDeadAmount(list, "lyca", "94000495", 21)).toBe(true));
  it("not other amounts or plans", () => { expect(isDeadAmount(list, "lyca", "94000495", 23)).toBe(false); expect(isDeadAmount(list, "lyca", "x", 21)).toBe(false); });
  it("never Ultra", () => expect(isDeadAmount(list, "ultra-mobile", "8279", 24)).toBe(false));
  it("load failure shows everything", async () => {
    expect(await fetchDeadAmounts((() => Promise.reject(new Error("down"))) as unknown as typeof fetch)).toEqual([]);
    _resetDeadMemo();
    expect(await fetchDeadAmounts((() => Promise.resolve(new Response("x", { status: 500 }))) as unknown as typeof fetch)).toEqual([]);
  });
});

describe("P6 Straight Talk past due", () => {
  it("only Straight Talk PASTDUE / no eligible plan", () => {
    expect(isStPastDue("straight-talk", "ERR PASTDUE")).toBe(true);
    expect(isStPastDue("straight-talk", "no eligible plan found")).toBe(true);
    expect(isStPastDue("tracfone", "PASTDUE")).toBe(false);
    expect(isStPastDue("straight-talk", "Invalid request")).toBe(false);
  });
  it("text and generic stays null", () => {
    expect(stPastDueText("en")).toBe("Your line is past due. Choose the Service Plan Card that reactivates it.");
    expect(pickButtons("generic", "en")).toBeNull();
  });
});
