import { afterEach, describe, expect, it, vi } from "vitest"; // DBT-FOLLOWUP-1017
import { readFileSync } from "node:fs"; // DBT-FOLLOWUP-1017
import { resetFunnel, trackFunnel } from "@/lib/funnelEvents"; // DBT-FOLLOWUP-1017
const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // DBT-FOLLOWUP-1017
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8"); // DBT-FOLLOWUP-1017
const funnel = readFileSync("supabase/functions/funnel-event/index.ts", "utf8"); // DBT-FOLLOWUP-1017
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); resetFunnel(); }); // DBT-FOLLOWUP-1017
describe("DBT-FOLLOWUP-1017", () => { // DBT-FOLLOWUP-1017
  it("links raw replies immediately or through the late id without another three-second wait", () => { // DBT-FOLLOWUP-1017
    const line = proxy.split("\n").find((value) => value.includes("if (shouldLogTransaction) {") && value.includes("// DBT-FOLLOWUP-1017")); // DBT-FOLLOWUP-1017
    expect(line).toContain("if (txLogId) logRawCellPayReply(txLogId, endpoint, response.status, paymentMethod, data, rawText, rawReplyParseFailed)"); // DBT-FOLLOWUP-1017
    expect(line).toContain("waitUntilSafe(logIdP().then((lateId) => logRawCellPayReply(lateId, endpoint, st, paymentMethod, rawCopy, rawText, rawReplyParseFailed))"); // DBT-FOLLOWUP-1017
    expect(line).toContain(".catch(() => logRawCellPayReply(null, endpoint, st, paymentMethod, rawCopy, rawText, rawReplyParseFailed))"); // DBT-FOLLOWUP-1017
    expect(line).toContain("structuredClone(data)"); // DBT-FOLLOWUP-1017
    expect(line).not.toContain("await"); // DBT-FOLLOWUP-1017
    expect(proxy.split("const txLogId = await raceNull(createP, 3000)")).toHaveLength(2); // DBT-FOLLOWUP-1017
  }); // DBT-FOLLOWUP-1017
  it("tracks both maybe-paid states from existing funnel data", () => { // DBT-FOLLOWUP-1017
    const start = checkout.indexOf("  const showMaybePaid = (paused: boolean, until?: number) => { // DB-OUTAGE-TRACK-1017"); // DBT-FOLLOWUP-1017
    expect(start).toBeGreaterThan(-1); // DBT-FOLLOWUP-1017
    const block = checkout.slice(start, checkout.indexOf("\n  };", start)); // DBT-FOLLOWUP-1017
    expect(block).toContain('setMaybePaid({ until: until ?? activeLock(key)?.until ?? Date.now() + PAYLOCK_UNKNOWN_MS });\n    try { trackFunnel(paused ? "maybe_paid_lock_shown" : "maybe_paid_shown", funnelDataRef.current, String(Date.now())); } catch { /* ignore */ } // DBT-FOLLOWUP-1017'); // DBT-FOLLOWUP-1017
  }); // DBT-FOLLOWUP-1017
  it.each(["maybe_paid_shown", "maybe_paid_lock_shown"])("allows %s only in the legacy event set", (event) => { // DBT-FOLLOWUP-1017
    const events = funnel.match(/const EVENTS = new Set\(\[([^\n]+)\]\)/)?.[1]; // DBT-FOLLOWUP-1017
    const klarnaEvents = funnel.match(/const KLARNA_EVENTS = new Set\(\[([^\n]+)\]\)/)?.[1]; // DBT-FOLLOWUP-1017
    expect(events).toContain(`"${event}"`); // DBT-FOLLOWUP-1017
    expect(klarnaEvents).toBeDefined(); // DBT-FOLLOWUP-1017
    expect(klarnaEvents).not.toContain(`"${event}"`); // DBT-FOLLOWUP-1017
  }); // DBT-FOLLOWUP-1017
  it("sends maybe_paid_shown without a phone field", async () => { // DBT-FOLLOWUP-1017
    resetFunnel(); // DBT-FOLLOWUP-1017
    const sendBeacon = vi.fn(() => true); // DBT-FOLLOWUP-1017
    vi.stubGlobal("navigator", { sendBeacon }); // DBT-FOLLOWUP-1017
    const data = { carrier: "metro", amount: 30, phone: "2025550199" }; // DBT-FOLLOWUP-1017
    trackFunnel("maybe_paid_shown", data, "k1"); // DBT-FOLLOWUP-1017
    expect(sendBeacon).toHaveBeenCalledTimes(1); // DBT-FOLLOWUP-1017
    const blob = (sendBeacon.mock.calls as unknown[][])[0]?.[1]; // DBT-FOLLOWUP-1017
    expect(blob).toBeInstanceOf(Blob); // DBT-FOLLOWUP-1017
    if (!(blob instanceof Blob)) throw new Error("Missing beacon body"); // DBT-FOLLOWUP-1017
    const body = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob); }); // DBT-FOLLOWUP-1017
    expect(JSON.parse(body)).toMatchObject({ event: "maybe_paid_shown", carrier: "metro", amount: 30 }); // DBT-FOLLOWUP-1017
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["amount", "carrier", "client_ts", "event", "fee", "lang", "session_id", "total"]); // DBT-FOLLOWUP-1017
    expect(body).not.toContain(data.phone); // DBT-FOLLOWUP-1017
  }); // DBT-FOLLOWUP-1017
}); // DBT-FOLLOWUP-1017