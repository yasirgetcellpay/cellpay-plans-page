import { describe, it, expect, vi, afterEach } from "vitest"; // ULTRA-SMART-PREVENT-1024
import { renderHook, act, waitFor } from "@testing-library/react"; // ULTRA-SMART-PREVENT-1024
import { ultraRead, readUltraLastPlan, currentUltraPlan, ultra1065 } from "@/lib/ultraSmart"; // ULTRA-SMART-PREVENT-1024
import { useUltraSmart } from "@/hooks/useUltraSmart"; // ULTRA-SMART-PREVENT-1024
const last = { amount: 29, plan_id: "8279", date: "2026-10-24T20:00:00Z" }; // ULTRA-SMART-PREVENT-1024
const plans = [{ amount: 29, plan_id: "8279" }, { amount: 39, plan_id: "8278" }]; // ULTRA-SMART-PREVENT-1024
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); }); // ULTRA-SMART-PREVENT-1024
describe("Ultra bounded reads", () => { // ULTRA-SMART-PREVENT-1024
  it("errors and unsuccessful reads fail open, not no-history", async () => { expect(await ultraRead("ultra-health", "", vi.fn().mockRejectedValue(new Error("down")))).toBeNull(); expect(await readUltraLastPlan("2135551234", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })))).toBeNull(); }); // ULTRA-SMART-PREVENT-1024
  it("hangs fail open at exactly two seconds", async () => { vi.useFakeTimers(); const promise = ultraRead("ultra-health", "", vi.fn(() => new Promise<Response>(() => {}))); await vi.advanceTimersByTimeAsync(1999); let done = false; void promise.then(() => { done = true; }); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(1); expect(await promise).toBeNull(); }); // ULTRA-SMART-PREVENT-1024
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
