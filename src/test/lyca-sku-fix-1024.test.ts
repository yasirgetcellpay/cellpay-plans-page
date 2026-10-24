import { beforeEach, describe, expect, it, vi } from "vitest"; // LYCA-SKU-FIX-1024
import { checkDiscBlock, recordDiscBlock, isDiscontinuedLoadText, isDeadAmount, withTimeout } from "@/lib/refillPrevent"; // LYCA-SKU-FIX-1024
import { readFileSync } from "node:fs"; // LYCA-SKU-FIX-1024
import { transpileModule } from "typescript"; // LYCA-SKU-FIX-1024
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); }); // LYCA-SKU-FIX-1024
describe("LYCA-SKU-FIX-1024 discontinued errors", () => { // LYCA-SKU-FIX-1024
  it.each(["Sku 1908 does not exist or discontinued", "Product Not Found", "PRODUCT NOT SOLD", "sku not mapped", "sku not found"])("matches %s", (text) => expect(isDiscontinuedLoadText(text)).toBe(true)); // LYCA-SKU-FIX-1024
  it("does not match Invalid Account", () => expect(isDiscontinuedLoadText("Invalid Account")).toBe(false)); // LYCA-SKU-FIX-1024
  it("conversion errors fail open", () => expect(isDiscontinuedLoadText({ toString: () => { throw new Error("bad"); } })).toBe(false)); // LYCA-SKU-FIX-1024
}); // LYCA-SKU-FIX-1024
describe("isolated 24-hour discontinued block", () => { // LYCA-SKU-FIX-1024
  const now = 1_000_000; // LYCA-SKU-FIX-1024
  it("blocks only within exactly 24 hours", async () => { // LYCA-SKU-FIX-1024
    await recordDiscBlock("2135551234", "lyca", "1908", now); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("(213) 555-1234", "lyca", "1908", now + 24 * 60 * 60 * 1000 - 1)).toBe(true); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "lyca", "1908", now + 24 * 60 * 60 * 1000)).toBe(false); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it("other plan, number or carrier does not match or clear the original", async () => { // LYCA-SKU-FIX-1024
    await recordDiscBlock("2135551234", "lyca", "1908", now); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "lyca", "1907", now)).toBe(false); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("3105551234", "lyca", "1908", now)).toBe(false); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "tmobile", "1908", now)).toBe(false); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "lyca", "1908", now)).toBe(true); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it("uses separate hashed storage without raw phone", async () => { // LYCA-SKU-FIX-1024
    await recordDiscBlock("2135551234", "lyca", "1908", now); // LYCA-SKU-FIX-1024
    expect(localStorage.getItem("cp_rp_disc_v1")).not.toContain("2135551234"); // LYCA-SKU-FIX-1024
    expect(Object.keys(JSON.parse(localStorage.getItem("cp_rp_disc_v1") || "{}"))[0]).toMatch(/^[a-f0-9]{64}\|lyca\|1908$/); // LYCA-SKU-FIX-1024
    expect(localStorage.getItem("cp_rp_block_v1")).toBeNull(); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it("storage read errors fail open", async () => { // LYCA-SKU-FIX-1024
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); }); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "lyca", "1908", now)).toBe(false); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it("storage write errors fail open", async () => { // LYCA-SKU-FIX-1024
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); }); // LYCA-SKU-FIX-1024
    await expect(recordDiscBlock("2135551234", "lyca", "1908", now)).resolves.toBeUndefined(); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "lyca", "1908", now)).toBe(false); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it("never records or blocks Ultra", async () => { // LYCA-SKU-FIX-1024
    await recordDiscBlock("2135551234", "ultra-mobile", "8279", now); // LYCA-SKU-FIX-1024
    expect(await checkDiscBlock("2135551234", "ultra-mobile", "8279", now)).toBe(false); // LYCA-SKU-FIX-1024
    expect(localStorage.getItem("cp_rp_disc_v1")).toBeNull(); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it("the pre-pay check times out to false", async () => { // LYCA-SKU-FIX-1024
    vi.useFakeTimers(); // LYCA-SKU-FIX-1024
    try { const check = withTimeout(new Promise<boolean>(() => {}), 1000, false); await vi.advanceTimersByTimeAsync(1000); expect(await check).toBe(false); } finally { vi.useRealTimers(); } // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
}); // LYCA-SKU-FIX-1024
describe("approved dead amounts", () => { // LYCA-SKU-FIX-1024
  const list = [{ carrier_slug: "lyca", plan_id: "1907", amount: 33 }, { carrier_slug: "lyca", plan_id: "1908", amount: 45 }, { carrier_slug: "lyca", plan_id: "8947001", amount: 11 }]; // LYCA-SKU-FIX-1024
  it.each(list)("matches $plan_id/$amount", (p) => expect(isDeadAmount(list, "lyca", p.plan_id, p.amount)).toBe(true)); // LYCA-SKU-FIX-1024
  it("never matches Ultra even when present", () => expect(isDeadAmount([{ carrier_slug: "ultra-mobile", plan_id: "8279", amount: 24 }], "ultra-mobile", "8279", 24)).toBe(false)); // LYCA-SKU-FIX-1024
}); // LYCA-SKU-FIX-1024
describe("proxy dead-plan lookup", () => { // LYCA-SKU-FIX-1024
  function lookup(result: unknown) { // LYCA-SKU-FIX-1024
    const src = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // LYCA-SKU-FIX-1024
    const block = src.slice(src.indexOf("const PG_DEAD_AMOUNTS ="), src.indexOf("const PG_RANGE_OVERRIDES:")); // LYCA-SKU-FIX-1024
    const client = vi.fn(() => ({ from: () => ({ select: () => ({ is: () => ({ abortSignal: () => Promise.resolve(result) }) }) }) })); // LYCA-SKU-FIX-1024
    const fn = new Function("createClient", "Deno", "raceNull", "PG_TTL_MS", transpileModule(block, {}).outputText + "; return pgDeadMatch;")(client, { env: { get: () => "test-only" } }, (p: Promise<unknown>) => p, 600000); // LYCA-SKU-FIX-1024
    return { fn, client }; // LYCA-SKU-FIX-1024
  } // LYCA-SKU-FIX-1024
  it("matches only carrier/plan and caches the successful list", async () => { // LYCA-SKU-FIX-1024
    const { fn, client } = lookup({ data: [{ carrier_slug: "lyca", plan_id: "1908" }], error: null }); // LYCA-SKU-FIX-1024
    expect(await fn("lyca", "1908")).toBe(true); expect(await fn("tmobile", "1908")).toBe(false); expect(client).toHaveBeenCalledTimes(1); // LYCA-SKU-FIX-1024
  }); // LYCA-SKU-FIX-1024
  it.each([null, { data: null, error: new Error("down") }])("fails open on timeout/error", async (result) => expect(await lookup(result).fn("lyca", "1908")).toBe(false)); // LYCA-SKU-FIX-1024
  it("Ultra skips the lookup", async () => { const { fn, client } = lookup({ data: [{ carrier_slug: "ultra-mobile", plan_id: "8279" }], error: null }); expect(await fn("ultra-mobile", "8279")).toBe(false); expect(client).not.toHaveBeenCalled(); }); // LYCA-SKU-FIX-1024
}); // LYCA-SKU-FIX-1024