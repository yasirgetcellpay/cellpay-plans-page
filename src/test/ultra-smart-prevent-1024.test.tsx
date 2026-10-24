import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest"; // ULTRA-SMART-PREVENT-1024
import { renderHook, act, waitFor } from "@testing-library/react"; // ULTRA-SMART-PREVENT-1024
import { readFileSync } from "node:fs"; // ULTRA-SMART-PREVENT-1024
import { PGlite } from "@electric-sql/pglite"; // ULTRA-SMART-PREVENT-1024
import { ultraRead, readUltraLastPlan, currentUltraPlan, ultra1065 } from "@/lib/ultraSmart"; // ULTRA-SMART-PREVENT-1024
import { useUltraSmart } from "@/hooks/useUltraSmart"; // ULTRA-SMART-PREVENT-1024
const last = { amount: 29, plan_id: "8279", date: "2026-10-24T20:00:00Z" }; // ULTRA-SMART-PREVENT-1024
const plans = [{ amount: 29, plan_id: "8279" }, { amount: 39, plan_id: "8278" }]; // ULTRA-SMART-PREVENT-1024
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); }); // ULTRA-SMART-PREVENT-1024
describe("Ultra bounded reads", () => { // ULTRA-SMART-PREVENT-1024
  it("errors and unsuccessful reads fail open, not no-history", async () => { expect(await ultraRead("ultra-health", "", vi.fn().mockRejectedValue(new Error("down")))).toBeNull(); expect(await readUltraLastPlan("2135551234", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })))).toBeNull(); }); // ULTRA-SMART-PREVENT-1024
  it("hangs fail open at exactly two seconds", async () => { vi.useFakeTimers(); const promise = ultraRead("ultra-health", "", vi.fn(() => new Promise(() => {}))); await vi.advanceTimersByTimeAsync(1999); let done = false; void promise.then(() => { done = true; }); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(1); expect(await promise).toBeNull(); }); // ULTRA-SMART-PREVENT-1024
  it("accepts empty history only after a successful empty response", async () => { expect(await readUltraLastPlan("2135551234", vi.fn().mockResolvedValue(new Response("{}")))).toEqual({}); }); // ULTRA-SMART-PREVENT-1024
  it("preselects only a matching live plan and amount", () => { expect(currentUltraPlan(last, plans)?.plan_id).toBe("8279"); expect(currentUltraPlan({ ...last, plan_id: "missing" }, plans)).toBeNull(); expect(currentUltraPlan({ ...last, amount: 24 }, plans)).toBeNull(); }); // ULTRA-SMART-PREVENT-1024
  it("1065 recovery is Ultra only", () => { expect(ultra1065("ultra-mobile", "TXN Error: 1065 Invalid transaction state | Invalid Amount")).toBe(true); expect(ultra1065("tmobile", "1065")).toBe(false); expect(ultra1065("ultra-mobile", "Subscriber not found")).toBe(false); }); // ULTRA-SMART-PREVENT-1024
}); // ULTRA-SMART-PREVENT-1024
describe("Ultra confirmations", () => { // ULTRA-SMART-PREVENT-1024
  it("a mismatch is soft and the override allows a normal later Pay", async () => { // ULTRA-SMART-PREVENT-1024
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("ultra-last-plan") ? last : { tier: "off" })))); // ULTRA-SMART-PREVENT-1024
    const select = vi.fn(); const { result } = renderHook(() => useUltraSmart("ultra-mobile", "2135551234", true, plans, select)); // ULTRA-SMART-PREVENT-1024
    await waitFor(() => expect(result.current.last?.amount).toBe(29)); expect(select).toHaveBeenCalledWith(plans[0]); // ULTRA-SMART-PREVENT-1024
    act(() => { expect(result.current.gate(39)).toBe(false); }); act(() => result.current.override()); expect(result.current.gate(39)).toBe(true); expect(result.current.gate(29)).toBe(true); // ULTRA-SMART-PREVENT-1024
  }); // ULTRA-SMART-PREVENT-1024
  it("empty history requires acknowledgment; failed history does not", async () => { // ULTRA-SMART-PREVENT-1024
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("ultra-last-plan") ? {} : { tier: "off" })))); // ULTRA-SMART-PREVENT-1024
    const { result } = renderHook(() => useUltraSmart("ultra-mobile", "2135551234", true, plans)); await waitFor(() => expect(result.current.noHistory).toBe(true)); expect(result.current.gate(29)).toBe(false); act(() => result.current.acknowledge(true)); expect(result.current.gate(29)).toBe(true); // ULTRA-SMART-PREVENT-1024
  }); // ULTRA-SMART-PREVENT-1024
  it("other carriers make no new calls", () => { const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const { result } = renderHook(() => useUltraSmart("lyca", "2135551234", true, plans)); expect(result.current.gate(39)).toBe(true); expect(fetcher).not.toHaveBeenCalled(); }); // ULTRA-SMART-PREVENT-1024
}); // ULTRA-SMART-PREVENT-1024
describe("atomic Ultra breaker", () => { // ULTRA-SMART-PREVENT-1024
  let db: PGlite; // ULTRA-SMART-PREVENT-1024
  beforeAll(async () => { // ULTRA-SMART-PREVENT-1024
    db = new PGlite(); await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE transaction_logs(carrier_slug text,created_at timestamptz,status text,load_text text,error_message text,raw_response jsonb); CREATE TABLE proxy_guard_events(id uuid,guard_version text,code text,method text,endpoint_shape text);"); // ULTRA-SMART-PREVENT-1024
    await db.exec(readFileSync("drizzle/migrations/0021_ultra_smart_prevent_1024.sql", "utf8")); // ULTRA-SMART-PREVENT-1024
  }, 30000); // ULTRA-SMART-PREVENT-1024
  afterAll(async () => { await db.close(); }); // ULTRA-SMART-PREVENT-1024
  async function seed(n: number, failures: number) { await db.exec("TRUNCATE transaction_logs,ultra_breaker_state,proxy_guard_events;"); for (let i = 0; i < n; i++) await db.query("INSERT INTO transaction_logs VALUES('ultra-mobile',now(),$1,$2,'','{}')", [i < failures ? "failed" : "success", i < failures ? "1065" : ""]); } // ULTRA-SMART-PREVENT-1024
  async function check(mode = "pause", claim = false) { const r = await db.query<{ health: Record<string, unknown> }>("SELECT ultra_breaker_check($1,$2) as health", [mode, claim]); return r.rows[0].health; } // ULTRA-SMART-PREVENT-1024
  it("warns at 40% with five attempts", async () => { await seed(5, 2); expect((await check()).tier).toBe("warn"); }); // ULTRA-SMART-PREVENT-1024
  it("does not pause with only five attempts", async () => { await seed(5, 5); expect((await check()).tier).toBe("warn"); }); // ULTRA-SMART-PREVENT-1024
  it("pauses at 70% with at least six attempts, for 20 minutes", async () => { await seed(10, 7); const h = await check(); expect(h.tier).toBe("pause"); expect(h.allowed).toBe(false); expect(h.retry_after).toBe(1200); }); // ULTRA-SMART-PREVENT-1024
  it("warn mode never pauses and off mode allows", async () => { await seed(6, 6); expect((await check("warn")).tier).toBe("warn"); expect((await check("off", true)).allowed).toBe(true); }); // ULTRA-SMART-PREVENT-1024
  it("counts last ten when they are larger than the 60 minute window", async () => { await seed(10, 7); await db.exec("UPDATE transaction_logs SET created_at=now()-interval '2 hours';"); expect((await check()).attempts).toBe(10); expect((await check()).tier).toBe("pause"); }); // ULTRA-SMART-PREVENT-1024
  it("excludes subscriber-not-found, duplicate and blocked", async () => { await seed(2, 0); for (const text of ["Subscriber not found", "duplicate", "Blocked: risk"]) await db.query("INSERT INTO transaction_logs VALUES('ultra-mobile',now(),'failed',$1,$1,'{}')", [text]); expect((await check()).attempts).toBe(2); }); // ULTRA-SMART-PREVENT-1024
  it("allows one atomic probe after 20 minutes and restores after probe success", async () => { await seed(6, 6); await check(); await db.exec("UPDATE ultra_breaker_state SET pause_until=now()-interval '1 second';"); expect((await check()).probe_available).toBe(true); expect((await check("pause", true)).allowed).toBe(true); expect((await check("pause", true)).allowed).toBe(false); await db.exec("INSERT INTO transaction_logs VALUES('ultra-mobile',clock_timestamp(),'success','','','{}');"); expect((await check()).tier).toBe("off"); }); // ULTRA-SMART-PREVENT-1024
}); // ULTRA-SMART-PREVENT-1024