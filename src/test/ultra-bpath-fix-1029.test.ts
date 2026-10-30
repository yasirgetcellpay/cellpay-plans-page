import { afterEach, describe, expect, it, vi } from "vitest"; // ULTRA-BPATH-FIX-1029
import { ultraChargeVerified, ultraLookup, ultraSelection } from "@/lib/ultraBPath"; // ULTRA-BPATH-FIX-1029
import { pickUltraOverride } from "@/pages/DynamicCarrier"; // ULTRA-BPATH-FIX-1029
import { applyUltraMdn, setUltraMdnActive, type UltraMdnPlan, type UltraMdnResult } from "@/services/apiWrapper"; // ULTRA-BPATH-FIX-1029
const fixed: UltraMdnPlan = { kind: "fixed", planId: "78909", carrierId: 25, barcode: "0843788067083", amount: 26, name: "Ultra plan" }; // ULTRA-BPATH-FIX-1029
afterEach(() => { vi.useRealTimers(); setUltraMdnActive(null); }); // ULTRA-BPATH-FIX-1029
describe("Ultra B-path safeguard", () => { // ULTRA-BPATH-FIX-1029
  it("waits beyond two seconds and blocks a timed-out lookup at eight seconds without catalog submission", async () => { // ULTRA-BPATH-FIX-1029
    vi.useFakeTimers(); const submit = vi.fn(); let result: UltraMdnResult | undefined; // ULTRA-BPATH-FIX-1029
    const pending = ultraLookup(new Promise<UltraMdnResult>(() => {})).then((r) => { result = r; if (r.ok) submit(); }); // ULTRA-BPATH-FIX-1029
    await vi.advanceTimersByTimeAsync(3000); expect(result).toBeUndefined(); // ULTRA-BPATH-FIX-1029
    await vi.advanceTimersByTimeAsync(5000); await pending; expect(result).toEqual({ ok: false, status: 408 }); expect(submit).not.toHaveBeenCalled(); // ULTRA-BPATH-FIX-1029
    expect(ultraChargeVerified(null, { carrier_slug: "ultra-mobile", amount: 29, plan_id: "8279", phone_number: "3055551234" })).toBe(false); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("accepts a successful three-second lookup", async () => { // ULTRA-BPATH-FIX-1029
    vi.useFakeTimers(); const pending = ultraLookup(new Promise<UltraMdnResult>((r) => setTimeout(() => r({ ok: true, subscriber: null, fixed: [fixed], range: [] }), 3000))); // ULTRA-BPATH-FIX-1029
    await vi.advanceTimersByTimeAsync(3000); expect((await pending).ok).toBe(true); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("returns a selection prompt without changing the chosen 29 or attaching a barcode", () => { // ULTRA-BPATH-FIX-1029
    const decision = pickUltraOverride(29, [fixed], [], "plan"); expect(decision).toEqual({ kind: "pick" }); expect(decision).not.toHaveProperty("amount"); expect(decision).not.toHaveProperty("plan"); // ULTRA-BPATH-FIX-1029
    expect(ultraSelection(fixed, "3055551234", 29)).toBeNull(); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("explicit selection sets the verified barcode and amount 26 through the existing attachment", () => { // ULTRA-BPATH-FIX-1029
    const selected = ultraSelection(fixed, "3055551234", 26); expect(selected).toMatchObject({ amount: 26, ultraMdn: { barcode: "0843788067083", planId: "78909", carrierId: 25 } }); // ULTRA-BPATH-FIX-1029
    if (!selected) throw new Error("Expected selection"); setUltraMdnActive(selected.ultraMdn); // ULTRA-BPATH-FIX-1029
    const payload = { carrier_slug: "ultra-mobile", amount: selected.amount, phone_number: "3055551234", plan_id: "78909" }; expect(ultraChargeVerified(selected.ultraMdn, payload)).toBe(true); expect(applyUltraMdn(payload)).toMatchObject({ amount: 26, barcode: "0843788067083" }); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
  it("refuses a mismatched range amount and preserves non-Ultra behavior", () => { // ULTRA-BPATH-FIX-1029
    const range = { ...fixed, kind: "range" as const, amount: undefined, rangeMin: 10.01, rangeMax: 100 }; expect(ultraSelection(range, "3055551234", 10)).toBeNull(); expect(ultraSelection(range, "3055551234", 10.01)?.amount).toBe(10.01); // ULTRA-BPATH-FIX-1029
    expect(ultraChargeVerified(null, { carrier_slug: "tmobile", carrierId: 26, amount: 29 })).toBe(true); // ULTRA-BPATH-FIX-1029
  }); // ULTRA-BPATH-FIX-1029
}); // ULTRA-BPATH-FIX-1029