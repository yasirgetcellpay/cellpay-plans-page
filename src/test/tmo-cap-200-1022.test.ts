import { describe, it, expect } from "vitest";
import { tmoCapBlocked, tmoCapMax, tmoCapMsg } from "@/lib/tmoCap";
describe("TMO-CAP-200-1022", () => {
  it("blocks T-Mobile 201", () => { expect(tmoCapBlocked("tmobile", 201)).toBe(true); expect(tmoCapBlocked("tmobile-flexi", 201)).toBe(true); expect(tmoCapBlocked("", 201, "238888")).toBe(true); });
  it("allows T-Mobile 200 and 25", () => { expect(tmoCapBlocked("tmobile", 200)).toBe(false); expect(tmoCapBlocked("tmobile", 25)).toBe(false); });
  it("leaves Cricket 250 alone", () => { expect(tmoCapBlocked("cricket", 250)).toBe(false); expect(tmoCapMax("cricket", 300)).toBe(300); });
  it("caps T-Mobile max at 200", () => { expect(tmoCapMax("tmobile", 500)).toBe(200); });
  it("uses exact messages", () => { expect(tmoCapMsg("en")).toBe("T-Mobile refills are limited to $200 right now. Please enter $200 or less."); expect(tmoCapMsg("es")).toBe("Las recargas de T-Mobile tienen un límite de $200 por ahora. Ingrese $200 o menos."); });
});
