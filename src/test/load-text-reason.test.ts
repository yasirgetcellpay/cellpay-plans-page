/// <reference types="node" />
// LOADTEXT-REASON-1017: mapping, field locations, texts, refund card / failed box wiring, success unchanged.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { loadTextFrom, loadReasonKind, loadReasonText } from "@/lib/loadTextReason";

const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8");
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8");
const compile = (s: string) => ts.transpile(s, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });

describe("LOADTEXT-REASON-1017 mapping", () => {
  const cases: Array<[string, string]> = [
    ["Invalid MIN", "bad_number"], ["Invalid Phone Number", "bad_number"], ["not a valid number", "bad_number"], ["INVALID MDN", "bad_number"], ["PREPAID_NUMBER", "bad_number"],
    ["Invalid Amount", "bad_amount"], ["amount not allowed", "bad_amount"], ["Denomination not supported", "bad_amount"],
    ["Pause", "paused"], ["Line is on a paused plan", "paused"],
    ["Subscriber not found", "not_found"], ["Resource not found", "not_found"], ["Not Found", "not_found"],
  ];
  for (const [t, k] of cases) it(`${t} -> ${k}`, () => expect(loadReasonKind(t)).toBe(k));
  it("generic text -> null", () => { expect(loadReasonKind("Load failed")).toBeNull(); expect(loadReasonKind("")).toBeNull(); });
});

describe("LOADTEXT-REASON-1017 field locations", () => {
  it("data.LoadText", () => expect(loadTextFrom({ data: { LoadText: "Invalid MIN" } })).toBe("Invalid MIN"));
  it("data.data.LoadText", () => expect(loadTextFrom({ data: { data: { LoadText: "Invalid MIN" } } })).toBe("Invalid MIN"));
  it("top-level load_text", () => expect(loadTextFrom({ load_text: "Pause" })).toBe("Pause"));
  it("variants load_text / LoadMessage / loadText", () => {
    expect(loadTextFrom({ data: { load_text: "a" } })).toBe("a");
    expect(loadTextFrom({ data: { LoadMessage: "b" } })).toBe("b");
    expect(loadTextFrom({ data: { data: { loadText: "c" } } })).toBe("c");
  });
  it("no field -> null", () => expect(loadReasonKind(loadTextFrom({ data: { status: false, message: "Declined" } }))).toBeNull());
  it("proxy extractLoadText: top level, then data; null on parseError", () => {
    const helpers = proxy.slice(proxy.indexOf("const REFUND_FAILURE_MESSAGE"), proxy.indexOf("async function finishTransactionLog"));
    const ctx = runInNewContext(compile(`const asRecord = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}; const text = v => v;\n${helpers}\n({ extractLoadText });`));
    expect(ctx.extractLoadText({ loadtext: " Invalid MIN " })).toBe("Invalid MIN");
    expect(ctx.extractLoadText({ data: { LoadMessage: "Pause" } })).toBe("Pause");
    expect(ctx.extractLoadText({ raw: "<html>", parseError: true, LoadText: "x" })).toBeNull();
    expect(ctx.extractLoadText({ data: { LoadText: "x".repeat(900) } })?.length).toBe(500);
  });
});

describe("LOADTEXT-REASON-1017 texts", () => {
  it("EN and ES with the carrier name", () => {
    expect(loadReasonText("bad_number", "en", "T-Mobile")).toBe("This number isn't valid for T-Mobile. Please check it and try again.");
    expect(loadReasonText("bad_number", "es", "T-Mobile")).toBe("Este número no es válido para T-Mobile. Revíselo e inténtelo de nuevo.");
    expect(loadReasonText("not_found", "en", "Cricket")).toBe("We couldn't find this number with Cricket.");
    expect(loadReasonText("not_found", "es", "Cricket")).toBe("No encontramos este número con Cricket.");
    expect(loadReasonText("bad_amount", "en", "X")).toBe("That amount isn't allowed for this plan. Please choose another amount.");
    expect(loadReasonText("paused", "es", "X")).toBe("Esta línea tiene un plan en pausa.");
    expect(loadReasonText(null, "en", "X")).toBeNull();
  });
});

