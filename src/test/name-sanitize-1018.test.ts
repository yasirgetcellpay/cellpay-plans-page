import { describe, expect, it } from "vitest"; // NAME-SANITIZE-1018
import { readFileSync } from "node:fs"; // NAME-SANITIZE-1018
import { runInNewContext } from "node:vm"; // NAME-SANITIZE-1018
import ts from "typescript"; // NAME-SANITIZE-1018
const source = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // NAME-SANITIZE-1018
const extracted = source.slice(source.indexOf("const SKIP_RECURSE ="), source.indexOf("function cleanFreeText(")) + source.slice(source.indexOf("const WALLET_JSON_KEYS ="), source.indexOf("serve(async (req) =>", source.indexOf("const WALLET_JSON_KEYS ="))); // NAME-SANITIZE-1018
const js = ts.transpile(extracted + ";globalThis.helpers = { toAsciiName, foldNameFields, foldWalletNames, asciiNamesCopy, namesSentMeta, cleanAllStrings, sanitizeWalletJson, nameHasCardDigits };", { target: ts.ScriptTarget.ES2022 }); // NAME-SANITIZE-1018
const context = { helpers: {} as Record<string, (...args: any[]) => any>, cleanFreeText: (s: string) => s.replace(/[\u{10000}-\u{10FFFF}]/gu, "").trim() }; // NAME-SANITIZE-1018
runInNewContext(js, context); // NAME-SANITIZE-1018
const { toAsciiName, foldNameFields, foldWalletNames, asciiNamesCopy, namesSentMeta, sanitizeWalletJson, nameHasCardDigits } = context.helpers; // NAME-SANITIZE-1018
describe("NAME-SANITIZE-1018", () => { // NAME-SANITIZE-1018
  it.each([ // NAME-SANITIZE-1018
    ["محمد", ""], ["王小明", ""], ["😀😀", ""], ["José", "Jose"], // NAME-SANITIZE-1018
    ["Łukasz Wiśniewski", "Lukasz Wisniewski"], ["Müller-Lüdenscheid", "Muller-Ludenscheid"], // NAME-SANITIZE-1018
    ["  Ana   María  ", "Ana Maria"], ["", ""], ["John", "John"], // NAME-SANITIZE-1018
    ["José 😀 محمد", "Jose"], ["O’Brien", "O'Brien"], ["Jo\u0000hn\u200B", "John"], // NAME-SANITIZE-1018
    ["Jo\t\r\nhn", "Jo hn"], ["Jo\u007F\u0085hn", "John"], // NAME-SANITIZE-1018
  ])("folds %j to %j", (input, expected) => expect(toAsciiName(input)).toBe(expected)); // NAME-SANITIZE-1018
  it("caps Latin names at 50 characters", () => expect(toAsciiName("A".repeat(80))).toBe("A".repeat(50))); // NAME-SANITIZE-1018
  it("trims again after truncation", () => expect(toAsciiName("A".repeat(49) + " BBB")).toBe("A".repeat(49))); // NAME-SANITIZE-1018
  it.each([ // NAME-SANITIZE-1018
    [{ firstName: "محمد", lastName: "الحشيشي" }, { firstName: "Customer", lastName: "Customer" }], // NAME-SANITIZE-1018
    [{ first_name: "José 😀 محمد", last_name: "Smith" }, { first_name: "Jose", last_name: "Smith" }], // NAME-SANITIZE-1018
    [{ firstName: "", lastName: "Lee" }, { firstName: "Customer", lastName: "Lee" }], // NAME-SANITIZE-1018
  ])("folds individual name fields independently: %j", (input, expected) => expect(foldNameFields(input)).toEqual(expected)); // NAME-SANITIZE-1018
  it("folds Apple contacts only in an outbound copy", () => { // NAME-SANITIZE-1018
    const contact = { givenName: "محمد", familyName: "الحشيشي", addressLines: ["123 Main St"], locality: "Dearborn", postalCode: "48126" }; // NAME-SANITIZE-1018
    const payload = { payment: { firstName: "محمد", lastName: "Ali" }, apple_pay_billing_contact: JSON.stringify(contact), apple_pay_token: "tok" }; // NAME-SANITIZE-1018
    const before = JSON.stringify(payload); // NAME-SANITIZE-1018
    const out = asciiNamesCopy(payload); // NAME-SANITIZE-1018
    expect(out.payment).toEqual({ firstName: "Customer", lastName: "Ali" }); // NAME-SANITIZE-1018
    expect(JSON.parse(out.apple_pay_billing_contact)).toEqual({ ...contact, givenName: "Customer", familyName: "Customer" }); // NAME-SANITIZE-1018
    expect(out.apple_pay_token).toBe("tok"); // NAME-SANITIZE-1018
    expect(JSON.stringify(payload)).toBe(before); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it.each([["Dani 😎", "Dani"], ["李", "Customer"]])("folds Google billing name %j", (name, expected) => { // NAME-SANITIZE-1018
    const out = asciiNamesCopy({ gpay_billing_details: JSON.stringify({ billingAddress: { name, countryCode: "US" } }) }); // NAME-SANITIZE-1018
    expect(JSON.parse(out.gpay_billing_details)).toEqual({ billingAddress: { name: expected, countryCode: "US" } }); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it.each(["{bad", "null", "123", '[{"name":"李"}]'])("leaves invalid/non-object wallet JSON unchanged: %j", (value) => { // NAME-SANITIZE-1018
    expect(asciiNamesCopy({ gpay_billing_details: value }).gpay_billing_details).toBe(value); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it("folds plain wallet objects without changing non-name strings or mutating input", () => { // NAME-SANITIZE-1018
    const contact = { givenName: "José", phoneticGivenName: "محمد", addressLines: ["شارع 😀"], emailAddress: "José@example.com", phoneNumber: "+123", country: "日本", children: [{ familyName: "李" }] }; // NAME-SANITIZE-1018
    const payload = { apple_pay_billing_contact: contact }; // NAME-SANITIZE-1018
    const before = JSON.stringify(payload); // NAME-SANITIZE-1018
    expect(asciiNamesCopy(payload).apple_pay_billing_contact).toEqual({ ...contact, givenName: "Jose", phoneticGivenName: "", children: [{ familyName: "Customer" }] }); // NAME-SANITIZE-1018
    expect(JSON.stringify(payload)).toBe(before); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it("preserves all opaque token/paymentData subtrees including inside contacts", () => { // NAME-SANITIZE-1018
    const opaque = { firstName: "محمد", name: "李", token: "😀" }; // NAME-SANITIZE-1018
    const input = { apple_pay_token: "tok😀", google_pay_token: opaque, paymentData: opaque, risk: opaque, apple_pay_billing_contact: { givenName: "José", paymentData: opaque, signature: opaque } }; // NAME-SANITIZE-1018
    const out = asciiNamesCopy(input); // NAME-SANITIZE-1018
    expect(out.apple_pay_token).toBe(input.apple_pay_token); // NAME-SANITIZE-1018
    for (const k of ["google_pay_token", "paymentData", "risk"]) expect(out[k]).toBe(input[k as keyof typeof input]); // NAME-SANITIZE-1018
    expect(out.apple_pay_billing_contact.paymentData).toBe(opaque); // NAME-SANITIZE-1018
    expect(out.apple_pay_billing_contact.signature).toBe(opaque); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it("keeps depth guards and folds wallet arrays", () => { // NAME-SANITIZE-1018
    const input = { givenName: "محمد" }; // NAME-SANITIZE-1018
    expect(foldWalletNames(input, 7)).toBe(input); // NAME-SANITIZE-1018
    expect(asciiNamesCopy(input, 7)).toBe(input); // NAME-SANITIZE-1018
    expect(foldWalletNames([input])).toEqual([{ givenName: "Customer" }]); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it("flags only actual wallet name changes and retains original names in metadata", () => { // NAME-SANITIZE-1018
    const input = { payment: { firstName: "محمد", lastName: "Ali" }, gpay_billing_details: '{ "name": "John" }' }; // NAME-SANITIZE-1018
    expect(namesSentMeta(input)).toEqual({ name_original: { first: "محمد", last: "Ali" }, name_sent_to_cellpay: { first: "Customer", last: "Ali" }, name_folded: true, wallet_names_folded: false }); // NAME-SANITIZE-1018
    expect(namesSentMeta({ apple_pay_billing_contact: '{"givenName":"محمد"}' })).toEqual({ wallet_names_folded: true }); // NAME-SANITIZE-1018
    expect(namesSentMeta({ gpay_billing_details: "{bad" })).toEqual({ wallet_names_folded: false }); // NAME-SANITIZE-1018
    expect(namesSentMeta({ gpay_billing_details: { name: "李" } }).wallet_names_folded).toBe(true); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
}); // NAME-SANITIZE-1018
describe("ACCENT-FOLD / WALLET-NAME / NAME-DIGITS regression coverage (prior suites absent from checkout)", () => { // NAME-SANITIZE-1018
  it("preserves ordinary addresses while folding nested billing names", () => { // NAME-SANITIZE-1018
    expect(asciiNamesCopy({ billing: { billing_name: "José", address: "Québec" }, amount: 50, total: 55 })).toEqual({ billing: { billing_name: "Jose", address: "Québec" }, amount: 50, total: 55 }); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it("retains existing wallet emoji-stripping behavior", () => { // NAME-SANITIZE-1018
    const payload = { apple_pay_billing_contact: JSON.stringify({ givenName: "Dani 😀" }), apple_pay_token: "tok😀" }; // NAME-SANITIZE-1018
    sanitizeWalletJson(payload); // NAME-SANITIZE-1018
    expect(JSON.parse(payload.apple_pay_billing_contact).givenName).toBe("Dani"); // NAME-SANITIZE-1018
    expect(payload.apple_pay_token).toBe("tok😀"); // NAME-SANITIZE-1018
  }); // NAME-SANITIZE-1018
  it.each([ // NAME-SANITIZE-1018
    [{ firstName: "John123456" }, true], [{ firstName: "John123", lastName: "Smith456" }, true], // NAME-SANITIZE-1018
    [{ payment: { first_name: "José", last_name: "Smith" } }, false], [{ firstName: "John12", lastName: "Smith345" }, false], // NAME-SANITIZE-1018
    [{ phone_number: "1234567890" }, false], // NAME-SANITIZE-1018
  ])("preserves name digit guard for %j", (input, expected) => expect(nameHasCardDigits(input)).toBe(expected)); // NAME-SANITIZE-1018
}); // NAME-SANITIZE-1018
