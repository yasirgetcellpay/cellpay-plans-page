// REFUND-RETRY-LATE-1018
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { refundedPanelText } from "@/lib/orderRefundState";
import { retryButtons, writeRetryCtx, readRetryCtx } from "@/lib/refundRetry";
const src = (p: string) => readFileSync(p, "utf8");
const oc = src("src/pages/OrderConfirmation.tsx"), btn = src("src/components/RefundRetryButtons.tsx");
const proxy = src("supabase/functions/cellpay-proxy/index.ts"), co = src("src/pages/Checkout.tsx"), fe = src("supabase/functions/funnel-event/index.ts");

describe("REFUND-RETRY-LATE-1018 receipt re-check", () => {
  it("polls every 20 s for 15 min, this-device only", () => {
    expect(oc).toMatch(/POLL = 20_000, POLL_MAX = 15 \* 60_000, FOCUS_MAX = 60 \* 60_000/);
    expect(oc).toMatch(/!thisDeviceRef\.current/);
    expect(oc).toMatch(/cp_purchase_early:\$\{hashid\}`\) !== null/);
    expect(oc).toMatch(/fetchRefundState\(hashid\); if \(rs && !stopped\)/);
  });
  it("refunded branch returns before beacon", () => {
    const i = oc.indexOf("keepRetryInfo((d.transaction"), j = oc.indexOf("log_purchase_fire");
    expect(i).toBeGreaterThan(0); expect(oc.slice(i, i + 200)).toMatch(/setRefunded\(rs\); return; \}/); expect(j).toBeGreaterThan(i);
  });
  it("dwell metric 4m/8m/15m", () => { expect(oc).toMatch(/\["4m", 4\], \["8m", 8\], \["15m", 15\]/); expect(oc).toMatch(/trackFunnel\("retry_late_alive"/); });
});

describe("refundedPanelText short", () => {
  it("drops last sentence EN/ES, default unchanged", () => {
    for (const lang of ["en", "es"]) for (const pw of [true, false]) {
      const full = refundedPanelText(lang, pw, 20).text, short = refundedPanelText(lang, pw, 20, true).text;
      expect(full).toMatch(/(try again|inténtelo de nuevo)\.$/);
      expect(short).not.toMatch(/Please check the number|Revise el número/);
      expect(full.startsWith(short)).toBe(true);
    }
  });
});

describe("RefundRetryButtons", () => {
  it("testids and late prefix", () => {
    expect(btn).toMatch(/data-testid=\{`retry-btn-\$\{key\}`\}/);
    expect(btn).toMatch(/retry_action: "late," \+ shown/);
    expect(btn).toMatch(/retry_action: "late," \+ b\.action/);
    expect(btn).toMatch(/`late\|\$\{hashid\}`/);
    expect(btn).not.toMatch(/submitTransaction|callProxy/);
  });
  it("labels per carrier", () => {
    expect(retryButtons("tmobile", "en", "")[0]).toMatchObject({ action: "to_carrier", to_carrier: "metropcs", label: "Pay as Metro by T-Mobile" });
    expect(retryButtons("s1", "es", "").map((b) => b.to_carrier ?? b.action)).toEqual(["straight-talk", "total-wireless", "tracfone", "net10", "number"]);
    expect(retryButtons("metropcs", "en", "").map((b) => b.action)).toEqual(["number", "to_carrier", "other_carrier"]);
  });
  it("stage late kept only when late", () => {
    writeRetryCtx({ cause: "boost_blank", action: "number", from_carrier: "boost", to_carrier: "boost", stage: "late" });
    expect(readRetryCtx()?.stage).toBe("late");
    writeRetryCtx({ cause: "boost_blank", action: "number", from_carrier: "boost", to_carrier: "boost", stage: "x" as unknown as "late" });
    expect(readRetryCtx()?.stage).toBeUndefined();
  });
});

describe("proxy retry cap", () => {
  const gate = proxy.indexOf("rpc/refund_retry_gate"), dup = proxy.indexOf("// [DUPCHARGE-1008] Every payment method");
  it("before DUPCHARGE, fails open, codes", () => {
    expect(gate).toBeGreaterThan(0); expect(gate).toBeLessThan(dup);
    const blk = proxy.slice(gate - 600, dup);
    expect(blk).toMatch(/AbortSignal\.timeout\(1000\)/);
    expect(blk).toMatch(/catch \{ gate = null; \/\* refund retry gate fails open \*\/ \}/);
    expect(blk).toMatch(/code: "RETRY_CAP"/); expect(blk).toMatch(/code: "RETRY_WAIT"/);
    expect(blk).not.toMatch(/callCellPay|API_BASE|cellpay\.us\/api/);
  });
  it("retryMetaFrom allow-lists late only", () => {
    expect(proxy).toMatch(/r\.retry_src === "refund_retry" && r\.retry_stage === "late"\) out\.retry_stage = "late"/);
  });
  it("copy has no forbidden words", () => {
    const blk = proxy.slice(gate, dup);
    for (const w of [/cualquier/i, /declin/i, /rechaz/i, /refill|recarga/i, /T-Mobile|Simple Mobile|Boost|Metro/]) expect(blk).not.toMatch(w);
  });
});

describe("checkout + funnel-event", () => {
  it("checkout handles cap/wait without decline", () => {
    expect(co.match(/raw\.code === "RETRY_CAP" \|\| raw\.code === "RETRY_WAIT"/g)?.length).toBe(2);
    expect(co).toMatch(/rr\.stage === "late" \? "late," : ""/);
  });
  it("funnel-event accepts retry_late_alive with 4m", () => {
    expect(fe).toMatch(/"retry_late_alive"\]\); \/\/ REFUND-RETRY-1018/);
    expect(/^[a-z0-9_,]{1,80}$/.test("4m")).toBe(true);
    expect(fe).toMatch(/\/\^\[a-z0-9_,\]\{1,80\}\$\//);
  });
});
