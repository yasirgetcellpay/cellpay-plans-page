// DECLINE-REJECTED-1018: pure classification, recovery actions and isolated PII-free logging.
import { readFileSync } from "node:fs"; // DECLINE-REJECTED-1018
import { runInNewContext } from "node:vm"; // DECLINE-REJECTED-1018
import ts from "typescript"; // DECLINE-REJECTED-1018
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"; // DECLINE-REJECTED-1018
import { classifyDecline, noSameRetry, isNsfDecline, declineBtnCode, declineActionFor } from "@/lib/declineRecovery"; // DECLINE-REJECTED-1018
import { resetFunnel, trackFunnel } from "@/lib/funnelEvents"; // DECLINE-REJECTED-1018
const compile = (code: string) => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }); // DECLINE-REJECTED-1018
const edge = readFileSync("supabase/functions/funnel-event/index.ts", "utf8"); // DECLINE-REJECTED-1018
const clean = runInNewContext(compile(`${edge.slice(0, edge.indexOf("Deno.serve("))}; clean;`)); // DECLINE-REJECTED-1018
beforeEach(() => { resetFunnel(); sessionStorage.clear(); }); // DECLINE-REJECTED-1018
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); }); // DECLINE-REJECTED-1018

describe("DECLINE-REJECTED-1018", () => {
  it.each([ // DECLINE-REJECTED-1018
    ["Transaction rejected", "risk"], ["This transaction was rejected", "risk"], // DECLINE-REJECTED-1018
    ["Decline - Stolen or lost card.", "blocked"], ["Transaction rejected - stolen card", "blocked"], // DECLINE-REJECTED-1018
    ["Decline - Insufficient funds in the account.", "funds"], // DECLINE-REJECTED-1018
    ["Decline - General decline of the card. No other information provided by the issuing bank.", "funds"], // DECLINE-REJECTED-1018
    ["Do not honor", "funds"], // DECLINE-REJECTED-1018
  ])("classifies %s as %s", (msg, cls) => { expect(classifyDecline(msg)).toBe(cls); }); // DECLINE-REJECTED-1018
  it("prevents same-card risk retry without selecting NSF recovery", () => { // DECLINE-REJECTED-1018
    expect(noSameRetry("Transaction rejected", "card")).toBe(true); // DECLINE-REJECTED-1018
    expect(isNsfDecline("Transaction rejected")).toBe(false); // DECLINE-REJECTED-1018
  }); // DECLINE-REJECTED-1018
  it.each([ // DECLINE-REJECTED-1018
    ["decline-applepay", "ap"], ["decline-googlepay", "gp"], ["decline-paypal", "pp"], // DECLINE-REJECTED-1018
    ["decline-cashapp", "cash"], ["decline-paybybank", "bank"], ["decline-another-card", "card"], // DECLINE-REJECTED-1018
    ["decline-retry-card", "retry"], ["funds-same-card", "retry"], ["decline-klarna", "klarna"], // DECLINE-REJECTED-1018
    ["funds-klarna", "klarna"], ["funds-applepay-again", "ap_again"], ["decline-other", "close"], // DECLINE-REJECTED-1018
  ])("maps button %s", (id, code) => { expect(declineBtnCode(id)).toBe(code); }); // DECLINE-REJECTED-1018
  it.each(["decline-ab-primary-wallet", "decline-risk-wallet"])("uses available wallet for %s", id => { // DECLINE-REJECTED-1018
    expect(declineBtnCode(id, "applepay")).toBe("ap"); expect(declineBtnCode(id, "googlepay")).toBe("gp"); // DECLINE-REJECTED-1018
    expect(declineBtnCode(id)).toBeNull(); expect(declineBtnCode(id, "paypal")).toBeNull(); // DECLINE-REJECTED-1018
  }); // DECLINE-REJECTED-1018
  it.each([ // DECLINE-REJECTED-1018
    ["ap", "applepay"], ["gp", "googlepay"], ["pp", "paypal"], ["cash", "cashapp"], // DECLINE-REJECTED-1018
    ["bank", "bank"], ["card", "another_card"], ["retry", "retry_same"], ["klarna", "klarna"], // DECLINE-REJECTED-1018
    ["ap_again", "applepay_again"], ["close", "close"], // DECLINE-REJECTED-1018
  ])("maps action %s", (code, action) => { expect(declineActionFor(code)).toBe(action); }); // DECLINE-REJECTED-1018
  it("fails open for unknown button/action codes", () => { // DECLINE-REJECTED-1018
    for (const v of ["unknown", "toString", "constructor", "__proto__", ""]) { // DECLINE-REJECTED-1018
      expect(declineBtnCode(v)).toBeNull(); expect(declineActionFor(v)).toBeNull(); // DECLINE-REJECTED-1018
    } // DECLINE-REJECTED-1018
    expect(declineActionFor(null)).toBeNull(); // DECLINE-REJECTED-1018
  }); // DECLINE-REJECTED-1018
  it("sends only whitelisted dimensions and dedupes a shown decline", () => { // DECLINE-REJECTED-1018
    const bodies: string[] = []; // DECLINE-REJECTED-1018
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: () => false }); // DECLINE-REJECTED-1018
    vi.stubGlobal("fetch", vi.fn((_url, init) => { bodies.push(String(init.body)); return Promise.resolve({}); })); // DECLINE-REJECTED-1018
    const data = { screen: "risk" as const, decline_buttons: "gp,pp,card,close", ap_available: false, gp_available: true, decline_method: "card", decline_ab: "control" as const, checkout_session_id: "test_session", phone: "excluded", email: "excluded", card: "excluded", card_number: "excluded" }; // DECLINE-REJECTED-1018
    trackFunnel("decline_screen_shown", data, "shown|1"); trackFunnel("decline_screen_shown", data, "shown|1"); // DECLINE-REJECTED-1018
    trackFunnel("decline_action", { ...data, decline_action: "another_card" }, "act|1|card"); // DECLINE-REJECTED-1018
    expect(bodies).toHaveLength(2); // DECLINE-REJECTED-1018
    expect(JSON.parse(bodies[0])).toMatchObject({ event: "decline_screen_shown", screen: "risk", decline_buttons: "gp,pp,card,close", ap_available: false }); // DECLINE-REJECTED-1018
    expect(JSON.parse(bodies[1])).toMatchObject({ event: "decline_action", decline_action: "another_card" }); // DECLINE-REJECTED-1018
    for (const body of bodies) for (const key of ["phone", "email", "card", "card_number"]) expect(JSON.parse(body)).not.toHaveProperty(key); // DECLINE-REJECTED-1018
  }); // DECLINE-REJECTED-1018
  it("allows exact decline dimensions and rejects malformed values", () => { // DECLINE-REJECTED-1018
    const data = { screen: "risk", decline_ab: "variant", checkout_session_id: "test_session", decline_method: "card", ap_available: true, gp_available: false, decline_buttons: "ap,pp,card", decline_action: "another_card" }; // DECLINE-REJECTED-1018
    expect(clean({ event: "decline_action", ...data }, null)).toMatchObject(data); // DECLINE-REJECTED-1018
    const bad = { screen: "method_list", decline_ab: "other", checkout_session_id: "has spaces", decline_method: "klarna", ap_available: 1, gp_available: "false", decline_buttons: "ap,private123", decline_action: "submit" }; // DECLINE-REJECTED-1018
    expect(clean({ event: "decline_screen_shown", ...bad }, null)).toMatchObject(Object.fromEntries(Object.keys(bad).map(k => [k, null]))); // DECLINE-REJECTED-1018
    expect(clean({ event: "submitted", ...data }, null)).not.toHaveProperty("decline_method"); // DECLINE-REJECTED-1018
  }); // DECLINE-REJECTED-1018
  it("isolates decline writes from legacy, Klarna and retry writes on failure", async () => { // DECLINE-REJECTED-1018
    let handler: (r: Request) => Promise<Response> = async () => new Response(); // DECLINE-REJECTED-1018
    const batches: Record<string, unknown>[][] = []; const pending: Promise<unknown>[] = []; // DECLINE-REJECTED-1018
    runInNewContext(compile(edge), { Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: () => "test" } }, Response, AbortSignal, EdgeRuntime: { waitUntil: (p: Promise<unknown>) => pending.push(p) }, fetch: (_url: string, init: RequestInit) => { const rows = JSON.parse(String(init.body)); batches.push(rows); return rows[0].event.startsWith("decline_") ? Promise.reject(new Error("unavailable")) : Promise.resolve(new Response()); } }); // DECLINE-REJECTED-1018
    const response = await handler(new Request("https://example.test", { method: "POST", body: JSON.stringify([{ event: "submitted" }, { event: "klarna_clicked" }, { event: "retry_tapped" }, { event: "decline_screen_shown", screen: "risk" }]) })); // DECLINE-REJECTED-1018
    await Promise.all(pending); // DECLINE-REJECTED-1018
    expect(response.status).toBe(204); expect(pending).toHaveLength(4); // DECLINE-REJECTED-1018
    expect(batches.map(batch => batch.map(row => row.event))).toEqual([["submitted"], ["klarna_clicked"], ["retry_tapped"], ["decline_screen_shown"]]); // DECLINE-REJECTED-1018
  }); // DECLINE-REJECTED-1018
}); // DECLINE-REJECTED-1018