describe("LOADTEXT-REASON-1017 checkout wiring", () => {
  const signalHelper = checkout.slice(checkout.indexOf("const isUnconfirmed"), checkout.indexOf("const setPurchasePending"));
  const handler = checkout.slice(checkout.indexOf("const handleResult ="), checkout.indexOf("// ─── Credit Card ───"));
  const runHandler = (raw: unknown) => {
    const calls: Array<[string, unknown]> = [];
    const stub = (name: string) => (v?: unknown) => { calls.push([name, v]); };
    const scope: Record<string, unknown> = { raw, state: { carrierSlug: "tmobile", carrierName: "T-Mobile", amount: 50 }, validation: null, brandColor: "", paymentMethod: "card", autoPay: false, autoPayTerms: false, mktOptInRef: { current: true }, gpRecurringRef: { current: false }, lang: "en", URLSearchParams, sessionStorage: { removeItem() {}, setItem() {}, getItem() { return null; } }, AP_TICKS_KEY: "t", AP_LAST_KEY: "l", orsOnFail: (m: string) => m, loadReasonKind, loadTextFrom, classifyDecline: () => "generic", bumpCardDeclines: () => 1, bumpSessionDeclines: () => 1, apTicksOrder: null, trackFunnel() {}, funnelDataRef: { current: {} } };
    for (const n of ["setPurchasePending", "earlyPurchase", "recordMarketingOptIn", "navigate", "clearCheckoutCtx", "clearCardDeclines", "clearSessionDeclines", "setShowNotChargedNote", "setDeclineInfo", "setRefundCard", "setErrorMsg", "setLoadReason", "setUnconfirmedCard", "setCardNumber", "setCardExpiry", "setCardCvv"]) scope[n] = stub(n);
    runInNewContext(compile(`${signalHelper}\n${handler}\nhandleResult(raw);`), scope);
    return calls;
  };
  const val = (calls: Array<[string, unknown]>, n: string) => calls.filter((c) => c[0] === n).map((c) => c[1]).pop();
  it("refund reply with LoadText: refund card + reason kind; raw text never set as message", () => {
    const calls = runHandler({ load_text: "Invalid MIN", data: { status: false, message: "There was some error during refill. This transaction has been auto refunded.", refund_signal: true } });
    expect(val(calls, "setRefundCard")).toBe(true);
    expect(val(calls, "setLoadReason")).toBe("bad_number");
    expect(String(val(calls, "setErrorMsg"))).not.toContain("Invalid MIN");
  });
  it("reply WITHOUT the field: loadReason null, same refund/failed path as today", () => {
    const calls = runHandler({ data: { status: false, message: "Declined" } });
    expect(val(calls, "setLoadReason")).toBeNull();
    expect(val(calls, "setErrorMsg")).toBe("Declined");
    expect(val(calls, "setShowNotChargedNote")).toBe(true);
  });
  it("a success reply carrying LoadText is still a success (beacon unchanged)", () => {
    const calls = runHandler({ load_text: "Invalid MIN", data: { status: true, hashid: "H1" } }).map((c) => c[0]);
    for (const n of ["setPurchasePending", "earlyPurchase", "navigate"]) expect(calls).toContain(n);
    expect(calls).not.toContain("setRefundCard");
  });
  it("CHARGE_UNCONFIRMED: unconfirmed card, never the not-charged note, no decline counters", () => {
    const calls = runHandler({ success: false, code: "CHARGE_UNCONFIRMED", data: { status: false, charge_unconfirmed: true } });
    expect(val(calls, "setUnconfirmedCard")).toBe(true);
    expect(val(calls, "setShowNotChargedNote")).toBe(false);
    expect(calls.map((c) => c[0])).not.toContain("earlyPurchase");
    expect(calls.map((c) => c[0])).not.toContain("setCardNumber");
  });
  it("refund card markup: reason paragraph with the $ line kept; unchanged sentence when no reason", () => {
    expect(checkout).toContain('data-testid="refund-reason"');
    expect(checkout).toContain("Your refill didn't go through, so we refunded your payment of ${amt}. Depending on your bank, it can take a few business days to show.`");
    expect(checkout).toContain("Please check the number and plan and try again.` : `Your refill didn't go through");
  });
});
