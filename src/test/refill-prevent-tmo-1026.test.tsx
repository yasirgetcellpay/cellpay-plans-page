// REFILL-PREVENT-TMO-1026
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { readTmoLastPlan, matchTmoPlan, tmoNeedsConfirm } from "@/lib/tmoLastPlan";
import { useTmoLastPlan } from "@/hooks/useTmoLastPlan";

const plans = [{ plan_id: "T50", amount: 50 }, { plan_id: "T40", amount: 40 }];
const ok = (body: unknown) => (() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))) as unknown as typeof fetch;

beforeEach(() => { (window as unknown as { dataLayer?: unknown[] }).dataLayer = []; });

describe("tmo-last-plan read", () => {
  it("fails open (null) on timeout", async () => {
    const hang = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    expect(await readTmoLastPlan("2135551234", hang, 20)).toBeNull();
  });
  it("fails open on error", async () => expect(await readTmoLastPlan("2135551234", (() => Promise.reject(new Error("x"))) as unknown as typeof fetch)).toBeNull());
  it("parses a hit and no-history", async () => {
    expect(await readTmoLastPlan("2135551234", ok({ plan_id: "T50", amount: 50 }))).toEqual({ plan_id: "T50", amount: 50 });
    expect(await readTmoLastPlan("2135551234", ok({}))).toEqual({});
  });
});

describe("preselect only when plan_id is in the list", () => {
  it("matches a listed plan", () => expect(matchTmoPlan({ plan_id: "T50", amount: 50 }, plans)).toEqual({ plan_id: "T50", amount: 50 }));
  it("no match when plan_id is not listed", () => expect(matchTmoPlan({ plan_id: "OLD", amount: 50 }, plans)).toBeNull());
});

describe("soft confirm", () => {
  const last = { plan_id: "T50", amount: 50 };
  it("shows once, then Continue allows pay", async () => {
    const { result } = renderHook(() => useTmoLastPlan("tmobile", "2135551234", false, plans));
    expect(tmoNeedsConfirm("tmobile", last, 40, "2135551234", null)).toBe(true);
    expect(tmoNeedsConfirm("tmobile", last, 40, "2135551234", "2135551234")).toBe(false);
    expect(tmoNeedsConfirm("tmobile", last, 50, "2135551234", null)).toBe(false);
    expect(result.current.gate(40)).toBe(true); // no lookup -> fail open
  });
  it("hook: confirm then Continue passes", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = ok({ plan_id: "T50", amount: 50 });
    const picked: number[] = [];
    const { result } = renderHook(() => useTmoLastPlan("tmobile", "2135551234", true, plans, (p) => picked.push(p.amount)));
    await waitFor(() => expect(result.current.match).not.toBeNull());
    expect(picked).toEqual([50]);
    let r = true; act(() => { r = result.current.gate(40); }); expect(r).toBe(false);
    expect(result.current.pending).toBe(40);
    act(() => result.current.proceed());
    act(() => { r = result.current.gate(40); }); expect(r).toBe(true);
    globalThis.fetch = orig;
  });
});

describe("non-T-Mobile unchanged", () => {
  it("never confirms other carriers", () => {
    expect(tmoNeedsConfirm("lyca", { plan_id: "T50", amount: 50 }, 40, "2135551234", null)).toBe(false);
    const { result } = renderHook(() => useTmoLastPlan("ultra-mobile", "2135551234", true, plans));
    expect(result.current.gate(40)).toBe(true);
    expect(result.current.match).toBeNull();
  });
});
