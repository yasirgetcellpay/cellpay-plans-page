// KLARNA-FUNNEL-1017: real storage/metadata and isolated analytics; no payment requests.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFunds, writeFunds, patchFunds, clearFunds, readKlarnaSrc, setKlarnaSrc, clearKlarnaSrc } from "@/lib/declineRecovery";
import { trackFunnel, resetFunnel } from "@/lib/funnelEvents";

const compile = (code: string) => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const wrapper = readFileSync("src/services/apiWrapper.ts", "utf8");
const storedRetryMeta = runInNewContext(compile(`${wrapper.slice(wrapper.indexOf("function storedRetryMeta("), wrapper.indexOf("export async function submitTransaction("))}; storedRetryMeta;`), { sessionStorage, localStorage, navigator, Date, readFunds, readKlarnaSrc });
const phone = "2025550100";
const beacon = vi.fn((..._args: unknown[]) => true); // KLARNA-FUNNEL-1017
Object.defineProperty(navigator, "sendBeacon", { configurable: true, writable: true, value: beacon }); // KLARNA-FUNNEL-1017: jsdom has no native beacon.
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); resetFunnel(); beacon.mockClear();
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, writable: true, value: (...args: unknown[]) => beacon(...args) }); // KLARNA-FUNNEL-1017
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Klarna retry context", () => {
  it("adds decline_nsf only for Klarna without mutating the payload", () => {
    setKlarnaSrc(phone, "decline_nsf");
    const payload = Object.freeze({ payment_method: "klarna", phone_number: phone, amount: 25 });
    expect(storedRetryMeta(payload)).toEqual({ klarna_src: "decline_nsf" });
    expect(payload).toEqual({ payment_method: "klarna", phone_number: phone, amount: 25 });
    expect(storedRetryMeta({ ...payload, payment_method: "cardpayment" })).toBeUndefined();
  });
  it("defaults Klarna source to method_list", () => {
    expect(storedRetryMeta({ payment_method: "KLARNA", phone_number: phone })).toEqual({ klarna_src: "method_list" });
  });
  it("expires source after 30 minutes", () => {
    vi.useFakeTimers(); setKlarnaSrc(phone, "decline_other");
    vi.advanceTimersByTime(30 * 60_000);
    expect(readKlarnaSrc(phone)).toBe("method_list");
    expect(storedRetryMeta({ payment_method: "klarna", phone_number: phone })).toEqual({ klarna_src: "method_list" });
  });
  it("reads the funds mirror when the primary session copy is absent", () => {
    const flags = { decline_cls: "nsf", klarna_offered: true, klarna_clicked: false, klarna_auth_declined: false, ts: Date.now() };
    writeFunds(phone, flags); sessionStorage.removeItem("cp_funds_v1");
    expect(readFunds(phone)).toEqual(flags);
    expect(readFunds("2025550101")).toBeNull();
    expect(storedRetryMeta({ phone_number: phone, payment_method: "cardpayment" })).toEqual({ decline_cls: "nsf", funds_ui: "v1", klarna_offered: true, klarna_clicked: false, klarna_auth_declined: false });
  });
  it("patches both copies without refreshing the timestamp and clears both on success", () => {
    const flags = { ts: Date.now(), klarna_clicked: false };
    writeFunds(phone, flags); patchFunds(phone, { klarna_clicked: true });
    expect(readFunds(phone)).toEqual({ ...flags, klarna_clicked: true });
    expect(JSON.parse(localStorage.getItem(`cp_funds_phone_v1:${phone}`) || "null")).toEqual(readFunds(phone));
    setKlarnaSrc(phone, "decline_nsf"); clearFunds(phone); clearKlarnaSrc(phone);
    expect(readFunds(phone)).toBeNull(); expect(readKlarnaSrc(phone)).toBe("method_list");
    expect(localStorage.getItem(`cp_klarna_src_phone_v1:${phone}`)).toBeNull();
  });
  it("falls back from stale session funds and rejects expired mirrors", () => {
    writeFunds(phone, { ts: Date.now(), klarna_offered: true });
    sessionStorage.setItem("cp_funds_v1", JSON.stringify({ ts: Date.now() - 30 * 60_000 }));
    expect(readFunds(phone)?.klarna_offered).toBe(true);
    localStorage.setItem(`cp_funds_phone_v1:${phone}`, JSON.stringify({ ts: Date.now() - 30 * 60_000 }));
    expect(readFunds(phone)).toBeNull();
  });
});

