// DB-OUTAGE-TRACK-1017: outage, duplicate-charge and nonblocking tracking regressions.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { raceNull } from "../../supabase/functions/_shared/raceNull";
import { memdupKey, memdupCheck, memdupUpdate, MEMDUP_UNKNOWN_MS, type MemdupEntry } from "../../supabase/functions/_shared/memdup";
import * as checkoutTimeout from "@/lib/checkoutTimeout"; // CHECKOUT-TIMEOUT-1023
import { lockKey, activeLock, setLock, clearLock, PAYLOCK_MS, PAYLOCK_UNKNOWN_MS, runPayLocked } from "@/lib/payLock";

const source = readFileSync("src/pages/Checkout.tsx", "utf8");
let root: Root | undefined;
function cleanup() { if (root) { act(() => root?.unmount()); root = undefined; } document.body.innerHTML = ""; }
function render(card: React.ReactElement) {
  const host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); act(() => root?.render(card));
  const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  return { getByTestId: (id: string) => { const el = q(id); if (!el) throw new Error(`Missing ${id}`); return el; }, queryByTestId: q, getAllByRole: (_: string) => [...host.querySelectorAll("button")], getByRole: (_: string, opts: { name: string }) => { const el = [...host.querySelectorAll("button")].find((b) => b.textContent === opts.name); if (!el) throw new Error(`Missing ${opts.name}`); return el; }, unmount: cleanup };
}
const flushMicro = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const tracked = async () => import("@/lib/trackQueue");
const body = (id = "ORDER1234") => ({ _transaction_id: id, _hashid: id, _value: 50, _source: "checkout_success" });
const queue = () => JSON.parse(localStorage.getItem("cp_track_q_v1") || "[]") as Array<{ k: string; id: string; b: Record<string, unknown>; n: number; next: number; t0: number }>;
function compile(code: string, names: Record<string, unknown>, jsx = false): unknown {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: jsx ? ts.JsxEmit.React : undefined } }).outputText;
  return new Function(...Object.keys(names), js)(...Object.values(names));
}
function wrapper(raw: () => Promise<unknown>, phone = "5552010000", amount = 50) {
  const until: number[] = [];
  const block = source.slice(source.indexOf("  const submitTransaction = async"), source.indexOf("\n  // Visitor IP"));
  const fn = compile(`${block}\nreturn submitTransaction;`, {
    phoneOk: true, badPhoneGo: vi.fn(), state: { phone, amount }, validation: { amount }, lockKey, activeLock, setLock, PAYLOCK_MS, runPayLocked,
    dupConfirmRef: { current: false }, devFpRef: { current: null }, submitTransactionRaw: raw,
    hasRefundSignal: (r: Record<string, unknown>) => r.refund_signal === true,
    maybePaidKeyRef: { current: null }, showMaybePaid: (_: boolean, time: number) => until.push(time), setMaybePaid: vi.fn(), setMaybePaidPaused: vi.fn(),
    setStepUp: vi.fn(), setDupAsk: vi.fn(), setInFlightNote: vi.fn(),
    ...checkoutTimeout, confirmingRef: { current: false }, setConfirmingPay: vi.fn(), // CHECKOUT-TIMEOUT-1023
  }) as (p: Record<string, unknown>) => Promise<unknown>;
  return { fn, until };
}
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T03:48:00Z")); localStorage.clear(); vi.resetModules(); });
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("tracking queue", () => {
  it.each([200, 400, 404])("drops completed/nonretryable HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status === 200, status }));
    (await tracked()).sendTracked("log_purchase_fire", body()); await flushMicro(); expect(queue()).toEqual([]);
  });
  it.each(["network", "abort", 503, 429, 408])("queues retryable failure %s", async (status) => {
    const fetch = vi.fn(); if (typeof status === "string") fetch.mockRejectedValue(new DOMException("failed", status === "abort" ? "AbortError" : "NetworkError")); else fetch.mockResolvedValue({ ok: false, status });
    vi.stubGlobal("fetch", fetch); (await tracked()).sendTracked("log_purchase_fire", body()); await flushMicro(); expect(queue()).toHaveLength(1); expect(queue()[0].n).toBe(1);
  });
  it("deduplicates entries and keeps the newest 20 of 25", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); const { sendTracked } = await tracked();
    sendTracked("log_purchase_fire", body()); sendTracked("log_purchase_fire", body()); await flushMicro(); expect(queue()).toHaveLength(1);
    localStorage.clear(); for (let i = 0; i < 25; i++) { vi.setSystemTime(Date.now() + 1); sendTracked("log_purchase_fire", body(`ORDER${i.toString().padStart(4, "0")}`)); await flushMicro(); }
    expect(queue()).toHaveLength(20); expect(queue()[0].id).toBe("ORDER0005");
  });
  it("drops old/exhausted entries and honors a foreign lease", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", fetch);
    localStorage.setItem("cp_track_q_v1", JSON.stringify([
      { k: "log_purchase_fire", id: "ORDER1234", b: body(), n: 1, next: 0, t0: Date.now() - 8 * 86400000 },
      { k: "log_purchase_fire", id: "ORDER5678", b: body("ORDER5678"), n: 8, next: 0, t0: Date.now() },
    ])); const { flushTrackQueue } = await tracked(); flushTrackQueue(); await flushMicro(); expect(queue()).toEqual([]);
    localStorage.setItem("cp_track_q_v1", JSON.stringify([{ k: "log_purchase_fire", id: "ORDER1234", b: body(), n: 1, next: 0, t0: Date.now() }]));
    localStorage.setItem("cp_track_q_lock", String(Date.now() + 15000)); flushTrackQueue(); await flushMicro(); expect(fetch).not.toHaveBeenCalled();
  });
  it("sends every due entry once, sequentially, and removes it", async () => {
    let release: ((v: unknown) => void) | undefined;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise((r) => { release = r; })).mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", fetch);
    localStorage.setItem("cp_track_q_v1", JSON.stringify(["ORDER0001", "ORDER0002"].map((id) => ({ k: "log_purchase_fire", id, b: body(id), n: 1, next: 0, t0: Date.now() }))));
    (await tracked()).flushTrackQueue(); await flushMicro(); expect(fetch).toHaveBeenCalledTimes(1); release?.({ ok: true, status: 200 }); await flushMicro(); expect(fetch).toHaveBeenCalledTimes(2); expect(queue()).toEqual([]); expect(fetch.mock.calls[0][1].keepalive).toBe(false);
  });
  it("uses all eight backoff values and reschedules failed retries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 })); const { TRACK_BACKOFF, flushTrackQueue } = await tracked();
    expect([...TRACK_BACKOFF]).toEqual([5000, 15000, 60000, 300000, 1800000, 7200000, 43200000, 86400000]);
    for (let n = 1; n < 7; n++) {
      localStorage.setItem("cp_track_q_v1", JSON.stringify([{ k: "log_purchase_fire", id: "ORDER1234", b: body(), n, next: 0, t0: Date.now() }]));
      flushTrackQueue(); await flushMicro(); expect(queue()[0].n).toBe(n + 1); expect(queue()[0].next - Date.now()).toBe(TRACK_BACKOFF[n]);
    }
  });
  it("renews the lease before each slow retry so sequential batches remain protected", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200 }), 4000))));
    localStorage.setItem("cp_track_q_v1", JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ k: "log_purchase_fire", id: `ORDER000${i}`, b: body(`ORDER000${i}`), n: 1, next: 0, t0: Date.now() }))));
    (await tracked()).flushTrackQueue(); await vi.advanceTimersByTimeAsync(16000);
    expect(Number(localStorage.getItem("cp_track_q_lock"))).toBeGreaterThan(Date.now());
    await vi.advanceTimersByTimeAsync(4000); expect(queue()).toEqual([]); expect(localStorage.getItem("cp_track_q_lock")).toBeNull();
  });
  it("whitelists fields for both kinds and refuses invalid identifiers", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", fetch); const { sendTracked } = await tracked();
    sendTracked("log_purchase_fire", { ...body(), email: "discard", phone_number: "discard" });
    sendTracked("record_marketing_opt_in", { p_hashid: "ORDER1234", p_opt_in: true, p_lang: "es", p_browser_language: "es-US", email: "discard" });
    sendTracked("log_purchase_fire", body("bad id")); await flushMicro(); expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body()); expect(Object.keys(JSON.parse(fetch.mock.calls[1][1].body))).toEqual(["p_hashid", "p_opt_in", "p_lang", "p_browser_language"]);
  });
  it("returns synchronously after the purchase push even if the write never resolves", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); const dataLayer: unknown[] = []; dataLayer.push({ event: "purchase" });
    expect((await tracked()).sendTracked("log_purchase_fire", body())).toBeUndefined(); expect(dataLayer).toEqual([{ event: "purchase" }]);
  });
});
describe("raceNull", () => {
  it("returns a fast value, null on rejection, and null on timeout without throwing", async () => {
    expect(await raceNull(Promise.resolve(7), 100)).toBe(7); expect(await raceNull(Promise.reject(new Error("offline")), 100)).toBeNull();
    const pending = raceNull(new Promise(() => {}), 100); await vi.advanceTimersByTimeAsync(100); expect(await pending).toBeNull();
  });
});
describe("phone/amount lock", () => {
  it("normalizes the specified number and refuses 9 digits", () => { expect(lockKey("(555) 201-0000", 50)).toBe("5552010000|50.00"); expect(lockKey("555201000", 50)).toBeNull(); });
  it("expires/prunes and never shortens an existing lock", () => {
    const key = lockKey("5552010000", 50); setLock(key, "unknown", 600000); setLock(key, "paid", 180000); expect(activeLock(key)).toEqual({ s: "paid", until: Date.now() + 600000 });
    vi.setSystemTime(Date.now() + 600001); expect(activeLock(key)).toBeNull(); expect(JSON.parse(localStorage.getItem("cp_paylock_v1") || "{}")).toEqual({});
  });
  it("fails open when storage throws", () => { vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("unavailable"); }); expect(activeLock("5552010000|50.00")).toBeNull(); });
});
describe("actual Checkout submit wrapper", () => {
  it("blocks/extends a second call but permits another amount or phone", async () => {
    const raw = vi.fn(() => new Promise(() => {})); const first = wrapper(raw); void first.fn({ payment_method: "cardpayment" }); await flushMicro(); const key = "5552010000|50.00";
    expect(activeLock(key)?.s).toBe("pending"); const before = activeLock(key)?.until || 0; vi.setSystemTime(Date.now() + 1000);
    expect(await first.fn({ payment_method: "cardpayment" })).toEqual({ success: false, code: "MAYBE_PAID_LOCK" }); expect(activeLock(key)?.until).toBeGreaterThan(before); expect(raw).toHaveBeenCalledTimes(1);
    void wrapper(raw, "5552010000", 51).fn({ payment_method: "cardpayment" }); void wrapper(raw, "5552010001", 50).fn({ payment_method: "cardpayment" }); await flushMicro(); expect(raw).toHaveBeenCalledTimes(3);
  });
  it.each(["decline", "refund", "DUP_CONFIRM", "PLAN_GUARD", "HostedURL"])("clears lock for %s", async (code) => {
    const raw = code === "HostedURL" ? { success: true, data: { status: true, HostedURL: "https://example.invalid" } } : code === "refund" ? { success: true, refund_signal: true, data: { status: false } } : { success: false, code };
    await wrapper(vi.fn().mockResolvedValue(raw)).fn({ payment_method: "cardpayment" }); expect(activeLock("5552010000|50.00")).toBeNull();
  });
  it("sets paid for success and SESSION_PAID", async () => {
    const a = wrapper(vi.fn().mockResolvedValue({ success: true, data: { status: true, hashid: "ORDER1234" } })); await a.fn({ payment_method: "cardpayment" }); expect(activeLock("5552010000|50.00")?.s).toBe("paid"); clearLock("5552010000|50.00");
    expect(await wrapper(vi.fn().mockResolvedValue({ success: false, code: "SESSION_PAID", hashid: "ORDER1234" })).fn({ payment_method: "cardpayment" })).toMatchObject({ success: true }); expect(activeLock("5552010000|50.00")?.s).toBe("paid");
  });
  it.each([503, undefined])("unknown thrown outcome (%s) becomes MAYBE_PAID for 10 minutes", async (status) => {
    const e = Object.assign(new Error("offline"), { cpStatus: status }); expect(await wrapper(vi.fn().mockRejectedValue(e)).fn({ payment_method: "cardpayment" })).toEqual({ success: false, code: "MAYBE_PAID" }); expect(activeLock("5552010000|50.00")).toEqual({ s: "unknown", until: Date.now() + PAYLOCK_UNKNOWN_MS });
  });
  it.each([400, "PlanGuardError"])("precharge refusal %s clears/rethrows", async (kind) => {
    const e = Object.assign(new Error("refused"), typeof kind === "number" ? { cpStatus: kind } : { name: kind }); await expect(wrapper(vi.fn().mockRejectedValue(e)).fn({ payment_method: "cardpayment" })).rejects.toBe(e); expect(activeLock("5552010000|50.00")).toBeNull();
  });
  it("shows at 45 seconds and late success navigates through actual handleResult exactly once", async () => {
    const navigate = vi.fn(); const w = wrapper(() => new Promise((r) => setTimeout(() => r({ success: true, data: { status: true, hashid: "ORDER1234" } }), 50000)));
    const block = source.slice(source.indexOf("  const handleResult = (raw:"), source.indexOf("\n  // ─── Credit Card"));
    const noop = vi.fn(); const handleResult = compile(`${block}\nreturn handleResult;`, { hasRefundSignal: () => false, showVzBlock: noop, paymentMethod: "card", clearFunds: noop, clearKlarnaSrc: noop, phone10: "5552010000", state: { carrierSlug: "tmobile", carrierName: "T-Mobile", planId: "834", amount: 50 }, validation: { amount: 50, total: 50 }, setPurchasePending: noop, earlyPurchase: noop, recordMarketingOptIn: noop, mktOptInRef: { current: false }, lang: "en", brandColor: "", clearCheckoutCtx: noop, AP_TICKS_KEY: "ticks", autoPay: false, autoPayTerms: false, gpRecurringRef: { current: false }, AP_LAST_KEY: "last", clearCardDeclines: noop, clearSessionDeclines: noop, navigate }) as (r: Record<string, unknown>) => void;
    const pending = w.fn({ payment_method: "cardpayment" }).then((r) => handleResult(r as Record<string, unknown>)); await vi.advanceTimersByTimeAsync(45000); expect(w.until).toHaveLength(1); expect(navigate).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(5000); await pending; expect(navigate).toHaveBeenCalledTimes(1); expect(navigate.mock.calls[0][0]).toContain("/order-confirmation?");
  });
});
describe("maybe-paid card", () => {
  it.each(["en", "es"])("renders localized payment/refill state and pause only for blocked repeats (%s)", (lang) => {
    const start = source.indexOf("{maybePaid && (() => {"); const end = source.indexOf("      {showSaveInfoTip", start);
    const jsx = source.slice(start, end).trim();
    for (const carrierSlug of ["metropcs", "boost", "topup-crc", "tmobile"]) for (const paused of [false, true]) {
      const card = compile(`return (${jsx.slice(1, -1)});`, { React, maybePaid: { until: Date.now() + 180000 }, lang, state: { carrierSlug, carrierName: carrierSlug === "topup-crc" ? "Cricket Wireless" : carrierSlug }, maybePaidPaused: paused, confirmingPay: false, confirmingMessage: checkoutTimeout.confirmingMessage, setMaybePaid: vi.fn(), setMaybePaidPaused: vi.fn(), Button: (props: Record<string, unknown>) => React.createElement("button", { onClick: props.onClick, children: props.children }) }, true) as React.ReactElement;
      const view = render(card); const text = view.getByTestId("maybe-paid-card").textContent || ""; const payment = carrierSlug !== "tmobile";
      expect(text).toContain(lang === "es" ? `Es posible que su ${payment ? "pago" : "recarga"} se haya realizado` : `Your ${payment ? "payment" : "refill"} may have gone through`);
      expect(text).toContain(lang === "es" ? "Por favor, no vuelva a pagar. Revise su recibo por mensaje de texto o correo electrónico en los próximos minutos, o comuníquese con support@getcellpay.com." : "Please don't pay again. Check your text or email receipt in the next few minutes, or contact support@getcellpay.com.");
      expect(view.queryByTestId("maybe-paid-pause") !== null).toBe(paused); expect(view.getAllByRole("button")).toHaveLength(2); expect(text).not.toMatch(/try again|retry|intentar de nuevo/i); act(() => view.getByRole("button", { name: lang === "es" ? "Cerrar" : "Close" }).click()); view.unmount();
    }
  });
});
describe("pure isolate MEMDUP", () => {
  const p = (amount = 50, last4 = "1234") => ({ phone_number: "15552010000", amount, payment: { cc_number: last4 } });
  it("builds card/Apple keys without retaining tokens", () => {
    expect(memdupKey(p(), "CARDPAYMENT")).toBe("5552010000|50.00|cardpayment|1234"); expect(memdupKey({ phone_number: "5552010000", amount: 50, apple_pay_token: JSON.stringify({ paymentMethod: { displayName: "Visa 4321" } }) }, "applepay")).toBe("5552010000|50.00|applepay|4321");
  });
  it("blocks inflight, extends hits, serves success hashid, and allows confirmed success", () => {
    const m = new Map<string, MemdupEntry>(); const k = memdupKey(p(), "cardpayment"); expect(memdupCheck(m, k, false)).toBeNull(); vi.setSystemTime(Date.now() + 1000); expect(memdupCheck(m, k, false)).toEqual({ code: "IN_FLIGHT" }); expect(k && m.get(k)?.exp).toBe(Date.now() + 180000);
    memdupUpdate(m, k, "success", "ORDER1234"); expect(memdupCheck(m, k, false)).toEqual({ code: "SESSION_PAID", hashid: "ORDER1234" }); expect(memdupCheck(m, k, true)).toBeNull();
  });
  it("deletes decline, keeps unknown for 10 minutes, allows different last4/amount", () => {
    const m = new Map<string, MemdupEntry>(); const k = memdupKey(p(), "cardpayment"); memdupCheck(m, k, false); memdupUpdate(m, k, "decline"); expect(m.size).toBe(0); memdupCheck(m, k, false); memdupUpdate(m, k, "unknown"); expect(k && m.get(k)?.exp).toBe(Date.now() + MEMDUP_UNKNOWN_MS); expect(memdupCheck(m, memdupKey(p(51), "cardpayment"), false)).toBeNull(); expect(memdupCheck(m, memdupKey(p(50, "5678"), "cardpayment"), false)).toBeNull();
  });
  it("keeps only 2000 entries and prunes expired on access", () => {
    const m = new Map<string, MemdupEntry>(); for (let i = 0; i < 2001; i++) memdupCheck(m, String(i), false); expect(m.size).toBe(2000); expect(m.has("0")).toBe(false); vi.setSystemTime(Date.now() + 180001); memdupCheck(m, null, false); expect(m.size).toBe(0);
  });
});

