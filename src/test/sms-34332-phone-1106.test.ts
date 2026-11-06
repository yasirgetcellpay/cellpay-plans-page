import { afterEach, describe, expect, it } from "vitest"; // SMS-34332-PHONE-1106
import { readFileSync } from "node:fs"; // SMS-34332-PHONE-1106
import ts from "typescript"; // SMS-34332-PHONE-1106
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8"); // SMS-34332-PHONE-1106
const carrier = readFileSync("src/pages/DynamicCarrier.tsx", "utf8"); // SMS-34332-PHONE-1106
const go = readFileSync("src/pages/GoLander.tsx", "utf8"); // SMS-34332-PHONE-1106
const resume = readFileSync("src/lib/checkoutResume.ts", "utf8"); // SMS-34332-PHONE-1106
afterEach(() => sessionStorage.clear()); // SMS-34332-PHONE-1106
describe("SMS-34332-PHONE-1106", () => { // SMS-34332-PHONE-1106
  it("collects consent only with the phone and retains both existing order logging calls", () => { // SMS-34332-PHONE-1106
    expect(checkout).not.toContain('data-sms-optin="1020"'); // SMS-34332-PHONE-1106
    for (const source of [carrier, go]) { expect(source).toContain('data-sms-optin="1020"'); expect(source).toContain("Yes, text me payment reminders and Text-to-Pay messages from CellPay at this number."); } // SMS-34332-PHONE-1106
    expect(checkout).toContain("const recordSmsOptIn ="); expect(checkout).toContain('"record_sms_opt_in"'); expect(checkout.match(/recordSmsOptIn\(hid, smsOptInRef.current, lang\)/g)).toHaveLength(2); // SMS-34332-PHONE-1106
  }); // SMS-34332-PHONE-1106
  it.each([undefined, false, true, "true", 1])("restores consent only for literal true handoff %s", (smsOptIn) => { // SMS-34332-PHONE-1106
    const line = checkout.split("\n").find((entry) => entry.includes("const initialSms =")); if (!line) throw new Error("Missing consent initialization"); // SMS-34332-PHONE-1106
    const compiled = ts.transpileModule(`${line}\nreturn initialSms;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; // SMS-34332-PHONE-1106
    const initial = new Function("location", "savedState", compiled); // SMS-34332-PHONE-1106
    expect(initial({ state: { smsOptIn } }, null)).toBe(smsOptIn === true); expect(initial({ state: null }, { smsOptIn })).toBe(smsOptIn === true); expect(initial({ state: { smsOptIn: false } }, { smsOptIn: true })).toBe(false); // SMS-34332-PHONE-1106
  }); // SMS-34332-PHONE-1106
  it.each([undefined, false, true, "true", 1])("round trips only literal true consent in saved handoffs %s", (smsOptIn) => { // SMS-34332-PHONE-1106
    const source = resume.replace(/^import .*$/gm, "").replace(/export /g, ""); // SMS-34332-PHONE-1106
    const code = ts.transpileModule(`${source}\nreturn { writeCheckoutCtx, readCheckoutCtx };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText; // SMS-34332-PHONE-1106
    const ctx = new Function("sessionStorage", code)(sessionStorage); // SMS-34332-PHONE-1106
    ctx.writeCheckoutCtx({ phone: "(202) 555-0123", amount: "30", carrierSlug: "s1", carrierName: "Simple Mobile", brandColor: "", smsOptIn }); // SMS-34332-PHONE-1106
    expect(ctx.readCheckoutCtx()?.smsOptIn === true).toBe(smsOptIn === true); // SMS-34332-PHONE-1106
    const stored = JSON.parse(sessionStorage.getItem("cp_checkout_ctx_v1") || "{}"); stored.smsOptIn = smsOptIn; sessionStorage.setItem("cp_checkout_ctx_v1", JSON.stringify(stored)); expect(ctx.readCheckoutCtx()?.smsOptIn === true).toBe(smsOptIn === true); // SMS-34332-PHONE-1106
  }); // SMS-34332-PHONE-1106
}); // SMS-34332-PHONE-1106