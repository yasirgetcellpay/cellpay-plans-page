// KLARNA-FORM-1018
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetFunnel, trackFunnel, type KlarnaFunnelEvent } from "@/lib/funnelEvents";
import { KLARNA_MIN_TOTAL } from "@/lib/declineRecovery";

const page = readFileSync("src/pages/Checkout.tsx", "utf8");
const edge = readFileSync("supabase/functions/funnel-event/index.ts", "utf8");
const compile = (code: string) => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const beacon = vi.fn((..._args: unknown[]) => true);
beforeEach(() => {
  resetFunnel(); beacon.mockClear();
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
});

describe("KLARNA-FORM-1018", () => {
  it("accepts the typed event and sends it once per onceKey", async () => {
    const event: KlarnaFunnelEvent = "klarna_form_started";
    trackFunnel(event, {}, "form|0"); trackFunnel(event, {}, "form|0");
    expect(beacon).toHaveBeenCalledTimes(1);
    const blob = beacon.mock.calls[0]?.[1] as Blob;
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob);
    });
    expect(JSON.parse(text).event).toBe("klarna_form_started");
    trackFunnel(event, {}, "form|1"); expect(beacon).toHaveBeenCalledTimes(2);
    const clean = runInNewContext(compile(edge.slice(0, edge.indexOf("Deno.serve("))) + "; clean;");
    expect(clean({ event }, null)).toMatchObject({ event });
  });

  it("prefills only an empty Klarna phone and never emits focus analytics", () => {
    const line = page.split("\n").find(line => line.includes('useEffect(() => { if (paymentMethod === "klarna" && !klarnaPhone.trim()'));
    if (!line) throw new Error("Missing phone effect");
    const setKlarnaPhone = vi.fn();
    const run = (paymentMethod: string, klarnaPhone: string, phone?: string) => runInNewContext(compile(line), {
      paymentMethod, klarnaPhone, state: { phone }, setKlarnaPhone, useEffect: (callback: () => void) => callback(),
    });
    run("klarna", "   ", "2025550100");
    expect(setKlarnaPhone).toHaveBeenCalledExactlyOnceWith("2025550100");
    setKlarnaPhone.mockClear();
    run("klarna", "2025550199", "2025550100"); run("card", "", "2025550100"); run("klarna", "");
    expect(setKlarnaPhone).not.toHaveBeenCalled(); expect(beacon).not.toHaveBeenCalled();
  });

  it("focus capture dedupes and swallows logging failures", () => {
    const match = page.match(/onFocusCapture=\{(\(\) => \{ try \{ trackKlarna\("klarna_form_started"[^\n]+)\} \/\/ KLARNA-FORM-1018/);
    if (!match) throw new Error("Missing focus handler");
    const context = { readKlarnaSrc: () => "method_list", phone10: "2025550100", declineSeqRef: { current: 0 }, trackKlarna: (event: KlarnaFunnelEvent, _screen: string, key: string) => trackFunnel(event, {}, key) };
    const focus = runInNewContext(compile("const focus = " + match[1] + ";") + "; focus;", context);
    expect(beacon).not.toHaveBeenCalled(); focus(); focus(); expect(beacon).toHaveBeenCalledTimes(1);
    context.trackKlarna = () => { throw new Error("Unavailable"); };
    expect(() => focus()).not.toThrow();
  });

  it("keeps the minimum total exactly 25", () => { expect(KLARNA_MIN_TOTAL).toBe(25); });

  it.each([
    ["Failed to load Klarna SDK", "No pudimos cargar Klarna. Intente de nuevo o use otro método de pago."],
    ["Could not create Klarna session", "No pudimos iniciar Klarna. Intente de nuevo o use otro método de pago."],
    ["Klarna SDK not available", "No pudimos cargar Klarna. Intente de nuevo o use otro método de pago."],
    ["Klarna payment failed", "El pago con Klarna no se completó. Intente de nuevo o use otro método de pago."],
    ["Klarna authorization was declined or cancelled", "Klarna no aprobó el pago o usted lo canceló. Puede intentar de nuevo o usar otro método de pago."],
    ["Klarna: first name is required.", "Klarna: escriba su nombre."],
    ["Klarna: last name is required.", "Klarna: escriba su apellido."],
    ["Klarna: valid phone is required.", "Klarna: escriba un número de teléfono válido de 10 dígitos."],
    ["Klarna: street address is required.", "Klarna: escriba su dirección."],
    ["Klarna: city is required.", "Klarna: escriba su ciudad."],
    ["Klarna: state is required.", "Klarna: escriba su estado."],
    ["Klarna: country is required.", "Klarna: escriba su país."],
    ["Klarna: ZIP is required.", "Klarna: escriba su código postal de 5 dígitos."],
  ])("preserves English and formal Spanish: %s", (english, spanish) => {
    expect(page).toContain(`lang === "es" ? "${spanish}" : "${english}"`);
    expect(spanish).not.toMatch(/\btú\b|\btu |\bpuedes\b|\bintenta /i);
  });
});