describe("actual proxy post-payment pipeline", () => {
  const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8");
  const helpers = proxy.slice(proxy.indexOf("const REFUND_FAILURE_MESSAGE"), proxy.indexOf("async function finishTransactionLog"));
  const pipeline = proxy.slice(proxy.indexOf("// Always return 200 so supabase.functions.invoke doesn't throw"), proxy.indexOf("// Pockyt Cash App session status polling"));
  async function run(data: unknown, status = 200, late = false, pockyt = false) {
    const writes: Array<{ name: string; args: unknown[] }> = [];
    const capture = (name: string) => (...args: unknown[]) => { writes.push({ name, args: structuredClone(args) }); return Promise.resolve(null); };
    const m = new Map<string, MemdupEntry>(); memdupCheck(m, "test", false);
    let release: ((id: string) => void) | undefined;
    const idP = late ? new Promise<string>((r) => { release = r; }) : Promise.resolve("new-order");
    const posts: Promise<unknown>[] = [];
    const reply = compile(`${helpers}\nreturn (async () => { ${pipeline} return wrapped; })();`, {
      asRecord: (v: unknown) => v && typeof v === "object" && !Array.isArray(v) ? v : {}, text: (v: unknown) => v === null || v === undefined ? null : String(v),
      data, response: { ok: status >= 200 && status < 300, status }, rawText: JSON.stringify(data), rawReplyParseFailed: false,
      shouldLogTransaction: true, isPockytCreate: pockyt, isPlaidCheckout: false, isPayPalTx: false, endpoint: "checkout/transaction", paymentMethod: pockyt ? "pockyt" : "cardpayment",
      txLogId: late ? null : "new-order", payload: {}, payloadRecord: {}, callerHost: "", riskAction: "", refillKey: "key",
      logRawCellPayReply: capture("raw"), logCarrierCheck: vi.fn(), refillCooldownRpc: capture("cooldown"), callDatabaseRpc: capture("rpc"),
      finishTransactionLog: capture("finish"), logDataErr: capture("dataErr"), logCardFacts: capture("cardFacts"),
      isRefillErrorResult: (v: { data?: { status?: boolean; message?: string } }) => v.data?.status === false && /error during refill/i.test(v.data?.message || ""),
      memdupUpdate, MEMDUP: m, memKey: pockyt ? null : "test", logIdP: () => idP, raceNull, waitUntilSafe: (p: Promise<unknown>) => posts.push(p), structuredClone,
    }) as Promise<Record<string, unknown>>;
    await flushMicro();
    if (late) await vi.advanceTimersByTimeAsync(1500);
    const wrapped = await reply;
    return { wrapped, writes, m, posts, release };
  }
  it("returns during an unavailable log create, retains synchronous paid dedupe, then finalizes a late row without reply-only fields", async () => {
    const data = { status: true, hashid: "ORDER1234", transactionId: "ORDER1234" };
    const out = await run(data, 200, true);
    expect(out.wrapped).toEqual({ success: true, data }); expect(out.writes.some((w) => w.name === "finish")).toBe(false); expect(out.m.get("test")?.s).toBe("success");
    out.release?.("late-row"); await Promise.all(out.posts); expect(out.writes.find((w) => w.name === "finish")?.args).toEqual(["late-row", { success: true, data }, "cardpayment", 10000]);
  });
  it("preserves refund auditing and cooldown-before-card-facts order", async () => {
    const out = await run({ status: true, hashid: "not-returned", message: "There was some error during refill. This transaction has been auto refunded." });
    expect(out.wrapped.data).toMatchObject({ status: false, refund_signal: true }); expect(out.m.size).toBe(0);
    const final = out.writes.find((w) => w.name === "rpc" && w.args[0] === "finalize_transaction_log"); expect(final?.args[1]).toMatchObject({ _id: "new-order", _status: "failed", _hashid: null, _transaction_id: null }); expect(final?.args[2]).toBe(10000);
    expect(out.writes.findIndex((w) => w.name === "cooldown")).toBeLessThan(out.writes.findIndex((w) => w.name === "cardFacts"));
    expect(out.writes.find((w) => w.name === "cardFacts")?.args[2]).not.toHaveProperty("pending_log_id");
  });
  it("preserves CHARGE_UNCONFIRMED rewrite and Cash App HostedURL", async () => {
    const out = await run({ status: false, message: "SQLSTATE[23000]: constraint" }, 400); expect(out.wrapped.code).toBe("CHARGE_UNCONFIRMED"); expect(JSON.stringify(out.wrapped)).not.toContain("SQLSTATE"); expect(out.m.get("test")?.s).toBe("unknown");
    const cash = await run({ status: true, HostedURL: "https://example.invalid" }, 200, false, true); expect(cash.wrapped.data).toEqual({ status: true, HostedURL: "https://example.invalid" }); expect(cash.writes.find((w) => w.name === "finish")?.args[2]).toBe("pockyt");
  });
});