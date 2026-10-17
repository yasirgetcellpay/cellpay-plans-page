// DECLINE-ONETAP-1017: source-text checks for one-tap wallet buttons in the card-decline dialog.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(__dirname, "../pages/Checkout.tsx"), "utf8");
const walletNow = src.slice(src.indexOf("const walletNow = (m: PaymentMethod) =>"), src.indexOf("const focusCard ="));

describe("DECLINE-ONETAP-1017", () => {
  it("walletNow exists and uses flushSync + placeOrderRef", () => {
    expect(walletNow.length).toBeGreaterThan(50);
    expect(src).toMatch(/import \{ flushSync \} from "react-dom"/);
    expect(walletNow).toMatch(/flushSync\(/);
    expect(walletNow).toMatch(/placeOrderRef\.current/);
  });
  it("fallback calls toMethod", () => {
    expect(walletNow).toMatch(/if \(!ready\) \{ toMethod\(m\); return; \}/);
  });
  it("placeOrderRef.current = handlePlaceOrder exists", () => {
    expect(src).toMatch(/placeOrderRef\.current = handlePlaceOrder;/);
  });
  it("the three wallet buttons call walletNow", () => {
    expect(src).toMatch(/data-testid="decline-applepay" onClick=\{\(\) => walletNow\("applepay"\)\}/);
    expect(src).toMatch(/data-testid="decline-googlepay" onClick=\{\(\) => walletNow\("googlepay"\)\}/);
    const prim = src.split('data-testid="decline-ab-primary-wallet"').slice(1);
    expect(prim.length).toBe(2);
    for (const p of prim) expect(p.slice(0, 200)).toMatch(/onClick=\{\(\) => walletNow\(primaryWallet\)\}/);
    expect(src).not.toMatch(/toMethod\("applepay"\)|toMethod\("googlepay"\)|toMethod\(primaryWallet\)/);
  });
  it("wallet handlers keep their sheet calls", () => {
    expect(src).toMatch(/new window\.ApplePaySession\(|new ApplePaySession\(/);
    expect(src).toMatch(/loadPaymentData\(/);
  });
});
