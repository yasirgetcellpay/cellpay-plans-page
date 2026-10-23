// METRO-FIRSTSCREEN-1023b
import { cleanup, render, screen } from "@testing-library/react"; // METRO-FIRSTSCREEN-1023b
import { afterEach, describe, expect, it, vi } from "vitest"; // METRO-FIRSTSCREEN-1023b
import { MemoryRouter } from "react-router-dom"; // METRO-FIRSTSCREEN-1023b
import GoLander from "@/pages/GoLander"; // METRO-FIRSTSCREEN-1023b
vi.mock("@/services/apiWrapper", () => ({ fetchCarrierView: vi.fn(async () => ({ carrier: { name: "Metro PCS", carrierId: 38 } })), verifyPhone: vi.fn() })); // METRO-FIRSTSCREEN-1023b
vi.mock("@/lib/checkoutResume", () => ({ takeCheckoutPrefill: () => "" })); // METRO-FIRSTSCREEN-1023b
afterEach(cleanup); // METRO-FIRSTSCREEN-1023b
describe("Metro first-screen Auto Pay safety", () => { // METRO-FIRSTSCREEN-1023b
  it.each(["en", "es"] as const)("keeps Auto Pay unchecked by default in %s", (lang) => { // METRO-FIRSTSCREEN-1023b
    render(<MemoryRouter><GoLander carrierName="Metro PCS" carrierSlug="metropcs" carrierId={38} brandColor="var(--primary)" h1="Metro PCS" title="Metro PCS" description="Metro PCS" lang={lang} metroFirstScreen /></MemoryRouter>); // METRO-FIRSTSCREEN-1023b
    expect(screen.getByRole("checkbox")).not.toBeChecked(); // METRO-FIRSTSCREEN-1023b
  }); // METRO-FIRSTSCREEN-1023b
}); // METRO-FIRSTSCREEN-1023b