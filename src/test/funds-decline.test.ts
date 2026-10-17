/// <reference types="node" />
// FUNDS-DECLINE-1016: exercise real helpers and metadata without making payments.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import { isNsfDecline, KLARNA_MIN_TOTAL, klarnaQuarter } from "@/lib/declineRecovery";

const compile = (s: string) => ts.transpile(s, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8");
const wrapper = readFileSync("src/services/apiWrapper.ts", "utf8");
const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8");
const metadata = runInNewContext(compile(`${wrapper.slice(wrapper.indexOf("function storedRetryMeta("), wrapper.indexOf("export async function submitTransaction("))}; storedRetryMeta;`), { sessionStorage, localStorage, navigator, Date });
const allow = runInNewContext(compile(`const asRecord = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}; const ORS_METHOD_RE = /^[a-z]{2,20}$/; ${proxy.slice(proxy.indexOf("function retryMetaFrom("), proxy.indexOf("// CONSENT-EVERY-ATTEMPT-1016: record checkout consent"))}; retryMetaFrom;`));

describe("FUNDS-DECLINE-1016", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
  it.each(["Insufficient funds", "not sufficient funds", "NSF"])("recognizes %s", (msg) => expect(isNsfDecline(msg)).toBe(true));
  it("does not treat other bank declines or embedded nsf as NSF", () => {
    expect(isNsfDecline("Do not honor")).toBe(false);
    expect(isNsfDecline("transfer declined")).toBe(false);
  });
  it("requires a $25 recovery total and rounds the quarter upward to cents", () => {
    expect(KLARNA_MIN_TOTAL).toBe(25);
    expect(klarnaQuarter(65)).toBe("16.25");
    expect(klarnaQuarter(25.01)).toBe("6.26");
  });
  it("copies fresh NSF recovery booleans and preserves the A/B arm", () => {
    sessionStorage.setItem("cp_decline_ab_v1", "variant");
    sessionStorage.setItem("cp_funds_v1", JSON.stringify({ ts: Date.now(), klarna_offered: true, klarna_clicked: false, klarna_auth_declined: true }));
    expect(metadata({})).toEqual({ decline_ab: "variant", decline_cls: "nsf", funds_ui: "v1", klarna_offered: true, klarna_clicked: false, klarna_auth_declined: true });
  });
  it("excludes expired and malformed recovery storage", () => {
    sessionStorage.setItem("cp_funds_v1", JSON.stringify({ ts: Date.now() - 30 * 60_000, klarna_clicked: true }));
    expect(metadata({})).toBeUndefined();
    sessionStorage.setItem("cp_funds_v1", "bad json");
    expect(metadata({})).toBeUndefined();
  });
  it("only allows exact recovery markers and boolean fields into log metadata", () => {
    expect(allow({ decline_cls: "nsf", funds_ui: "v1", klarna_offered: false, klarna_clicked: true, klarna_auth_declined: false, secret: "exclude" })).toEqual({ decline_cls: "nsf", funds_ui: "v1", klarna_offered: false, klarna_clicked: true, klarna_auth_declined: false });
    expect(allow({ decline_cls: "funds", funds_ui: "v2", klarna_clicked: "true" })).toEqual({});
  });
  const effectStart = checkout.indexOf("if (!declineInfo || !isNsfDecline");
  const effect = checkout.slice(effectStart, checkout.indexOf("// eslint-disable-next-line", effectStart));
  it("logs offers only at $25+ and does not initialize for capped or blocked declines", () => {
    const run = (total: number, sess = 1, cls = "funds") => runInNewContext(compile(`(() => { ${effect} })();`), { declineInfo: { msg: "insufficient funds", sess, cls }, isNsfDecline, paymentMethods: [{ key: "klarna" }], total, KLARNA_MIN_TOTAL, sessionStorage, Date });
    run(24.99);
    expect(JSON.parse(sessionStorage.getItem("cp_funds_v1") || "null").klarna_offered).toBe(false);
    run(25);
    const saved = sessionStorage.getItem("cp_funds_v1");
    expect(JSON.parse(saved || "null").klarna_offered).toBe(true);
    run(65, 3); run(65, 1, "blocked");
    expect(sessionStorage.getItem("cp_funds_v1")).toBe(saved);
  });
  it("prefills empty Klarna fields without overwriting existing values or submitting", () => {
    const start = checkout.indexOf('const f = JSON.parse(sessionStorage.getItem("cp_funds_v1")', checkout.indexOf('data-testid="funds-klarna"'));
    const code = checkout.slice(checkout.lastIndexOf("try {", start), checkout.indexOf('toMethod("klarna");', start) + 'toMethod("klarna");'.length);
    const values: Record<string, string> = {};
    sessionStorage.setItem("cp_funds_v1", JSON.stringify({ ts: Date.now(), klarna_clicked: false }));
    runInNewContext(compile(code), { sessionStorage, klarnaFirstName: "Saved", klarnaLastName: "", klarnaPhone: "", firstName: "New", lastName: "Name", state: { phone: "2025550100" }, setKlarnaFirstName: (v: string) => { values.first = v; }, setKlarnaLastName: (v: string) => { values.last = v; }, setKlarnaPhone: (v: string) => { values.phone = v; }, toMethod: (v: string) => { values.method = v; } });
    expect(values).toEqual({ last: "Name", phone: "2025550100", method: "klarna" });
    expect(JSON.parse(sessionStorage.getItem("cp_funds_v1") || "null").klarna_clicked).toBe(true);
  });
});