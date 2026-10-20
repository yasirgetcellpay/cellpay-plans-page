// KLARNA-OPEN-1019
import { describe, expect, it } from "vitest";
import { firstMissingKlarnaField, type KlarnaField } from "@/lib/klarnaMissing";

const valid = { firstName: " Jane ", lastName: " Doe ", phone: "(202) 555-0100", address: " 1 Main St ", city: " Austin ", state: " TX ", country: " US ", zip: "12345" };
describe("KLARNA-OPEN-1019 validation", () => {
  it("returns first_name when all fields are empty", () => {
    expect(firstMissingKlarnaField({ firstName: "", lastName: "", phone: "", address: "", city: "", state: "", country: "", zip: "" })).toBe("first_name");
  });
  it("rejects four-character ZIP", () => { expect(firstMissingKlarnaField({ ...valid, zip: "1234" })).toBe("zip"); });
  it("rejects a short phone", () => { expect(firstMissingKlarnaField({ ...valid, phone: "555-12" })).toBe("phone"); });
  it("accepts all valid fields", () => { expect(firstMissingKlarnaField(valid)).toBeNull(); });
  it.each<[keyof typeof valid, KlarnaField]>([["firstName", "first_name"], ["lastName", "last_name"], ["phone", "phone"], ["address", "address"], ["city", "city"], ["state", "state"], ["country", "country"], ["zip", "zip"]])("checks %s before later fields", (key, field) => {
    const keys = Object.keys(valid) as (keyof typeof valid)[];
    const values = { ...valid };
    for (const later of keys.slice(keys.indexOf(key))) values[later] = " ";
    expect(firstMissingKlarnaField(values)).toBe(field);
  });
  it("preserves the existing raw ZIP length rule", () => { expect(firstMissingKlarnaField({ ...valid, zip: "     " })).toBeNull(); });
  it("accepts phones with more than ten digits", () => { expect(firstMissingKlarnaField({ ...valid, phone: "+1 (202) 555-0100" })).toBeNull(); });
});