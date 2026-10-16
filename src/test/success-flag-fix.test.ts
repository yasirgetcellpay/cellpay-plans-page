// SUCCESS-FLAG-FIX-1016: regression rules use actual helper/handler code without starting the payment function.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8");
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8");
const compile = (s: string) => ts.transpile(s, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const helpers = proxy.slice(proxy.indexOf("const REFUND_FAILURE_MESSAGE"), proxy.indexOf("async function finishTransactionLog"));
const context = runInNewContext(compile(`
  const asRecord = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const text = v => typeof v === 'string' && v.trim() ? v.trim() : null;
  ${helpers}
  ({refundSignal, refundSuccessMarker});
`));
const normal = { success: true, data: { status: true, message: "Transaction completed successfully.", hashid: "X", transactionId: "X", data: { status: true, Result: "Success", TransResult: "ok", LoadResponse: "1", Pin: "", hashid: "X", CCTransactionId: "X" } } };

describe("SUCCESS-FLAG-FIX-1016", () => {
  it("leaves the owner's real-success example unchanged", () => {
    expect(context.refundSignal(normal)).toBeNull();
    expect(context.refundSuccessMarker({ success: true, data: normal })).toBeNull();
  });
  for (const marker of ["auto-refund", "auto refunded", "refunded", "refund status", "error during refill", "invalid phone number", "invalid number", "invalid plan", "invalid amount", "plan does not match", "prepaid_number", "not qualify"]) {
    it(`detects ${marker} in strings inside deeply nested arrays`, () => {
      expect(context.refundSuccessMarker({ success: true, data: { status: true, extra: [{ deep: { message: marker } }] } })).not.toBeNull();
    });
  }
  it("detects nested false status despite an outer success", () => {
    expect(context.refundSignal({ success: true, data: { status: true, data: { status: false } } })).toBe("data.data.status:false");
    expect(context.refundSuccessMarker({ success: true, data: { status: true, data: { status: false } } })).not.toBeNull();
  });
  it("preserves the existing false-status refill-error detection", () => {
    expect(context.refundSignal({ data: { status: false, message: "There was some error during refill. This transaction has been auto refunded." } })).not.toBeNull();
  });
  it("rejects non-success Result and non-ok TransResult anywhere", () => {
    expect(context.refundSignal({ nested: { Result: "Failed" } })).toBe("Result:not_success");
    expect(context.refundSignal({ nested: { TransResult: "no" } })).toBe("TransResult:not_ok");
    expect(context.refundSignal({ Result: "sUcCeSs", TransResult: "OK" })).toBeNull();
  });
  it("never matches HTML or parse-error bodies", () => {
    expect(context.refundSignal({ data: { parseError: true, raw: "auto-refunded" } })).toBeNull();
    expect(context.refundSuccessMarker({ success: true, data: { parseError: true, raw: "auto-refunded" } })).toBeNull();
  });
  it("does not rewrite ordinary declined replies", () => {
    expect(context.refundSuccessMarker({ success: true, data: { status: false, message: "Declined" } })).toBeNull();
  });

  const signalHelper = checkout.slice(checkout.indexOf("const hasRefundSignal"), checkout.indexOf("const setPurchasePending"));
  const handler = checkout.slice(checkout.indexOf("const handleResult ="), checkout.indexOf("// ─── Credit Card ───"));
  const runHandler = (raw: unknown) => {
    const calls: string[] = [];
    const stub = (name: string) => () => calls.push(name);
    const scope: Record<string, unknown> = { raw, calls, state: { carrierSlug: "metropcs", carrierName: "Metro", amount: 50 }, validation: null, brandColor: "", paymentMethod: "card", autoPay: true, autoPayTerms: true, mktOptInRef: { current: true }, gpRecurringRef: { current: false }, lang: "en", URLSearchParams, sessionStorage: { removeItem() {}, setItem: stub("autopay"), getItem() { return null; } }, AP_TICKS_KEY: "ticks", AP_LAST_KEY: "last", orsOnFail: (msg: string) => msg };
    for (const name of ["setPurchasePending", "earlyPurchase", "recordMarketingOptIn", "navigate", "clearCheckoutCtx", "clearCardDeclines", "clearSessionDeclines", "setShowNotChargedNote", "setDeclineInfo", "setRefundCard", "setErrorMsg"]) scope[name] = stub(name);
    runInNewContext(compile(`${signalHelper}\n${handler}\nhandleResult(raw);`), scope);
    return calls;
  };
  it("a nested refund flag overrides true status before tracking, consent, Auto Pay and navigation", () => {
    const calls = runHandler({ data: { status: true, hashid: "order-X", nested: [{ refund_signal: true }] } });
    expect(calls).toContain("setRefundCard");
    for (const name of ["setPurchasePending", "earlyPurchase", "recordMarketingOptIn", "autopay", "navigate"]) expect(calls).not.toContain(name);
  });
  it("normal client success still tracks, records consent, saves Auto Pay and navigates", () => {
    const calls = runHandler({ status: true, hashid: "order-X" });
    for (const name of ["setPurchasePending", "earlyPurchase", "recordMarketingOptIn", "autopay", "navigate"]) expect(calls).toContain(name);
    expect(calls).not.toContain("setRefundCard");
  });
});