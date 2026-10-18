import { act, createElement, StrictMode, type ReactNode } from "react"; // ST-PREFILL-1018
import { createRoot, type Root } from "react-dom/client"; // ST-PREFILL-1018
import { afterEach, beforeEach, expect, it, vi } from "vitest"; // ST-PREFILL-1018
import { useEmailPrefill } from "@/hooks/useEmailPrefill"; // ST-PREFILL-1018
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), track: vi.fn() })); // ST-PREFILL-1018
vi.mock("@/lib/checkoutResume", () => ({ resolveEmailPrefill: mocks.resolve })); // ST-PREFILL-1018
vi.mock("@/lib/funnelEvents", () => ({ trackFunnel: mocks.track })); // ST-PREFILL-1018
const token = "12345678-1234-4234-8234-123456789abc"; // ST-PREFILL-1018
const roots: { root: Root; container: HTMLElement }[] = []; // ST-PREFILL-1018
function cleanup() { for (const { root, container } of roots.splice(0)) { act(() => root.unmount()); container.remove(); } } // ST-PREFILL-1018
function renderHook<P>(hook: (props: P) => void, options?: { initialProps: P; wrapper?: (props: { children: ReactNode }) => ReactNode }) { // ST-PREFILL-1018
  const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); roots.push({ root, container }); // ST-PREFILL-1018
  const Component = ({ value }: { value: P }) => { hook(value); return null; }; // ST-PREFILL-1018
  const rerender = (value: P) => act(() => { const child = createElement(Component, { value }); root.render(options?.wrapper ? options.wrapper({ children: child }) : child); }); // ST-PREFILL-1018
  rerender(options?.initialProps as P); return { rerender }; // ST-PREFILL-1018
} // ST-PREFILL-1018
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); window.history.replaceState({}, "", `/straight-talk.html?t=${token}&ap=1&keep=yes#plans`); }); // ST-PREFILL-1018
afterEach(() => { cleanup(); }); // ST-PREFILL-1018
it("waits until ready, resolves once under StrictMode, and uses the latest callback", async () => { // ST-PREFILL-1018
  let finish: ((r: { phone: string; amount: number | null }) => void) | undefined; // ST-PREFILL-1018
  mocks.resolve.mockImplementation(() => new Promise((resolve) => { finish = resolve; })); // ST-PREFILL-1018
  const first = vi.fn(), latest = vi.fn(); // ST-PREFILL-1018
  const hook = renderHook(({ ready, callback }) => useEmailPrefill("straight-talk", ready, callback), { initialProps: { ready: false, callback: first }, wrapper: ({ children }) => createElement(StrictMode, null, children) }); // ST-PREFILL-1018
  expect(mocks.resolve).not.toHaveBeenCalled(); // ST-PREFILL-1018
  hook.rerender({ ready: true, callback: first }); hook.rerender({ ready: true, callback: latest }); // ST-PREFILL-1018
  expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith("straight-talk", `?t=${token}&ap=1&keep=yes`); // ST-PREFILL-1018
  expect(JSON.parse(sessionStorage.getItem("cp_email_ap") || "null")).toMatchObject({ slug: "straight-talk", ts: expect.any(Number) }); // ST-PREFILL-1018
  await act(async () => { if (!finish) throw new Error("Resolution did not start"); finish({ phone: "3125551234", amount: 45 }); }); // ST-PREFILL-1018
  expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledExactlyOnceWith({ phone: "3125551234", amount: 45 }); // ST-PREFILL-1018
  expect(mocks.track).toHaveBeenCalledExactlyOnceWith("prefill_used", { carrier: "straight-talk", amount: 45, fee: null, total: null }); // ST-PREFILL-1018
  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/straight-talk.html?keep=yes#plans"); // ST-PREFILL-1018
  hook.rerender({ ready: false, callback: latest }); hook.rerender({ ready: true, callback: latest }); expect(mocks.resolve).toHaveBeenCalledTimes(1); // ST-PREFILL-1018
}); // ST-PREFILL-1018
it.each(["1", "0"])("cleans tokenless ap=%s without resolving and only opts in for 1", (ap) => { // ST-PREFILL-1018
  window.history.replaceState({}, "", `/es/straight-talk.html?ap=${ap}&keep=yes#plans`); // ST-PREFILL-1018
  renderHook(() => useEmailPrefill("straight-talk", true, vi.fn())); // ST-PREFILL-1018
  expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.track).not.toHaveBeenCalled(); // ST-PREFILL-1018
  expect(sessionStorage.getItem("cp_email_ap") !== null).toBe(ap === "1"); // ST-PREFILL-1018
  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/es/straight-talk.html?keep=yes#plans"); // ST-PREFILL-1018
}); // ST-PREFILL-1018
it.each(["null", "reject", "callback"])("cleans the address and swallows %s failures", async (failure) => { // ST-PREFILL-1018
  if (failure === "reject") mocks.resolve.mockRejectedValue(new Error("Unavailable")); else mocks.resolve.mockResolvedValue(failure === "null" ? null : { phone: "3125551234", amount: null }); // ST-PREFILL-1018
  const callback = vi.fn(() => { if (failure === "callback") throw new Error("Callback failed"); }); // ST-PREFILL-1018
  await act(async () => { renderHook(() => useEmailPrefill("straight-talk", true, callback)); }); // ST-PREFILL-1018
  expect(window.location.search + window.location.hash).toBe("?keep=yes#plans"); expect(mocks.track).not.toHaveBeenCalled(); // ST-PREFILL-1018
}); // ST-PREFILL-1018