import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"; // SMS-34332-1020
import { readFileSync } from "node:fs"; // SMS-34332-1020
import ts from "typescript"; // SMS-34332-1020
import React, { act, useState } from "react"; // SMS-34332-1020
import { createRoot, type Root } from "react-dom/client"; // SMS-34332-1020
const source = readFileSync("src/pages/Checkout.tsx", "utf8"); // SMS-34332-1020
const compile = (code: string, scope: Record<string, unknown>) => new Function(...Object.keys(scope), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText)(...Object.values(scope)); // SMS-34332-1020
let root: Root | undefined; // SMS-34332-1020
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); vi.resetModules(); }); // SMS-34332-1020
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); }); // SMS-34332-1020
describe("SMS-34332-1020 consent", () => { // SMS-34332-1020
  it("starts unchecked and changes only through explicit checkbox input", () => { // SMS-34332-1020
    const start = source.indexOf('            <label className="flex items-start gap-2 mt-3 cursor-pointer" data-sms-optin="1020">'); // SMS-34332-1020
    const label = source.slice(start, source.indexOf("</label>", start) + "</label>".length); // SMS-34332-1020
    const state = source.split("\n").filter((line) => line.includes("const [smsOptIn,") || line.includes("const smsOptInRef =")).join("\n"); // SMS-34332-1020
    const ref = { current: false }; // SMS-34332-1020
    const Form = compile(`return function Form() { ${state} return (${label}); };`, { React, useState, useRef: () => ref, lang: "en" }) as React.ComponentType; // SMS-34332-1020
    const host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); act(() => root?.render(<Form />)); // SMS-34332-1020
    const input = host.querySelector<HTMLInputElement>('[data-testid="sms-optin"]'); if (!input) throw new Error("Missing checkbox"); // SMS-34332-1020
    expect(input.checked).toBe(false); expect(ref.current).toBe(false); expect(input.required).toBe(false); expect(input.disabled).toBe(false); // SMS-34332-1020
    act(() => input.click()); expect(input.checked).toBe(true); expect(ref.current).toBe(true); // SMS-34332-1020
    act(() => input.click()); expect(input.checked).toBe(false); expect(ref.current).toBe(false); // SMS-34332-1020
  }); // SMS-34332-1020
  it.each([false, true])("logs explicit consent %s with only the three allowed fields", async (optIn) => { // SMS-34332-1020
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", fetch); // SMS-34332-1020
    const { sendTracked } = await import("@/lib/trackQueue"); // SMS-34332-1020
    sendTracked("record_sms_opt_in", { p_hashid: "SMSORDER1020", p_opt_in: optIn, p_lang: "es", phone: "discard", email: "discard", p_browser_language: "discard" }); // SMS-34332-1020
    expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toMatch(/\/rpc\/record_sms_opt_in$/); // SMS-34332-1020
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ p_hashid: "SMSORDER1020", p_opt_in: optIn, p_lang: "es" }); // SMS-34332-1020
  }); // SMS-34332-1020
  it("rejects invalid order IDs and fails open if logging throws", () => { // SMS-34332-1020
    const line = source.split("\n").find((line) => line.startsWith("const recordSmsOptIn =")); if (!line) throw new Error("Missing consent helper"); // SMS-34332-1020
    const sendTracked = vi.fn(); const record = compile(`${line}\nreturn recordSmsOptIn;`, { sendTracked }) as (id: string, opt: boolean, lang?: string) => void; // SMS-34332-1020
    record("bad id", true, "es"); expect(sendTracked).not.toHaveBeenCalled(); // SMS-34332-1020
    record("ORDER1020", false); expect(sendTracked).toHaveBeenLastCalledWith("record_sms_opt_in", { p_hashid: "ORDER1020", p_opt_in: false, p_lang: "en" }); // SMS-34332-1020
    sendTracked.mockImplementation(() => { throw new Error("offline"); }); expect(() => record("ORDER1020", true, "es")).not.toThrow(); // SMS-34332-1020
  }); // SMS-34332-1020
}); // SMS-34332-1020