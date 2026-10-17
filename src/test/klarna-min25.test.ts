// KLARNA-MIN25-1017: Klarna hidden / refused under $25.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { KLARNA_MIN_TOTAL } from "@/lib/declineRecovery";

const page = readFileSync("src/pages/Checkout.tsx", "utf8");
const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8");

// Mirrors of the exact Checkout.tsx conditions (source checks below pin them).
const listHasKlarna = (total: number) =>
  ["card", "applepay", "klarna"].filter((k) => !(k === "klarna" && total < KLARNA_MIN_TOTAL)).includes("klarna");
const fallback = (pm: string, vt: unknown) =>
  pm === "klarna" && typeof vt === "number" && Number.isFinite(vt) && vt < KLARNA_MIN_TOTAL ? "card" : pm;

// Load the proxy helper from source (proxy is a Deno file).
const m = proxy.match(/const KLARNA_MIN_TOTAL = 25;[\s\S]*?export function klarnaMinRefusal[\s\S]*?\n}\n/);
const js = m![0].replace("export ", "").replace(/: unknown/g, "").replace(/\): Record<string, unknown> \| null/, ")");
const klarnaMinRefusal = new Function(`${js}; return klarnaMinRefusal;`)() as (t: unknown, l: unknown) => Record<string, unknown> | null;

describe("KLARNA-MIN25-1017", () => {
  it("list excludes klarna at 24.99, includes at 25.00 and 28.99", () => {
    expect(listHasKlarna(24.99)).toBe(false);
    expect(listHasKlarna(25)).toBe(true);
    expect(listHasKlarna(28.99)).toBe(true);
    expect(page).toContain('!(m.key === "klarna" && klarnaListTotal < KLARNA_MIN_TOTAL)');
    expect(page).toContain("const klarnaListTotal = validation?.total ?? Number(state.amount);");
  });
  it("fallback: klarna + validated 24.99 -> card; no validated total -> unchanged", () => {
    expect(fallback("klarna", 24.99)).toBe("card");
    expect(fallback("klarna", undefined)).toBe("klarna");
    expect(fallback("klarna", 25)).toBe("klarna");
    expect(fallback("card", 10)).toBe("card");
    expect(page).toContain('paymentMethod === "klarna" && typeof vt === "number" && Number.isFinite(vt) && vt < KLARNA_MIN_TOTAL) setPaymentMethod("card")');
  });
  it("proxy refusal EN/ES at 24.99, passes at 25.00", () => {
    const en = klarnaMinRefusal(24.99, "en")!;
    expect(en).toMatchObject({ success: false, blocked: true, code: "KLARNA_MIN_TOTAL" });
    expect(en.message).toBe("Klarna is available for orders of $25 or more. Please choose another way to pay. You were not charged.");
    expect(klarnaMinRefusal("24.99", "es")!.message).toBe("Klarna está disponible para pedidos de $25 o más. Por favor, elija otra forma de pago. No se le cobró.");
    expect(klarnaMinRefusal(25, "en")).toBeNull();
    expect(klarnaMinRefusal(undefined, "en")).toBeNull();
    expect(proxy).toContain('code: "klarna_min_total"');
    expect(proxy).toContain('code: "klarna_min_session"');
  });
});
