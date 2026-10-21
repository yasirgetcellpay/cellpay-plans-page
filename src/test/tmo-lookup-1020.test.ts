// TMO-LOOKUP-1020: guard decisions only; no real payments or database writes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { runTmoGuard, tmoGuardApplies, tmoGuardGate } from "../../supabase/functions/_shared/tmoRetryGuard";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const payload = { carrier_slug: "tmobile", phone_number: "+1 (212) 555-0147" };
afterEach(() => vi.useRealTimers());
describe("TMO-LOOKUP-1020", () => {
  it("applies only to the normalized T-Mobile slug", async () => {
    expect(tmoGuardApplies({ carrier_slug: " TMobile " })).toBe(true);
    const lookup = vi.fn();
    expect(await runTmoGuard({ ...payload, carrier_slug: "metropcs" }, lookup)).toEqual({ block: false, why: "not_tmo" });
    expect(lookup).not.toHaveBeenCalled();
  });
  it("blocks a matching number and preserves retry seconds", async () => {
    const lookup = vi.fn().mockResolvedValue({ blocked: true, retry_after: 86400 });
    expect(await runTmoGuard(payload, lookup)).toEqual({ block: true, why: "hit", retry_after: 86400 });
    expect(lookup).toHaveBeenCalledExactlyOnceWith("2125550147");
  });
  it("allows an unblocked lookup", async () => {
    expect(await runTmoGuard(payload, async () => ({ blocked: false, retry_after: 0 }))).toEqual({ block: false, why: "allow" });
  });
  it("never looks up an invalid phone", async () => {
    const lookup = vi.fn();
    expect(await runTmoGuard({ ...payload, phone_number: "55512" }, lookup)).toEqual({ block: false, why: "bad_phone" });
    expect(lookup).not.toHaveBeenCalled();
  });
  it.each([null, {}, { blocked: 1, retry_after: 1 }, { blocked: true, retry_after: "10" }, { blocked: true, retry_after: NaN }, { blocked: true, retry_after: Infinity }])("fails open on malformed response %j", async (answer) => {
    expect(await runTmoGuard(payload, vi.fn().mockResolvedValue(answer))).toEqual({ block: false, why: "failopen_error" });
  });
  it("fails open on an exception and emits a nonblocking event", async () => {
    const event = vi.fn().mockRejectedValue(Error("audit unavailable"));
    expect(await tmoGuardGate(payload, "en", { lookup: async () => { throw Error("offline"); }, event })).toBeNull();
    expect(event).toHaveBeenCalledExactlyOnceWith("tmo_retry_failopen:failopen_error");
  });
  it("fails open at exactly 1200ms and clears the timer", async () => {
    vi.useFakeTimers();
    const event = vi.fn();
    const result = tmoGuardGate(payload, "en", { lookup: () => new Promise(() => {}), event });
    await vi.advanceTimersByTimeAsync(1199);
    expect(event).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBeNull();
    expect(event).toHaveBeenCalledExactlyOnceWith("tmo_retry_failopen:failopen_timeout");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns a block without awaiting audit completion", async () => {
    const event = vi.fn(() => new Promise(() => {}));
    const result = await tmoGuardGate(payload, "en", { lookup: async () => ({ blocked: true, retry_after: 86400 }), event });
    expect(result).toMatchObject({ success: false, blocked: true, code: "TMO_RETRY_24H", retry_after: 86400 });
    expect(event).toHaveBeenCalledExactlyOnceWith("tmo_retry_24h");
  });
  const checkout = readFileSync("src/pages/Checkout.tsx", "utf8");
  it.each(["card", "applepay", "googlepay", "cashapp", "paypal", "klarna", "plaid"])("%s shared result gate prevents success and decline side effects", (paymentMethod) => {
    const calls: string[] = [];
    const handler = checkout.slice(checkout.indexOf("const handleResult ="), checkout.indexOf("// ─── Credit Card ───"));
    runInNewContext(ts.transpile(`${handler}\nhandleResult(raw);`, { target: ts.ScriptTarget.ES2022 }), {
      paymentMethod, raw: { code: "TMO_RETRY_24H", retry_after: 86400, success: true },
      showTmoBlock: (seconds: number) => calls.push(`block:${seconds}`),
      earlyPurchase: () => calls.push("purchase"), navigate: () => calls.push("navigate"),
      bumpCardDeclines: () => calls.push("card-decline"), bumpSessionDeclines: () => calls.push("session-decline"),
      markWalletDeclined: () => calls.push("wallet-block"), setCardNumber: () => calls.push("clear-card"),
    });
    expect(calls).toEqual(["block:86400"]);
  });
});