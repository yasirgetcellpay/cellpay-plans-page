import { readFileSync } from "node:fs"; // BACKEND-EXC-1019
import { runInNewContext } from "node:vm"; // BACKEND-EXC-1019
import ts from "typescript"; // BACKEND-EXC-1019
import { describe, expect, it } from "vitest"; // BACKEND-EXC-1019

const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // BACKEND-EXC-1019
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8"); // BACKEND-EXC-1019
const compile = (source: string) => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }); // BACKEND-EXC-1019
const declarations = (source: string, names: string[]) => { // BACKEND-EXC-1019
  const file = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); // BACKEND-EXC-1019
  const found: string[] = []; // BACKEND-EXC-1019
  const visit = (node: ts.Node) => { // BACKEND-EXC-1019
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.push(node.getText(file)); // BACKEND-EXC-1019
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) found.push(`const ${node.getText(file)};`); // BACKEND-EXC-1019
    ts.forEachChild(node, visit); // BACKEND-EXC-1019
  }; // BACKEND-EXC-1019
  visit(file); return found.join("\n"); // BACKEND-EXC-1019
}; // BACKEND-EXC-1019
const browserHelpers = declarations(checkout, ["isUnconfirmed", "isDbFormatUnconfirmed", "isBackendExcReply", "hasRefundSignal"]); // BACKEND-EXC-1019
const predicates = runInNewContext(compile(`${browserHelpers}\n({ isDbFormatUnconfirmed, isBackendExcReply });`)); // BACKEND-EXC-1019
const proxyHelpers = declarations(proxy, ["chargeUnconfirmedKind", "isDbFormatError"]); // BACKEND-EXC-1019
const pre = "const asRecord = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};"; // BACKEND-EXC-1019
const message = "Backend exception occurred. Please contact Cell Pay technical support."; // BACKEND-EXC-1019
const rawReply = { data: { status: false, message } }; // BACKEND-EXC-1019
const mappedReply = { success: false, code: "CHARGE_UNCONFIRMED", error: "charge_unconfirmed", data: { status: false, message: "charge_unconfirmed", charge_unconfirmed: true, unconfirmed_kind: "backend_exception" } }; // BACKEND-EXC-1019
const replyBlock = proxy.slice(proxy.indexOf("if (unconfirmedKind && !isPockytCreate) {"), proxy.indexOf("if (loadText && !isPockytCreate) wrapped.load_text")); // BACKEND-EXC-1019
const handle = declarations(checkout, ["handleResult"]); // BACKEND-EXC-1019
const appleStart = checkout.indexOf('if (raw.code === "MAYBE_PAID"', checkout.indexOf('console.error("[ApplePay] transaction failed"')); // BACKEND-EXC-1019
const appleChain = checkout.slice(appleStart, checkout.indexOf('else if (raw.code !== "DUP_CONFIRM"', appleStart)); // BACKEND-EXC-1019
const exercise = (source: string, raw: Record<string, unknown>) => { // BACKEND-EXC-1019
  const calls: Array<[string, ...unknown[]]> = []; // BACKEND-EXC-1019
  const scope: Record<string, unknown> = { raw, paymentMethod: "card", state: { phone: "2025550123", amount: 40 }, validation: { amount: 50 }, PAYLOCK_UNKNOWN_MS: 600000, lockKey: (phone: string, amount: number) => `${phone}:${amount}` }; // BACKEND-EXC-1019
  for (const name of ["setShowNotChargedNote", "setDeclineInfo", "setRefundCard", "setLoadReason", "setErrorMsg", "setUnconfirmedCard", "setLock", "showMaybePaid", "earlyPurchase", "setPurchasePending", "navigate"]) scope[name] = (...args: unknown[]) => calls.push([name, ...args]); // BACKEND-EXC-1019
  runInNewContext(compile(`${browserHelpers}\n${source}`), scope); return calls; // BACKEND-EXC-1019
}; // BACKEND-EXC-1019

