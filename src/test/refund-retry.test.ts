import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"; // REFUND-RETRY-1018
import { readFileSync } from "node:fs"; // REFUND-RETRY-1018
import ts from "typescript"; // REFUND-RETRY-1018
import { retryCauseFor, retryReasonText, retryButtons, recordRefund, recordRetryTap, refundCount24h, writeRetryCtx, readRetryCtx, takeRetryPrefill, clearRetryCtx } from "@/lib/refundRetry"; // REFUND-RETRY-1018
import { resetFunnel, trackFunnel } from "@/lib/funnelEvents"; // REFUND-RETRY-1018
const funnel = readFileSync("supabase/functions/funnel-event/index.ts", "utf8"); // REFUND-RETRY-1018
const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // REFUND-RETRY-1018
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8"); // REFUND-RETRY-1018
const wrapper = readFileSync("src/services/apiWrapper.ts", "utf8"); // REFUND-RETRY-1018
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText; // REFUND-RETRY-1018
const cleanEnd = funnel.indexOf("\nDeno.serve("); // REFUND-RETRY-1018
const clean = new Function(compile(funnel.slice(0, cleanEnd)) + "; return clean;")() as (r: unknown, host: string | null) => Record<string, unknown> | null; // REFUND-RETRY-1018
const metaStart = proxy.indexOf("const ORS_METHOD_RE"); // REFUND-RETRY-1018
const metaEnd = proxy.indexOf("// CONSENT-EVERY-ATTEMPT-1016", metaStart); // REFUND-RETRY-1018
const retryMetaFrom = new Function("const asRecord = (v) => v && typeof v === 'object' ? v : {};" + compile(proxy.slice(metaStart, metaEnd)) + "; return retryMetaFrom;")() as (r: unknown) => Record<string, unknown>; // REFUND-RETRY-1018
const now = new Date(2026, 9, 18, 15, 32).getTime(); // REFUND-RETRY-1018
const phone = "3125551234"; // REFUND-RETRY-1018
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now); resetFunnel(); }); // REFUND-RETRY-1018
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); resetFunnel(); }); // REFUND-RETRY-1018
describe("REFUND-RETRY-1018", () => { // REFUND-RETRY-1018
  const reasons = [ // REFUND-RETRY-1018
    ["tmobile", "tmo_plan_mismatch", "T-Mobile did not accept this refill for this number. It may be a monthly T-Mobile account, a Metro by T-Mobile number, or the amount may not fit the plan on this line.", "T-Mobile no aceptó esta recarga para este número. Puede ser una cuenta mensual de T-Mobile, un número de Metro by T-Mobile, o puede que el monto no corresponda al plan de esta línea."], // REFUND-RETRY-1018
    ["s1", "simple_not_found", "Simple Mobile could not find this number. It may be a Straight Talk, Total Wireless, Tracfone or NET10 number.", "Simple Mobile no encontró este número. Puede ser un número de Straight Talk, Total Wireless, Tracfone o NET10."], // REFUND-RETRY-1018
    ["metropcs", "metro_invalid_number", "Metro could not find this number. Please check the number: (312) 555-1234.", "Metro no encontró este número. Por favor revise el número: (312) 555-1234."], // REFUND-RETRY-1018
    ["boost", "boost_blank", "Boost did not accept this payment right now. Please check that this is a Boost Mobile number, or try again in a few minutes.", "Boost no aceptó este pago en este momento. Verifique que sea un número de Boost Mobile, o inténtelo de nuevo en unos minutos."], // REFUND-RETRY-1018
  ]; // REFUND-RETRY-1018
  it.each(reasons)("maps %s and its exact bilingual reason", (slug, cause, en, es) => { // REFUND-RETRY-1018
    const actual = retryCauseFor(slug); expect(actual).toBe(cause); if (!actual) throw new Error("Missing cause"); // REFUND-RETRY-1018
    expect(retryReasonText(actual, "en", phone)).toBe(en); expect(retryReasonText(actual, "es", phone)).toBe(es); // REFUND-RETRY-1018
    for (const lang of ["en", "es"]) { // REFUND-RETRY-1018
      const all = [retryReasonText(actual, lang, phone), ...retryButtons(slug, lang, phone, now).map((b) => b.label)].join(" "); // REFUND-RETRY-1018
      expect(all).not.toMatch(/cualquier|declin|rechaz|❌|CellPay|PaynUp|Pockyt|Cybersource|Stripe/i); // REFUND-RETRY-1018
      if (["boost", "metropcs"].includes(slug)) expect(all).not.toMatch(/refill|recarga/i); // REFUND-RETRY-1018
    } // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("leaves other carriers unchanged", () => { expect(retryCauseFor("topup-at")).toBeNull(); expect(retryButtons("topup-at", "en", phone, now)).toEqual([]); }); // REFUND-RETRY-1018
  it.each([ // REFUND-RETRY-1018
    ["tmobile", [["Pay as Metro by T-Mobile", "Pagar como Metro by T-Mobile", "to_carrier", "metropcs"], ["Choose another amount", "Elegir otro monto", "amount", "tmobile"], ["Change number", "Cambiar número", "number", undefined]]], // REFUND-RETRY-1018
    ["s1", [["Straight Talk", "Straight Talk", "to_carrier", "straight-talk"], ["Total Wireless", "Total Wireless", "to_carrier", "total-wireless"], ["Tracfone", "Tracfone", "to_carrier", "tracfone"], ["NET10", "NET10", "to_carrier", "net10"], ["Change number", "Cambiar número", "number", undefined]]], // REFUND-RETRY-1018
    ["metropcs", [["Fix number", "Corregir número", "number", undefined], ["It's a T-Mobile number", "Es un número de T-Mobile", "to_carrier", "tmobile"], ["Choose another carrier", "Elegir otra compañía", "other_carrier", undefined]]], // REFUND-RETRY-1018
    ["boost", [["Try again", "Intentar de nuevo", "try_again", "boost"], ["Change number", "Cambiar número", "number", undefined], ["Choose another carrier", "Elegir otra compañía", "other_carrier", undefined]]], // REFUND-RETRY-1018
  ] as const)("keeps %s button order and targets", (slug, expected) => { // REFUND-RETRY-1018
    expect(retryButtons(slug, "en", phone, now).map((b, i) => [b.label, retryButtons(slug, "es", phone, now)[i]?.label, b.action, b.to_carrier])).toEqual(expected); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it.each(["tmobile", "boost"])("hides same-carrier fixes after two refunds for %s only", (slug) => { // REFUND-RETRY-1018
    recordRefund(phone, slug, now - 100); recordRefund(phone, slug, now); // REFUND-RETRY-1018
    expect(refundCount24h(phone, slug)).toBe(2); // REFUND-RETRY-1018
    expect(retryButtons(slug, "en", phone, now).some((b) => ["amount", "try_again"].includes(b.action))).toBe(false); // REFUND-RETRY-1018
    expect(retryButtons(slug, "en", "2025550199", now).some((b) => ["amount", "try_again"].includes(b.action))).toBe(true); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("keeps only 24 hours and at most ten refunds", () => { // REFUND-RETRY-1018
    recordRefund(phone, "boost", now - 24 * 60 * 60_000); expect(refundCount24h(phone, "boost")).toBe(0); // REFUND-RETRY-1018
    for (let i = 0; i < 12; i++) recordRefund(phone, "boost", now - 12 + i); // REFUND-RETRY-1018
    expect(refundCount24h(phone, "boost")).toBe(10); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("hides Try again for thirty minutes after a tap, independently of carrier history", () => { // REFUND-RETRY-1018
    recordRetryTap(phone, now); // REFUND-RETRY-1018
    expect(retryButtons("boost", "en", phone, now + 30 * 60_000 - 1).some((b) => b.action === "try_again")).toBe(false); // REFUND-RETRY-1018
    expect(retryButtons("boost", "en", phone, now + 30 * 60_000).some((b) => b.action === "try_again")).toBe(true); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("disables Try again until ten minutes after the latest refund with local time", () => { // REFUND-RETRY-1018
    recordRefund(phone, "boost", now); // REFUND-RETRY-1018
    expect(retryButtons("boost", "en", phone, now)[0]).toMatchObject({ notBefore: now + 10 * 60_000, disabled: true, label: "Try again after 3:42 PM" }); // REFUND-RETRY-1018
    expect(retryButtons("boost", "es", phone, now)[0]?.label).toBe("Intentar de nuevo después de las 3:42 p. m."); // REFUND-RETRY-1018
    expect(retryButtons("boost", "en", phone, now + 10 * 60_000)[0]).toMatchObject({ notBefore: now + 10 * 60_000, disabled: false, label: "Try again" }); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  const ctx = { cause: "tmo_plan_mismatch" as const, action: "to_carrier" as const, from_carrier: "tmobile", to_carrier: "metropcs", email: "test@example.test", method: "card" }; // REFUND-RETRY-1018
  it("prefills only the matching slug, once, preserving attribution", () => { // REFUND-RETRY-1018
    writeRetryCtx(ctx); expect(takeRetryPrefill("tmobile")).toBeNull(); // REFUND-RETRY-1018
    expect(takeRetryPrefill("metropcs")).toEqual({ email: ctx.email, method: "card" }); // REFUND-RETRY-1018
    expect(readRetryCtx()).toMatchObject({ cause: ctx.cause, action: ctx.action, from_carrier: "tmobile", to_carrier: "metropcs" }); // REFUND-RETRY-1018
    expect(readRetryCtx()).not.toHaveProperty("email"); expect(readRetryCtx()).not.toHaveProperty("method"); // REFUND-RETRY-1018
    expect(takeRetryPrefill("metropcs")).toEqual({ email: undefined, method: undefined }); // REFUND-RETRY-1018
    clearRetryCtx(); expect(readRetryCtx()).toBeNull(); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("prefill expires at ten minutes, attribution at thirty", () => { // REFUND-RETRY-1018
    writeRetryCtx(ctx, now - 10 * 60_000); expect(takeRetryPrefill("metropcs")).toBeNull(); expect(readRetryCtx()).not.toBeNull(); // REFUND-RETRY-1018
    writeRetryCtx(ctx, now - 30 * 60_000); expect(readRetryCtx()).toBeNull(); // REFUND-RETRY-1018
    writeRetryCtx(ctx, now + 1); expect(readRetryCtx()).toBeNull(); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("fails open for malformed or unavailable storage", () => { // REFUND-RETRY-1018
    localStorage.setItem("cp_refund_hist_v1", "bad"); sessionStorage.setItem("cp_refund_retry_v1", "bad"); // REFUND-RETRY-1018
    expect(retryButtons("boost", "en", phone, now)[0]?.disabled).toBeUndefined(); expect(readRetryCtx()).toBeNull(); // REFUND-RETRY-1018
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("unavailable"); }); // REFUND-RETRY-1018
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); }); // REFUND-RETRY-1018
    expect(() => recordRefund(phone, "boost", now)).not.toThrow(); expect(() => recordRetryTap(phone)).not.toThrow(); expect(() => writeRetryCtx(ctx)).not.toThrow(); // REFUND-RETRY-1018
    expect(refundCount24h(phone, "boost")).toBe(0); expect(readRetryCtx()).toBeNull(); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it.each(["retry_offer_shown", "retry_tapped", "retry_success"])("accepts %s with allow-listed fields only", (event) => { // REFUND-RETRY-1018
    const good = { event, retry_cause: "tmo_plan_mismatch", retry_action: "to_carrier,amount,number", retry_to_carrier: "metropcs", phone, email: ctx.email }; // REFUND-RETRY-1018
    expect(clean(good, null)).toMatchObject({ event, retry_cause: good.retry_cause, retry_action: good.retry_action, retry_to_carrier: "metropcs" }); // REFUND-RETRY-1018
    expect(clean(good, null)).not.toHaveProperty("phone"); expect(clean(good, null)).not.toHaveProperty("email"); // REFUND-RETRY-1018
    expect(clean({ event, retry_cause: "evil", retry_action: "Number-1!" /* REFUND-RETRY-LATE-1018: digits now allowed */, retry_to_carrier: "../bad" }, null)).toMatchObject({ retry_cause: null, retry_action: null, retry_to_carrier: null }); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("isolates retry inserts from existing batches", () => { // REFUND-RETRY-1018
    expect(funnel).toContain('const retryWrite = retryRows.length ? postRows(retryRows) : Promise.resolve();'); // REFUND-RETRY-1018
    expect(funnel).toContain('rt.waitUntil(retryWrite); else await retryWrite;'); // REFUND-RETRY-1018
    expect(clean({ event: "checkout_view", retry_cause: "boost_blank" }, null)).not.toHaveProperty("retry_cause"); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("stores allow-listed proxy metadata only when marked as refund retry", () => { // REFUND-RETRY-1018
    expect(retryMetaFrom({ retry_src: "refund_retry", retry_from_carrier: "tmobile", retry_action: "to_carrier", retry_cause: "tmo_plan_mismatch", email: ctx.email, phone })).toEqual({ retry_src: "refund_retry", retry_from_carrier: "tmobile", retry_action: "to_carrier", retry_cause: "tmo_plan_mismatch" }); // REFUND-RETRY-1018
    expect(retryMetaFrom({ retry_src: "refund_retry", retry_from_carrier: "../bad", retry_action: "bad", retry_cause: "bad" })).toEqual({ retry_src: "refund_retry" }); // REFUND-RETRY-1018
    expect(retryMetaFrom({ retry_src: "bad", retry_action: "number" })).toEqual({}); // REFUND-RETRY-1018
    expect(wrapper).toContain('out.retry_src = "refund_retry"'); expect(proxy).toContain('if (r.retry_src === "refund_retry")'); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("never submits from any retry action and revalidates cross-carrier checkout", () => { // REFUND-RETRY-1018
    const start = checkout.indexOf("        const retry = async (choice: RetryButton)"); expect(start).toBeGreaterThan(-1); // REFUND-RETRY-1018
    const handler = checkout.slice(start, checkout.indexOf("        return (", start)); // REFUND-RETRY-1018
    expect(handler).not.toMatch(/handlePlaceOrder\(|submitTransaction\(|\.click\(/); // REFUND-RETRY-1018
    expect(handler).toContain("resolveCheckoutFromUrl(lang,"); expect(handler).toContain("writeCheckoutCtx(result.state)"); expect(handler).toContain("window.location.assign"); // REFUND-RETRY-1018
    expect(handler).toContain("selectPhone: true"); expect(checkout).toContain('if (readRetryCtx()?.to_carrier === state?.carrierSlug) return;'); // REFUND-RETRY-1018
    expect(checkout.indexOf("takeRetryPrefill(state.carrierSlug)")).toBeLessThan(checkout.indexOf("  if (!state) {\n    return (")); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
  it("sends retry_tapped with no phone or email", async () => { // REFUND-RETRY-1018
    const sendBeacon = vi.fn(() => true); vi.stubGlobal("navigator", { sendBeacon }); // REFUND-RETRY-1018
    trackFunnel("retry_tapped", { carrier: "tmobile", amount: 30, retry_cause: "tmo_plan_mismatch", retry_action: "to_carrier", retry_to_carrier: "metropcs", ...{ phone, email: ctx.email } }, "k1"); // REFUND-RETRY-1018
    const blob = (sendBeacon.mock.calls as unknown[][])[0]?.[1]; if (!(blob instanceof Blob)) throw new Error("Missing beacon"); // REFUND-RETRY-1018
    vi.useRealTimers(); // REFUND-RETRY-1018
    const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob); }); // REFUND-RETRY-1018
    const body = JSON.parse(text); expect(body).toMatchObject({ event: "retry_tapped", retry_cause: "tmo_plan_mismatch", retry_action: "to_carrier", retry_to_carrier: "metropcs" }); // REFUND-RETRY-1018
    expect(body).not.toHaveProperty("phone"); expect(body).not.toHaveProperty("email"); expect(text).not.toContain(phone); expect(text).not.toContain(ctx.email); // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
}); // REFUND-RETRY-1018
