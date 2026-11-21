// TMO-FORMAT-1121
import { describe, it, expect } from "vitest";
import { tmoExchangeBad, tmoCheckNumberText } from "@/lib/tmoPhoneFormat";

describe("TMO-FORMAT-1121 tmoExchangeBad", () => {
  for (const slug of ["tmobile", "tmobile-flexi"]) {
    it(`${slug}: valid exchange passes`, () => { expect(tmoExchangeBad(slug, "2135551234")).toBe(false); expect(tmoExchangeBad(slug, "2135051011")).toBe(false); });
    it(`${slug}: exchange 0/1 blocked`, () => { expect(tmoExchangeBad(slug, "2130551234")).toBe(true); expect(tmoExchangeBad(slug, "2131551234")).toBe(true); });
  }
  it("other carriers never blocked", () => { for (const s of ["metropcs", "straight-talk", "boost"]) expect(tmoExchangeBad(s, "2130551234")).toBe(false); });
  it("null/undefined/empty fail open", () => { expect(tmoExchangeBad(null, null)).toBe(false); expect(tmoExchangeBad(undefined, undefined)).toBe(false); expect(tmoExchangeBad("tmobile", "")).toBe(false); expect(tmoExchangeBad("", "2130551234")).toBe(false); });
  it("EN/ES text", () => { expect(tmoCheckNumberText("en")).toBe("Please check your phone number."); expect(tmoCheckNumberText("es")).toBe("Por favor, verifique su número de teléfono."); });
});
