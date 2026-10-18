import { readFileSync } from "node:fs"; // NAME-SANITIZE-1018B
import { runInNewContext } from "node:vm"; // NAME-SANITIZE-1018B
import ts from "typescript"; // NAME-SANITIZE-1018B
import { describe, expect, it } from "vitest"; // NAME-SANITIZE-1018B
const proxy = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); // NAME-SANITIZE-1018B
const checkout = readFileSync("src/pages/Checkout.tsx", "utf8"); // NAME-SANITIZE-1018B
const compile = (s: string) => ts.transpile(s, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }); // NAME-SANITIZE-1018B
const declarations = (source: string, names: string[]) => { // NAME-SANITIZE-1018B
  const file = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); // NAME-SANITIZE-1018B
  const found: string[] = []; // NAME-SANITIZE-1018B
  const visit = (node: ts.Node) => { // NAME-SANITIZE-1018B
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.push(node.getText(file)); // NAME-SANITIZE-1018B
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) found.push(`const ${node.getText(file)};`); // NAME-SANITIZE-1018B
    ts.forEachChild(node, visit); // NAME-SANITIZE-1018B
  }; // NAME-SANITIZE-1018B
  visit(file); return found.join("\n"); // NAME-SANITIZE-1018B
}; // NAME-SANITIZE-1018B
const pre = `const asRecord = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};`; // NAME-SANITIZE-1018B
const helpers = declarations(proxy, ["chargeUnconfirmedKind", "isDbFormatError"]); // NAME-SANITIZE-1018B
const dbError = runInNewContext(compile(`${pre}\n${helpers}\nisDbFormatError;`)); // NAME-SANITIZE-1018B
const browserHelpers = declarations(checkout, ["isUnconfirmed", "isDbFormatUnconfirmed", "hasRefundSignal"]); // NAME-SANITIZE-1018B
const dbUnconfirmed = runInNewContext(compile(`${browserHelpers}\nisDbFormatUnconfirmed;`)); // NAME-SANITIZE-1018B
const replyBlock = proxy.slice(proxy.indexOf("if (unconfirmedKind && !isPockytCreate) {"), proxy.indexOf("if (loadText && !isPockytCreate) wrapped.load_text")); // NAME-SANITIZE-1018B
const reply = (message: string, status = 400, extra = {}) => { // NAME-SANITIZE-1018B
  const data = { status: false, message, ...extra }; // NAME-SANITIZE-1018B
  return runInNewContext(compile(`${pre}\n${helpers}\nlet wrapped = { success: false, error: data.message, data, pending_log_id: 'order', risk_action: 'step_up' }; const unconfirmedKind = chargeUnconfirmedKind(status, data, wrapped); ${replyBlock}\nwrapped;`), { data, status, isPockytCreate: false }); // NAME-SANITIZE-1018B
}; // NAME-SANITIZE-1018B
const formatReply = { success: false, code: "CHARGE_UNCONFIRMED", data: { status: false, charge_unconfirmed: true, unconfirmed_kind: "db_format" } }; // NAME-SANITIZE-1018B
const handle = declarations(checkout, ["handleResult"]); // NAME-SANITIZE-1018B
const appleStart = checkout.indexOf('if (raw.code === "MAYBE_PAID"', checkout.indexOf('console.error("[ApplePay] transaction failed"')); // NAME-SANITIZE-1018B
const appleChain = checkout.slice(appleStart, checkout.indexOf('else if (raw.code !== "DUP_CONFIRM"', appleStart)); // NAME-SANITIZE-1018B
const exercise = (source: string, raw: Record<string, unknown>) => { // NAME-SANITIZE-1018B
  const calls: Array<[string, ...unknown[]]> = []; // NAME-SANITIZE-1018B
  const scope: Record<string, unknown> = { raw, state: { phone: "2025550123", amount: 40 }, validation: { amount: 50 }, PAYLOCK_UNKNOWN_MS: 600000, lockKey: (phone: string, amount: number) => `${phone}:${amount}` }; // NAME-SANITIZE-1018B
  for (const name of ["setShowNotChargedNote", "setDeclineInfo", "setRefundCard", "setLoadReason", "setErrorMsg", "setUnconfirmedCard", "setLock", "showMaybePaid", "earlyPurchase", "setPurchasePending", "navigate"]) scope[name] = (...args: unknown[]) => calls.push([name, ...args]); // NAME-SANITIZE-1018B
  runInNewContext(compile(`${browserHelpers}\n${source}`), scope); return calls; // NAME-SANITIZE-1018B
}; // NAME-SANITIZE-1018B
describe("NAME-SANITIZE-1018B", () => { // NAME-SANITIZE-1018B
  it.each(["SQLSTATE[22007]: 1366 Incorrect string value", "SQLSTATE[22021] invalid encoding", "Incorrect string value"])("recognizes format error %s", (message) => { // NAME-SANITIZE-1018B
    expect(dbError({ message }, {})).toBe(true); // NAME-SANITIZE-1018B
    expect(dbError({ data: { error: message } }, {})).toBe(true); // NAME-SANITIZE-1018B
    expect(dbError({}, { error: message })).toBe(true); // NAME-SANITIZE-1018B
  }); // NAME-SANITIZE-1018B
  it.each(["SQLSTATE[23000] Integrity constraint", "Backend exception"])("does not classify %s as format", (message) => expect(dbError({ message }, {})).toBe(false)); // NAME-SANITIZE-1018B
  it.each(["SQLSTATE[22007]: 1366 Incorrect string value", "SQLSTATE[22021] invalid encoding"])("returns only the safe format marker for %s", (message) => { // NAME-SANITIZE-1018B
    expect(reply(message)).toEqual({ success: false, code: "CHARGE_UNCONFIRMED", error: "charge_unconfirmed", data: { status: false, message: "charge_unconfirmed", charge_unconfirmed: true, unconfirmed_kind: "db_format" }, pending_log_id: "order", risk_action: "step_up" }); // NAME-SANITIZE-1018B
    expect(JSON.stringify(reply(message))).not.toMatch(/SQLSTATE|Incorrect string value/i); // NAME-SANITIZE-1018B
  }); // NAME-SANITIZE-1018B
  it.each([["SQLSTATE[23000] Integrity constraint", 400, {}], ["SQLSTATE[22007] format", 504, {}], ["HTML", 400, { parseError: true }]])("preserves non-format unconfirmed reply %s", (message, status, extra) => { // NAME-SANITIZE-1018B
    expect(reply(message, status, extra)).toEqual({ success: false, code: "CHARGE_UNCONFIRMED", error: "charge_unconfirmed", data: { status: false, message: "charge_unconfirmed", charge_unconfirmed: true }, pending_log_id: "order", risk_action: "step_up" }); // NAME-SANITIZE-1018B
  }); // NAME-SANITIZE-1018B
  it("requires both an unconfirmed reply and the format marker", () => { // NAME-SANITIZE-1018B
    expect(dbUnconfirmed(formatReply)).toBe(true); // NAME-SANITIZE-1018B
    for (const raw of [{ code: "CHARGE_UNCONFIRMED", data: {} }, { code: "CHARGE_UNCONFIRMED", data: { unconfirmed_kind: "sqlstate" } }, { data: { unconfirmed_kind: "db_format" } }, {}]) expect(dbUnconfirmed(raw)).toBe(false); // NAME-SANITIZE-1018B
  }); // NAME-SANITIZE-1018B
  it.each([["handleResult", `${handle}\nhandleResult(raw);`], ["Apple Pay", appleChain]])("%s shows maybe-paid and locks without conversion or confirmation", (_name, source) => { // NAME-SANITIZE-1018B
    const calls = exercise(source, formatReply); // NAME-SANITIZE-1018B
    expect(calls).toEqual([["setShowNotChargedNote", false], ["setDeclineInfo", null], ["setRefundCard", false], ["setLoadReason", null], ["setErrorMsg", null], ["setUnconfirmedCard", false], ["setLock", "2025550123:50", "unknown", 600000], ["showMaybePaid", false]]); // NAME-SANITIZE-1018B
    const ordinary = exercise(source, { code: "CHARGE_UNCONFIRMED", data: { status: false, charge_unconfirmed: true } }); // NAME-SANITIZE-1018B
    expect(ordinary).toContainEqual(["setUnconfirmedCard", true]); // NAME-SANITIZE-1018B
    expect(ordinary.some(([name]) => ["showMaybePaid", "setLock", "earlyPurchase", "setPurchasePending", "navigate"].includes(name))).toBe(false); // NAME-SANITIZE-1018B
  }); // NAME-SANITIZE-1018B
}); // NAME-SANITIZE-1018B