// VZ-PREPAID-GUARD-1017: guard decisions and payment-side effects, no real orders or charges.
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePhone10, runVzGuard, vzGuardGate, vzNotPrepaidMessage } from "../../supabase/functions/_shared/vzPrepaidGuard";
import { isVerizonSlug, VZ_NOTE, VZ_NOTICE_MIN, vzBlockText } from "../lib/vzPrepaid";
import { activeLineNote } from "../content/carrierHero";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const payload = { plan_id: "291945", phone_number: "2125550147" };
afterEach(() => vi.useRealTimers());
describe("VZ-PREPAID-GUARD-1017", () => {
  it.each(["2125550147", "+1 (212) 555-0147"])("blocks refunded/no success and normalizes %s", async (phone_number) => {
    const lookup = vi.fn().mockResolvedValue({ refunded: true, success: false });
    expect(await runVzGuard({ ...payload, phone_number }, lookup)).toEqual({ block: true, why: "hit" });
    expect(lookup).toHaveBeenCalledExactlyOnceWith("2125550147");
  });
  it("allows a prior success without any time limit", async () => {
    expect(await runVzGuard(payload, async () => ({ refunded: true, success: true }))).toEqual({ block: false, why: "prior_success" });
  });
  it("allows a fresh number", async () => {
    expect(await runVzGuard(payload, async () => ({ refunded: false, success: false }))).toEqual({ block: false, why: "no_refund" });
  });
  it("fails open on lookup errors", async () => {
    expect(await runVzGuard(payload, async () => { throw Error("unavailable"); })).toEqual({ block: false, why: "failopen_error" });
  });
  it.each([null, {}, { refunded: 1, success: false }, { refunded: true }])("fails open on malformed lookup %j", async (answer) => {
    expect(await runVzGuard(payload, vi.fn().mockResolvedValue(answer))).toEqual({ block: false, why: "failopen_error" });
  });
  it("fails open at 1500 ms and clears its timer", async () => {
    vi.useFakeTimers();
    const result = runVzGuard(payload, () => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toEqual({ block: false, why: "failopen_timeout" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["2636", "33333", undefined])("never looks up other/missing plan %s", async (plan_id) => {
    const lookup = vi.fn();
    expect(await runVzGuard({ ...payload, plan_id }, lookup)).toEqual({ block: false, why: "not_vz" });
    expect(lookup).not.toHaveBeenCalled();
  });
  it("invalid length does not trigger a lookup", async () => {
    const lookup = vi.fn();
    expect(normalizePhone10("212555014")).toBeNull();
    expect(await runVzGuard({ ...payload, phone_number: "212555014" }, lookup)).toEqual({ block: false, why: "bad_phone" });
    expect(lookup).not.toHaveBeenCalled();
  });
  it("gate blocks and logs exactly one failed row and event", async () => {
    const logFailedRow = vi.fn().mockResolvedValue(null), event = vi.fn();
    const result = await vzGuardGate(payload, "en", "cardpayment", { lookup: async () => ({ refunded: true, success: false }), logFailedRow, event });
    expect(result).toEqual({ success: false, blocked: true, code: "VZ_NOT_PREPAID", message: vzNotPrepaidMessage("en", "cardpayment") });
    expect(logFailedRow).toHaveBeenCalledExactlyOnceWith({ vz_guard: true }, "vz_prepaid_guard");
    expect(event).toHaveBeenCalledExactlyOnceWith("vz_prepaid_guard");
  });
  it("allowed gate returns null and never logs a failed row", async () => {
    const logFailedRow = vi.fn(), event = vi.fn();
    expect(await vzGuardGate(payload, "en", "paypal", { lookup: async () => ({ refunded: false, success: false }), logFailedRow, event })).toBeNull();
    expect(logFailedRow).not.toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
  });
  it("failed lookup returns null and a fail-open event", async () => {
    const logFailedRow = vi.fn(), event = vi.fn();
    expect(await vzGuardGate(payload, "es", "paypal", { lookup: async () => { throw Error("offline"); }, logFailedRow, event })).toBeNull();
    expect(logFailedRow).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledExactlyOnceWith("vz_guard_failopen:failopen_error");
  });
  it("audit logging cannot hold a block longer than 3 seconds", async () => {
    vi.useFakeTimers();
    const result = vzGuardGate(payload, "en", "paypal", { lookup: async () => ({ refunded: true, success: false }), logFailedRow: () => new Promise(() => {}), event: () => {} });
    await vi.advanceTimersByTimeAsync(3000);
    expect((await result)?.code).toBe("VZ_NOT_PREPAID");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("audit failure cannot bypass the block", async () => {
    expect((await vzGuardGate(payload, "en", "card", { lookup: async () => ({ refunded: true, success: false }), logFailedRow: async () => { throw Error("write failed"); }, event: () => {} }))?.code).toBe("VZ_NOT_PREPAID");
  });
  it("Verizon slug aliases share the 90 amount notice threshold", () => {
    expect(isVerizonSlug("verizon")).toBe(true);
    expect(isVerizonSlug("verizon-wireless-flexi")).toBe(true);
    expect(isVerizonSlug("metropcs")).toBe(false);
    expect(VZ_NOTICE_MIN).toBe(90);
  });
  const checkout = readFileSync("src/pages/Checkout.tsx", "utf8");
  it.each(["card", "applepay", "googlepay", "cashapp", "paypal", "klarna", "plaid"])("%s guard reply has no decline/purchase/navigation side effects", (paymentMethod) => {
    const calls: string[] = [];
    const handler = checkout.slice(checkout.indexOf("const handleResult ="), checkout.indexOf("// ─── Credit Card ───"));
    const scope = { paymentMethod, raw: { code: "VZ_NOT_PREPAID", blocked: true, success: false }, showVzBlock: (m: string) => calls.push(`block:${m}`), earlyPurchase: () => calls.push("purchase"), navigate: () => calls.push("navigate"), bumpCardDeclines: () => calls.push("card-decline"), bumpSessionDeclines: () => calls.push("session-decline"), markWalletDeclined: () => calls.push("wallet-block"), setCardNumber: () => calls.push("clear-card") };
    runInNewContext(ts.transpile(`${handler}\nhandleResult(raw);`, { target: ts.ScriptTarget.ES2022 }), scope);
    expect(calls).toEqual([`block:${paymentMethod}`]);
  });
  // Exact bilingual copy and note consistency are intentionally not DOM/style tests.
  it.each(["en", "es"])("%s card and non-card messages match the required copy", (lang) => {
    const base = lang === "es" ? "Este número no se puede pagar como Verizon Prepago. Puede ser una cuenta mensual de Verizon u otra compañía." : "This number can't be paid as Verizon Prepaid. It may be a Verizon monthly account or another carrier.";
    const card = base + (lang === "es" ? " No se le hizo ningún cargo a su tarjeta." : " Your card was not charged.");
    const wallet = base + (lang === "es" ? " No se le hizo ningún cargo." : " You were not charged.");
    expect(vzNotPrepaidMessage(lang, "CARDPAYMENT")).toBe(card);
    expect(vzBlockText(lang, "card")).toBe(card);
    for (const method of ["applepay", "googlepay", "pockyt", "cashapp", "paypal", "klarna", "plaid"]) {
      expect(vzNotPrepaidMessage(lang, method)).toBe(wallet);
      expect(vzBlockText(lang, method)).toBe(wallet);
    }
    expect(card + wallet).not.toMatch(/❌|declined|rechaz|provider/i);
    expect(activeLineNote("verizon", lang as "en" | "es")).toBe(VZ_NOTE[lang as "en" | "es"]);
    expect(activeLineNote("verizon-wireless-flexi", lang as "en" | "es")).toBe(VZ_NOTE[lang as "en" | "es"]);
    expect(activeLineNote("metropcs", "en")).toBeNull();
  });
});