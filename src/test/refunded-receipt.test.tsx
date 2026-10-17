// REFUNDED-STATE-1017: receipt page with refunded:true fires no purchase and shows order-refunded; with null it behaves as today.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { createElement } from "react";

const rpcState: { refund: unknown } = { refund: null };
const rpcCalls: string[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (name: string) => { rpcCalls.push(name); return Promise.resolve({ data: name === "order_refund_state" ? rpcState.refund : null, error: null }); } },
}));
vi.mock("@/services/apiWrapper", () => ({
  callProxy: async () => ({ success: true, data: { data: { status: true, hashid: "HASH1234", id: 1, amount: 50, fee: 0, created: new Date().toISOString(), carrier: { name: "T-Mobile", slug: "tmobile" }, phone_number: "7164369201" } } }),
}));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/PaymentBar", () => ({ PaymentBar: () => null }));
vi.mock("@/components/LegalBar", () => ({ LegalBar: () => null }));
vi.mock("@/components/NotWorkingYet", () => ({ NotWorkingYet: () => createElement("div", { "data-testid": "nwy" }) }));
vi.mock("@/components/AutoPayReceiptCard", () => ({ AutoPayReceiptCard: () => createElement("div", { "data-testid": "apc" }), AP_LAST_KEY: "x" }));
vi.mock("@/components/ReminderOptIn", () => ({ ReminderOptIn: () => createElement("div", { "data-testid": "rem" }) }));
vi.mock("@/components/PayAgainCard", () => ({ PayAgainCard: () => null }));

import OrderConfirmation from "@/pages/OrderConfirmation";

const purchases = () => ((window as unknown as { dataLayer?: Array<{ event?: string }> }).dataLayer || []).filter((e) => e.event === "purchase");
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const waitFor = async (fn: () => void) => { for (let i = 0; i < 60; i++) { try { fn(); return; } catch { await act(async () => { await new Promise((r) => setTimeout(r, 50)); }); } } fn(); };
const show = async () => { document.body.innerHTML = '<div id="r"></div>'; const root = createRoot(document.getElementById("r")!); await act(async () => { root.render(createElement(MemoryRouter, { initialEntries: ["/order-confirmation?hashid=HASH1234&carrier=T-Mobile"] }, createElement(OrderConfirmation))); }); };

describe("REFUNDED-STATE-1017 OrderConfirmation", () => {
  beforeEach(() => { (window as unknown as { dataLayer: unknown[] }).dataLayer = []; localStorage.clear(); rpcCalls.length = 0; });
  it("refunded:true renders order-refunded and fires no purchase", async () => {
    rpcState.refund = { refunded: true, total: 52.5, carrier_slug: "tmobile" };
    await show();
    await waitFor(() => expect(q("order-refunded")).toBeTruthy());
    expect(document.body.textContent).toContain("Refill not completed");
    expect(q("order-refunded")!.textContent).toContain("$52.50");
    expect(purchases().length).toBe(0);
    expect(rpcCalls).not.toContain("log_purchase_fire");
    for (const id of ["nwy", "apc", "rem"]) expect(q(id)).toBeNull();
  });
  it("null behaves as today: receipt and purchase", async () => {
    rpcState.refund = null;
    await show();
    await waitFor(() => expect(q("nwy")).toBeTruthy());
    expect(q("order-refunded")).toBeNull();
    await waitFor(() => expect(purchases().length).toBe(1));
  });
});