describe("BACKEND-EXC-1019", () => { // BACKEND-EXC-1019
  it("maps the HTTP 200 backend exception to a safe outcome-unknown reply", () => { // BACKEND-EXC-1019
    const data = rawReply.data; // BACKEND-EXC-1019
    const result = runInNewContext(compile(`${pre}\n${proxyHelpers}\nlet wrapped = { success: true, data }; const unconfirmedKind = chargeUnconfirmedKind(200, data, wrapped); ${replyBlock}\n({ wrapped, unconfirmedKind });`), { data, isPockytCreate: false }); // BACKEND-EXC-1019
    expect(result.unconfirmedKind).toBe("backend_exc"); // BACKEND-EXC-1019
    expect(result.wrapped).toEqual(mappedReply); // BACKEND-EXC-1019
    expect(data).toEqual({ status: false, message }); // BACKEND-EXC-1019
  }); // BACKEND-EXC-1019
  it.each(["db_format", "backend_exception"])("recognizes the mapped %s unknown outcome", (kind) => { // BACKEND-EXC-1019
    expect(predicates.isDbFormatUnconfirmed({ ...mappedReply, data: { ...mappedReply.data, unconfirmed_kind: kind } })).toBe(true); // BACKEND-EXC-1019
    expect(predicates.isDbFormatUnconfirmed({ data: { unconfirmed_kind: kind } })).toBe(false); // BACKEND-EXC-1019
  }); // BACKEND-EXC-1019
  it("detects nested raw backend exceptions without treating ordinary declines as unknown", () => { // BACKEND-EXC-1019
    expect(predicates.isBackendExcReply(rawReply)).toBe(true); // BACKEND-EXC-1019
    expect(predicates.isBackendExcReply({ data: { status: false, message: "Insufficient funds" } })).toBe(false); // BACKEND-EXC-1019
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic; // BACKEND-EXC-1019
    expect(predicates.isBackendExcReply(cyclic)).toBe(false); // BACKEND-EXC-1019
  }); // BACKEND-EXC-1019
  it.each([["handleResult", `${handle}\nhandleResult(raw);`], ["Apple Pay", appleChain]])("%s opens maybe-paid for mapped and raw exceptions with no conversion", (_name, source) => { // BACKEND-EXC-1019
    for (const raw of [mappedReply, rawReply]) { // BACKEND-EXC-1019
      expect(exercise(source, raw)).toEqual([["setShowNotChargedNote", false], ["setDeclineInfo", null], ["setRefundCard", false], ["setLoadReason", null], ["setErrorMsg", null], ["setUnconfirmedCard", false], ["setLock", "2025550123:50", "unknown", 600000], ["showMaybePaid", false]]); // BACKEND-EXC-1019
    } // BACKEND-EXC-1019
    expect(exercise(source, { code: "CHARGE_UNCONFIRMED", data: { status: false } })).toContainEqual(["setUnconfirmedCard", true]); // BACKEND-EXC-1019
  }); // BACKEND-EXC-1019
  it("blocks a matching phone, plan and amount for 30 minutes but not an unrelated amount", async () => { // BACKEND-EXC-1019
    const now = Date.now(); // BACKEND-EXC-1019
    const queries: string[] = []; // BACKEND-EXC-1019
    const helpers = declarations(proxy, ["RB_WINDOW_MS", "RETRY_BLOCK_RE", "retryBlockCheck"]); // BACKEND-EXC-1019
    const check = runInNewContext(compile(`${helpers}\nretryBlockCheck;`), { Deno: { env: { get: () => "test" } }, AbortSignal, Date: class extends Date { static now() { return now; } }, fetch: async (url: string) => { queries.push(url); return { ok: true, json: async () => [{ amount: 50, error_message: message, created_at: new Date(now - 60000).toISOString() }] }; } }); // BACKEND-EXC-1019
    expect(await check({ phone_number: "2025550123", plan_id: "test-plan", amount: 50 })).toBe(1740); // BACKEND-EXC-1019
    expect(await check({ phone_number: "2025550123", plan_id: "test-plan", amount: 51 })).toBeNull(); // BACKEND-EXC-1019
    const query = new URL(queries[0], "https://test.invalid").searchParams; // BACKEND-EXC-1019
    expect(query.get("phone_number")).toBe('in.("2025550123")'); // BACKEND-EXC-1019
    expect(query.get("plan_id")).toBe("eq.test-plan"); // BACKEND-EXC-1019
    expect(query.get("created_at")).toBe(`gte.${new Date(now - 1800000).toISOString()}`); // BACKEND-EXC-1019
  }); // BACKEND-EXC-1019
  it.each(["en", "es"])("never offers the outside retry for a raw exception in %s", (lang) => { // BACKEND-EXC-1019
    const calls: unknown[] = []; // BACKEND-EXC-1019
    const result = runInNewContext(compile(`${declarations(checkout, ["orsOnFail"])}\norsOnFail(msg);`), { msg: message, lang, setOrsRetry: (value: boolean) => calls.push(value) }); // BACKEND-EXC-1019
    expect(calls).toEqual([false]); // BACKEND-EXC-1019
    expect(result).toBe(lang === "es" ? "No pudimos completar este pago. Espere unos minutos y vuelva a intentarlo, o use otro método de pago." : "We couldn't complete this payment. Please wait a few minutes and try again, or use another payment method."); // BACKEND-EXC-1019
  }); // BACKEND-EXC-1019
}); // BACKEND-EXC-1019