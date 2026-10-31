import { afterEach, describe, expect, it, vi } from "vitest"; // TMO-AMOUNT-FORCE-1031
import { act, renderHook, waitFor } from "@testing-library/react"; // TMO-AMOUNT-FORCE-1031
import { useTmoLastPlan } from "@/hooks/useTmoLastPlan"; // TMO-AMOUNT-FORCE-1031
import { useRef, useState } from "react"; // TMO-AMOUNT-FORCE-1031
const plans = [{ plan_id: "T50", amount: 50 }]; // TMO-AMOUNT-FORCE-1031
afterEach(() => vi.unstubAllGlobals()); // TMO-AMOUNT-FORCE-1031
function setup(initialAmount: string, throws = false, legacy = false) { // TMO-AMOUNT-FORCE-1031
  let resolveReply: (response: Response) => void = () => {}; // TMO-AMOUNT-FORCE-1031
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveReply = resolve; }))); // TMO-AMOUNT-FORCE-1031
  const hook = renderHook(() => { // TMO-AMOUNT-FORCE-1031
    const [amount, setAmount] = useState(initialAmount); // TMO-AMOUNT-FORCE-1031
    const chosen = useRef(initialAmount !== ""); // TMO-AMOUNT-FORCE-1031
    const smart = useTmoLastPlan("tmobile", "2135551234", true, plans, (p) => setAmount(String(p.amount)), legacy ? undefined : () => { if (throws) throw new Error("guard failed"); return !chosen.current; }); // TMO-AMOUNT-FORCE-1031
    return { amount, smart, choose: (value: string) => { chosen.current = true; setAmount(value); } }; // TMO-AMOUNT-FORCE-1031
  }); // TMO-AMOUNT-FORCE-1031
  return { ...hook, resolve: () => act(() => resolveReply(new Response(JSON.stringify({ plan_id: "T50", amount: 50 }), { status: 200 }))) }; // TMO-AMOUNT-FORCE-1031
} // TMO-AMOUNT-FORCE-1031
describe("T-Mobile customer amount preservation", () => { // TMO-AMOUNT-FORCE-1031
  it("preserves $10 chosen while lookup is pending and still confirms mismatch", async () => { // TMO-AMOUNT-FORCE-1031
    const h = setup(""); // TMO-AMOUNT-FORCE-1031
    act(() => h.result.current.choose("10")); h.resolve(); // TMO-AMOUNT-FORCE-1031
    await waitFor(() => expect(h.result.current.smart.match?.amount).toBe(50)); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.amount).toBe("10"); // TMO-AMOUNT-FORCE-1031
    act(() => expect(h.result.current.smart.gate(10)).toBe(false)); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.smart.pending).toBe(10); // TMO-AMOUNT-FORCE-1031
    act(() => h.result.current.smart.useLast()); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.amount).toBe("50"); // TMO-AMOUNT-FORCE-1031
  }); // TMO-AMOUNT-FORCE-1031
  it("preselects untouched amounts and preserves a later $10 choice", async () => { // TMO-AMOUNT-FORCE-1031
    const h = setup(""); h.resolve(); // TMO-AMOUNT-FORCE-1031
    await waitFor(() => expect(h.result.current.amount).toBe("50")); // TMO-AMOUNT-FORCE-1031
    act(() => h.result.current.choose("10")); h.rerender(); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.amount).toBe("10"); // TMO-AMOUNT-FORCE-1031
    act(() => expect(h.result.current.smart.gate(10)).toBe(false)); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.smart.pending).toBe(10); // TMO-AMOUNT-FORCE-1031
  }); // TMO-AMOUNT-FORCE-1031
  it("preserves prefilled $10", async () => { // TMO-AMOUNT-FORCE-1031
    const h = setup("10"); h.resolve(); // TMO-AMOUNT-FORCE-1031
    await waitFor(() => expect(h.result.current.smart.match?.amount).toBe(50)); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.amount).toBe("10"); // TMO-AMOUNT-FORCE-1031
  }); // TMO-AMOUNT-FORCE-1031
  it("skips preselection when its guard throws", async () => { // TMO-AMOUNT-FORCE-1031
    const h = setup("10", true); h.resolve(); // TMO-AMOUNT-FORCE-1031
    await waitFor(() => expect(h.result.current.smart.match?.amount).toBe(50)); // TMO-AMOUNT-FORCE-1031
    expect(h.result.current.amount).toBe("10"); // TMO-AMOUNT-FORCE-1031
  }); // TMO-AMOUNT-FORCE-1031
  it("keeps the optional-parameter legacy preselection", async () => { // TMO-AMOUNT-FORCE-1031
    const h = setup("", false, true); h.resolve(); // TMO-AMOUNT-FORCE-1031
    await waitFor(() => expect(h.result.current.amount).toBe("50")); // TMO-AMOUNT-FORCE-1031
  }); // TMO-AMOUNT-FORCE-1031
}); // TMO-AMOUNT-FORCE-1031