describe("Klarna funnel isolation", () => {
  it("dedupes each event and onceKey pair, not distinct declines", () => {
    trackFunnel("klarna_clicked", {}, "decline_nsf|1"); trackFunnel("klarna_clicked", {}, "decline_nsf|1");
    trackFunnel("klarna_clicked", {}, "decline_nsf|2"); trackFunnel("klarna_offer_shown", {}, "decline_nsf|1");
    expect(beacon).toHaveBeenCalledTimes(3);
  });
  it("keeps legacy event-name dedupe", () => {
    trackFunnel("submitted"); trackFunnel("submitted"); trackFunnel("payment_started"); trackFunnel("payment_started");
    expect(beacon).toHaveBeenCalledTimes(2);
  });
  it("keeps total_shown amount/fee dedupe unchanged", () => {
    trackFunnel("total_shown", { amount: 25, fee: 2 }); trackFunnel("total_shown", { amount: 25, fee: 2 });
    trackFunnel("total_shown", { amount: 25, fee: 3 }); expect(beacon).toHaveBeenCalledTimes(2);
  });
  it("only adds Klarna dimensions to Klarna bodies", async () => {
    const data = { screen: "decline_nsf" as const, decline_ab: "control" as const, checkout_session_id: "random_session", shown: true, cap: false };
    const posted: string[] = [];
    vi.spyOn(navigator, "sendBeacon").mockImplementation(() => false);
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => { posted.push(String(init.body)); return Promise.resolve(new Response()); }));
    trackFunnel("submitted", data); trackFunnel("klarna_offer_shown", data, "1");
    expect(JSON.parse(posted[0])).not.toHaveProperty("screen");
    expect(Object.keys(JSON.parse(posted[0])).sort()).toEqual(["event", "carrier", "amount", "fee", "total", "session_id", "lang", "client_ts"].sort());
    expect(JSON.parse(posted[1])).toMatchObject(data);
    vi.unstubAllGlobals();
  });
  it("validates new dimensions and keeps legacy edge rows unchanged", () => {
    const edge = readFileSync("supabase/functions/funnel-event/index.ts", "utf8");
    const clean = runInNewContext(compile(`${edge.slice(0, edge.indexOf("Deno.serve("))}; clean;`));
    const extras = { screen: "decline_nsf", decline_ab: "variant", checkout_session_id: "test_session", klarna_result: "approved", shown: true, cap: false };
    expect(clean({ event: "klarna_offer_shown", ...extras }, null)).toMatchObject(extras);
    expect(clean({ event: "submitted", ...extras }, null)).not.toHaveProperty("screen");
    expect(clean({ event: "klarna_auth_result", screen: "bad", decline_ab: "bad", checkout_session_id: "bad session", klarna_result: "bad", shown: 1, cap: "true" }, null)).toMatchObject({ screen: null, decline_ab: null, checkout_session_id: null, klarna_result: null, shown: null, cap: null });
  });
  it("isolates new rows in a separate edge request even when they fail", async () => {
    const edge = readFileSync("supabase/functions/funnel-event/index.ts", "utf8");
    let handler: (r: Request) => Promise<Response> = async () => new Response();
    const batches: Record<string, unknown>[][] = []; const pending: Promise<unknown>[] = [];
    runInNewContext(compile(edge), { Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: () => "test" } }, Response, AbortSignal, EdgeRuntime: { waitUntil: (p: Promise<unknown>) => pending.push(p) }, fetch: (_url: string, opts: RequestInit) => { const rows = JSON.parse(String(opts.body)); batches.push(rows); return rows[0].event.startsWith("klarna_") ? Promise.reject(new Error("analytics unavailable")) : Promise.resolve(new Response()); } });
    const response = await handler(new Request("https://example.test", { method: "POST", body: JSON.stringify([{ event: "submitted" }, { event: "klarna_clicked", screen: "method_list" }]) }));
    await Promise.all(pending);
    expect(response.status).toBe(204); expect(batches).toHaveLength(2);
    expect(batches[0].map(r => r.event)).toEqual(["submitted"]); expect(batches[1].map(r => r.event)).toEqual(["klarna_clicked"]);
  });
});