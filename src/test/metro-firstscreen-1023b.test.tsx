// METRO-FIRSTSCREEN-1023b
import { act } from "react"; // METRO-FIRSTSCREEN-1023b
import { createRoot, type Root } from "react-dom/client"; // METRO-FIRSTSCREEN-1023b
import { afterEach, describe, expect, it, vi } from "vitest"; // METRO-FIRSTSCREEN-1023b
import { MemoryRouter } from "react-router-dom"; // METRO-FIRSTSCREEN-1023b
import GoLander from "@/pages/GoLander"; // METRO-FIRSTSCREEN-1023b
vi.mock("@/services/apiWrapper", () => ({ fetchCarrierView: vi.fn(async () => ({ carrier: { name: "Metro PCS", carrierId: 38 } })), verifyPhone: vi.fn() })); // METRO-FIRSTSCREEN-1023b
vi.mock("@/lib/checkoutResume", () => ({ takeCheckoutPrefill: () => "" })); // METRO-FIRSTSCREEN-1023b
let root: Root | undefined; // METRO-FIRSTSCREEN-1023b
afterEach(() => { act(() => root?.unmount()); document.body.replaceChildren(); }); // METRO-FIRSTSCREEN-1023b
describe("Metro first-screen Auto Pay safety", () => { // METRO-FIRSTSCREEN-1023b
  it.each(["en", "es"] as const)("keeps Auto Pay unchecked by default in %s", async (lang) => { // METRO-FIRSTSCREEN-1023b
    const host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); // METRO-FIRSTSCREEN-1023b
    await act(async () => root?.render(<MemoryRouter><GoLander carrierName="Metro PCS" carrierSlug="metropcs" carrierId={38} brandColor="var(--primary)" h1="Metro PCS" title="Metro PCS" description="Metro PCS" lang={lang} metroFirstScreen /></MemoryRouter>)); // METRO-FIRSTSCREEN-1023b
    const checkbox = host.querySelector('input[type="checkbox"]'); // METRO-FIRSTSCREEN-1023b
    expect(checkbox).toBeInstanceOf(HTMLInputElement); // METRO-FIRSTSCREEN-1023b
    if (!(checkbox instanceof HTMLInputElement)) throw new Error("Missing Auto Pay option"); // METRO-FIRSTSCREEN-1023b
    expect(checkbox.checked).toBe(false); // METRO-FIRSTSCREEN-1023b
  }); // METRO-FIRSTSCREEN-1023b
}); // METRO-FIRSTSCREEN-1023b