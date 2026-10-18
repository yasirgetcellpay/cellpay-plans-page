import { beforeEach, describe, expect, it, vi } from "vitest"; // KLARNA-LOG-1017
import { readFileSync } from "node:fs"; // KLARNA-LOG-1017
import { runInNewContext } from "node:vm"; // KLARNA-LOG-1017
import ts from "typescript"; // KLARNA-LOG-1017
import { resetFunnel, trackFunnel } from "@/lib/funnelEvents"; // KLARNA-LOG-1017
const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // KLARNA-LOG-1017
const page = readFileSync("src/pages/Checkout.tsx", "utf8"); // KLARNA-LOG-1017
const compile = (source: string) => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }); // KLARNA-LOG-1017
const start = proxy.indexOf("export function klarnaTotalBand("); // KLARNA-LOG-1017
const end = proxy.indexOf("function logKlarnaSession(", start); // KLARNA-LOG-1017
const exported = runInNewContext(compile(proxy.slice(start, end)) + "; exports;", { exports: {} }) as { // KLARNA-LOG-1017
  klarnaTotalBand: (v: unknown) => string; // KLARNA-LOG-1017
  klarnaSrcLabel: (v: unknown) => string; // KLARNA-LOG-1017
  klarnaSessionOutcome: (ok: boolean, v: unknown) => string; // KLARNA-LOG-1017
  klarnaCategories: (v: unknown) => string; // KLARNA-LOG-1017
  klarnaSessionEvent: (outcome: string, status: number, total: unknown, host: string | null, origin: boolean, log: unknown, categories?: string) => Record<string, unknown>; // KLARNA-LOG-1017
}; // KLARNA-LOG-1017
const edge = readFileSync("supabase/functions/funnel-event/index.ts", "utf8"); // KLARNA-LOG-1017
const clean = runInNewContext(compile(edge.slice(0, edge.indexOf("Deno.serve("))) + "; clean;") as (v: unknown, host: string | null) => Record<string, unknown>; // KLARNA-LOG-1017
const beacon = vi.fn(() => true); // KLARNA-LOG-1017
beforeEach(() => { resetFunnel(); beacon.mockClear(); Object.defineProperty(navigator, "sendBeacon", { configurable: true, writable: true, value: beacon }); }); // KLARNA-LOG-1017
const sentBody = async () => { // KLARNA-LOG-1017
  const blob = (beacon.mock.calls as unknown[][])[0]?.[1] as Blob; // KLARNA-LOG-1017
  const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob); }); // KLARNA-LOG-1017
  return JSON.parse(text); // KLARNA-LOG-1017
}; // KLARNA-LOG-1017
describe("KLARNA-LOG-1017", () => { // KLARNA-LOG-1017
  it.each([[24.99, "<25"], [25, "25-50"], [49.99, "25-50"], [50, "50-100"], [99.99, "50-100"], [100, "100+"], [undefined, "unknown"], ["abc", "unknown"], [null, "unknown"], ["", "unknown"]])("bands %s as %s", (v, expected) => { expect(exported.klarnaTotalBand(v)).toBe(expected); }); // KLARNA-LOG-1017
  it.each([["method_list", "list"], ["decline_nsf", "funds-klarna"], ["decline_other", "decline-klarna"], ["other", "unknown"]])("labels %s", (v, expected) => { expect(exported.klarnaSrcLabel(v)).toBe(expected); }); // KLARNA-LOG-1017
  it("finds tokens at each supported nesting level without accepting missing tokens", () => { // KLARNA-LOG-1017
    const token = { client_token: "test-placeholder" }; // KLARNA-LOG-1017
    for (const data of [token, { data: token }, { data: { data: token } }]) { expect(exported.klarnaSessionOutcome(true, data)).toBe("ok"); expect(exported.klarnaSessionOutcome(false, data)).toBe("http_error"); } // KLARNA-LOG-1017
    for (const data of [null, {}, { client_token: "" }, { client_token: 123 }, { client_token: "   " }]) expect(exported.klarnaSessionOutcome(true, data)).toBe("no_token"); // KLARNA-LOG-1017
  }); // KLARNA-LOG-1017
  it("reads category identifiers at each supported level and caps valid strings at five", () => { // KLARNA-LOG-1017
    const data = { payment_method_categories: [{ identifier: "pay_now" }, { identifier: "pay_over_time" }] }; // KLARNA-LOG-1017
    for (const row of [data, { data }, { data: { data } }]) expect(exported.klarnaCategories(row)).toBe("pay_now+pay_over_time"); // KLARNA-LOG-1017
    expect(exported.klarnaCategories({})).toBe("none"); // KLARNA-LOG-1017
    expect(exported.klarnaCategories({ payment_method_categories: [null, { identifier: "INVALID" }, { identifier: "x".repeat(31) }] })).toBe("none"); // KLARNA-LOG-1017
    expect(exported.klarnaCategories({ payment_method_categories: Array.from({ length: 7 }, () => ({ identifier: "pay_now" })) })).toBe(Array(5).fill("pay_now").join("+")); // KLARNA-LOG-1017
  }); // KLARNA-LOG-1017
  it("stores six coarse pipe fields and excludes all sensitive inputs and exact totals", () => { // KLARNA-LOG-1017
    const row = exported.klarnaSessionEvent("ok", 200, 28.99, "example.test", true, { lang: "es", src: "decline_nsf", phone: "private-phone", email: "private-email", client_token: "private-token", name: "private-name", ip: "private-ip" }, "pay_now+pay_over_time"); // KLARNA-LOG-1017
    expect(row).toEqual({ code: "klarna_session:ok", method: "POST", endpoint_shape: "klarna_session|200|25-50|es|funds-klarna|pay_now+pay_over_time", origin_host: "example.test", has_origin: true }); // KLARNA-LOG-1017
    expect(String(row.endpoint_shape).split("|")).toHaveLength(6); // KLARNA-LOG-1017
    expect(JSON.stringify(row)).not.toMatch(/private-|28\.99|phone|email|token/); // KLARNA-LOG-1017
    expect(exported.klarnaSessionEvent("no_token", 200, undefined, null, false, { lang: "fr", src: "bad" }).endpoint_shape).toBe("klarna_session|200|unknown|unknown|unknown|none"); // KLARNA-LOG-1017
  }); // KLARNA-LOG-1017
  it("preserves category selection and never hardcodes pay_later", () => { expect(page).toContain("pickKlarnaCategory(klarnaCats)"); expect(page).not.toContain('payment_method_category: "pay_later"'); }); // KLARNA-LOG-1017
  it("sends failure event, screen and reason through the beacon", async () => { trackFunnel("klarna_session_failed", { screen: "decline_nsf", klarna_reason: "sdk_missing" }); expect(await sentBody()).toMatchObject({ event: "klarna_session_failed", screen: "decline_nsf", klarna_reason: "sdk_missing" }); }); // KLARNA-LOG-1017
  it("sends false finalize_required and error field names", async () => { trackFunnel("klarna_auth_result", { klarna_finalize_required: false, klarna_error: "invalid_fields:billing_address.email" }); expect(await sentBody()).toMatchObject({ klarna_finalize_required: false, klarna_error: "invalid_fields:billing_address.email" }); }); // KLARNA-LOG-1017
  it("always provides identical optional keys for Klarna rows and rejects unsafe error strings", () => { // KLARNA-LOG-1017
    expect(clean({ event: "klarna_session_failed", klarna_reason: "sdk_missing", klarna_finalize_required: false, klarna_error: "invalid_fields:billing_address.email" }, null)).toMatchObject({ klarna_reason: "sdk_missing", klarna_finalize_required: false, klarna_error: "invalid_fields:billing_address.email" }); // KLARNA-LOG-1017
    for (const row of [{ event: "klarna_auth_result" }, { event: "klarna_session_failed", klarna_reason: "bad", klarna_finalize_required: "false", klarna_error: "person@example.test" }]) expect(clean(row, null)).toMatchObject({ klarna_reason: null, klarna_finalize_required: null, klarna_error: null }); // KLARNA-LOG-1017
    expect(clean({ event: "submitted", klarna_reason: "sdk_missing" }, null)).not.toHaveProperty("klarna_reason"); // KLARNA-LOG-1017
  }); // KLARNA-LOG-1017
  it("extracts SDK error field names only", () => { // KLARNA-LOG-1017
    const line = page.split("\n").find(line => line.includes("const klarnaErrKeys =")); // KLARNA-LOG-1017
    if (!line) throw new Error("Missing error key helper"); // KLARNA-LOG-1017
    const keys = runInNewContext(compile(line) + "; klarnaErrKeys;"); // KLARNA-LOG-1017
    expect(keys({ invalid_fields: ["billing_address.email", "billing_address.phone", "person@example.test"] })).toBe("invalid_fields:billing_address.email,billing_address.phone"); // KLARNA-LOG-1017
    expect(keys({ authorization_token: "private-token", email: "private-email" })).toBe("keys:authorization_token,email"); // KLARNA-LOG-1017
    expect(keys(null)).toBeUndefined(); // KLARNA-LOG-1017
  }); // KLARNA-LOG-1017
  it.each(["ok", "no_form", "error", "throw", "timeout"])("logs without changing SDK authorization order and arguments: %s", async (mode) => { // KLARNA-LOG-1017
    const promiseStart = page.indexOf("    return new Promise<void>((resolve) => {", page.indexOf("  const handleKlarna = async")); // KLARNA-LOG-1017
    const promiseEnd = page.indexOf("\n  };", promiseStart); // KLARNA-LOG-1017
    const js = ts.transpile(page.slice(promiseStart, promiseEnd), { target: ts.ScriptTarget.ES2022 }); // KLARNA-LOG-1017
    const events: unknown[][] = []; // KLARNA-LOG-1017
    const authorize = vi.fn((_opts, _data, cb) => cb({ approved: false, show_form: false, finalize_required: false, error: { invalid_fields: ["billing_address.email"] } })); // KLARNA-LOG-1017
    vi.useFakeTimers(); // KLARNA-LOG-1017
    const load = vi.fn((_opts, _data, cb) => { if (mode === "throw") throw new Error("SDK load failed"); if (mode !== "timeout") cb(mode === "ok" ? { show_form: true } : mode === "error" ? { error: true } : { show_form: false }); }); // KLARNA-LOG-1017
    const names = ["klarnaPayments", "klarnaCategory", "klarnaLoc", "trackKlarna", "readKlarnaSrc", "phone10", "klarnaAttempt", "klarnaFirstName", "klarnaLastName", "emailCleanRef", "klarnaPhone", "klarnaAddress", "klarnaCity", "klarnaCountry", "klarnaState", "klarnaZip", "normalizeRegionCode", "patchFunds", "setErrorMsg", "setSubmitting", "klarnaErrKeys"]; // KLARNA-LOG-1017
    const run = new Function(...names, js); // KLARNA-LOG-1017
    const errLine = page.split("\n").find(line => line.includes("const klarnaErrKeys =")); // KLARNA-LOG-1017
    if (!errLine) throw new Error("Missing helper"); // KLARNA-LOG-1017
    const keys = runInNewContext(compile(errLine) + "; klarnaErrKeys;"); // KLARNA-LOG-1017
    const result = run({ load, authorize }, "pay_over_time", "es-US", (...args: unknown[]) => events.push(args), () => "method_list", "", "1", "", "", { current: "" }, "", "", "", "US", "", "", () => "", vi.fn(), vi.fn(), vi.fn(), keys); // KLARNA-LOG-1017
    if (mode === "timeout") { expect(authorize).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(8000); } // KLARNA-LOG-1017
    await result; vi.useRealTimers(); // KLARNA-LOG-1017
    expect(load).toHaveBeenCalledWith({ container: "#klarna-payments-container", payment_method_category: "pay_over_time" }, { locale: "es-US" }, expect.any(Function)); // KLARNA-LOG-1017
    expect(authorize).toHaveBeenCalledTimes(1); // KLARNA-LOG-1017
    expect(events[0]?.[3]).toMatchObject({ klarna_finalize_required: false, klarna_error: "invalid_fields:billing_address.email", klarna_category: "pay_over_time", klarna_load: mode === "throw" ? "error" : mode }); // KLARNA-LOG-1017
  }); // KLARNA-LOG-1017
}); // KLARNA-LOG-1017
