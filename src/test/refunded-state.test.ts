/// <reference types="node" />
// REFUNDED-STATE-1017: proxy pipeline (in-memory doubles, no DB/CellPay), BAD_PHONE guard, normalizePhone, receipt page.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8");
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8");
const compile = (s: string) => ts.transpile(s, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const helpers = proxy.slice(proxy.indexOf("const REFUND_FAILURE_MESSAGE"), proxy.indexOf("async function finishTransactionLog"));
const pipeline = proxy.slice(proxy.indexOf("// Always return 200 so supabase.functions.invoke doesn't throw"), proxy.indexOf("// Pockyt Cash App session status polling"));
const pre = `const asRecord = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const text = v => (typeof v === 'string' || typeof v === 'number') && String(v).trim() ? String(v).trim() : null;`;

const run = async (upstream: unknown, status = 200, rawText?: string) => {
  const writes: Array<{ name: string; args: unknown[] }> = [];
  const cap = (name: string) => (...args: unknown[]) => { writes.push({ name, args: structuredClone(args) }); };
  const parseFailed = rawText !== undefined;
  const data = parseFailed ? { raw: rawText, parseError: true } : upstream;
  const scope = { writes, structuredClone, setTimeout, console, response: { ok: status >= 200 && status < 300, status }, data, rawText: rawText ?? JSON.stringify(upstream), rawReplyParseFailed: parseFailed, shouldLogTransaction: true, isPockytCreate: false, endpoint: "checkout/transaction", paymentMethod: "cardpayment", txLogId: "new-order", refillKey: null, payload: {}, payloadRecord: {}, callerHost: "", riskAction: "", isPlaidCheckout: false, isPayPalTx: false, logRawCellPayReply: cap("raw"), logCarrierCheck: () => {}, refillCooldownRpc: cap("cooldown"), callDatabaseRpc: (name: string, args: unknown) => { writes.push({ name, args: [structuredClone(args)] }); return Promise.resolve(null); }, logDataErr: cap("dataErr"), logCardFacts: cap("cardFacts"), finishTransactionLog: cap("finish"), isRefillErrorResult: () => false };
  const wrapped = await runInNewContext(compile(`${pre}\n${helpers}\n(async () => { ${pipeline} return wrapped; })();`), scope);
  return { wrapped, writes };
};
const normal = { status: true, message: "Transaction completed successfully.", hashid: "X", transactionId: "X", data: { status: true, Result: "Success", TransResult: "ok", hashid: "X" } };

describe("REFUNDED-STATE-1017 proxy", () => {
  it("a normal success never calls mark_order_refunded and is returned unchanged", async () => {
    const { wrapped, writes } = await run(normal);
    expect(wrapped).toEqual({ success: true, data: normal, pending_log_id: "new-order" });
    expect(writes.some((w) => w.name === "mark_order_refunded")).toBe(false);
  });
  it("a status:false auto-refunded body calls mark_order_refunded with _source reply", async () => {
    const { writes } = await run({ status: false, message: "There was some error during refill. This transaction has been auto refunded." }, 400);
    const m = writes.find((w) => w.name === "mark_order_refunded");
    expect(m?.args[0]).toEqual({ _id: "new-order", _source: "reply", _reason: "reply_auto_refund" });
    expect(writes.findIndex((w) => w.name === "finish")).toBeLessThan(writes.findIndex((w) => w.name === "mark_order_refunded"));
  });
  it("a 504 HTML body returns CHARGE_UNCONFIRMED, no HTML text, row still finalized failed", async () => {
    const { wrapped, writes } = await run(null, 504, "<html><body>504 Gateway Time-out</body></html>");
    expect(wrapped.code).toBe("CHARGE_UNCONFIRMED");
    expect(JSON.stringify(wrapped)).not.toMatch(/html|Gateway/i);
    expect(wrapped.pending_log_id).toBe("new-order");
    expect((writes.find((w) => w.name === "finish")?.args[1] as { success: boolean }).success).toBe(false);
    expect(writes.find((w) => w.name === "tx_log_meta_merge")?.args[0]).toEqual({ _id: "new-order", _patch: { charge_unconfirmed: true, crash_kind: "http5xx" } });
  });
  it("a 400 SQLSTATE body returns CHARGE_UNCONFIRMED with no SQLSTATE text", async () => {
    const { wrapped, writes } = await run({ status: false, message: "SQLSTATE[23000]: Integrity constraint violation" }, 400);
    expect(wrapped.code).toBe("CHARGE_UNCONFIRMED");
    expect(JSON.stringify(wrapped)).not.toMatch(/SQLSTATE/);
    expect(writes.some((w) => w.name === "finish")).toBe(true);
    expect((writes.find((w) => w.name === "tx_log_meta_merge")?.args[0] as { _patch: { crash_kind: string } })._patch.crash_kind).toBe("sqlstate");
  });
  it("a Backend exception body is unchanged", async () => {
    const body = { status: false, message: "Backend exception occurred. Please try again." };
    const { wrapped } = await run(body, 200);
    expect(wrapped).toEqual({ success: true, data: body, pending_log_id: "new-order" });
  });

  const ctx = runInNewContext(compile(`${pre}\n${helpers}\n({ phoneOk10, extractLoadText });`));
  it("9-digit and 10-digit-starting-with-1 phones fail; a valid 10-digit phone passes", () => {
    expect(ctx.phoneOk10({ phone_number: "716436920" })).toBe(false);
    expect(ctx.phoneOk10({ phone_number: "1716436920" })).toBe(false);
    expect(ctx.phoneOk10({ phoneNumber: "(716) 436-9201" })).toBe(true);
  });
  it("BAD_PHONE reply never calls CellPay, logs a failed row and a bad_phone event", async () => {
    const fn = proxy.slice(proxy.indexOf("const BAD_PHONE_LOG"), proxy.indexOf("function guardRefusal("));
    const calls: string[] = [];
    class R { constructor(public body: string) {} }
    const scope = { calls, setTimeout, console, JSON, Response: R, fetch: () => { calls.push("fetch"); }, createTransactionLog: async () => { calls.push("create"); return "row"; }, finishTransactionLog: async (_id: string, w: { error: string }) => { calls.push(`finish:${w.error}`); }, recordGuardEvent: (e: { code: string }) => calls.push(`event:${e.code}`), originHost: () => "", text: (v: unknown) => v ?? null };
    const res = await runInNewContext(compile(`${fn}\nbadPhoneReply({ phone_number: "716436920" }, "", null, {}, null, "checkout/transaction");`), scope);
    expect(JSON.parse(res.body)).toEqual({ success: false, code: "BAD_PHONE", error: "Please enter the full 10-digit phone number." });
    expect(calls).toEqual(["create", "finish:Blocked: invalid phone number", "event:bad_phone"]);
    // guard sits before the CellPay fetch in the checkout path
    expect(proxy.indexOf("!phoneOk10(payloadRecord)")).toBeLessThan(proxy.indexOf("response = await fetch(url, isPockytCreate"));
  });
});

describe("REFUNDED-STATE-1017 normalizePhone", () => {
  const src = checkout.slice(checkout.indexOf("function normalizePhone"), checkout.indexOf("declare global"));
  const normalizePhone = runInNewContext(compile(`${src}\nnormalizePhone;`));
  it("strips the country code from 11 digits", () => expect(normalizePhone("17164369201")).toBe("7164369201"));
  it("keeps a 10-digit string that starts with 1 (fails phoneOk)", () => {
    expect(normalizePhone("1716436920")).toBe("1716436920");
    expect(/^[2-9]\d{9}$/.test(normalizePhone("1716436920"))).toBe(false);
  });
});
