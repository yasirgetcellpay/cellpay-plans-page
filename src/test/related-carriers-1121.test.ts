// RELATED-CARRIERS-INLINKS-1121
import { describe, it, expect } from "vitest";
import { BILL_PAGES, billStaticBlock, billPageByPath } from "@/content/billCarrierSeo";
import { howToPayByPath, htpOtherAmounts, htpOtherAmountsTitle, howToPayStaticHtml } from "@/content/howToPay";

const block = (p: string) => { const pg = billPageByPath(p); if (!pg) throw new Error(p); const s = billStaticBlock(pg); const i = s.indexOf("<h2 class=\"text-lg font-bold"); return i < 0 ? "" : s.slice(i, s.indexOf("</ul>", i) + 5); };
const hrefs = (s: string) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe("RELATED-CARRIERS-INLINKS-1121 carrier ring", () => {
  it("h2o links lyca, net10, pageplus", () => expect(hrefs(block("/h2o.html"))).toEqual(["/lyca.html", "/net10.html", "/pageplus.html"]));
  it("verizon adds Verizon Wireless", () => expect(hrefs(block("/verizon"))).toEqual(["/h2o.html", "/lyca.html", "/net10.html", "/verizon-wireless-flexi.html"]));
  it("ES twin uses ES paths and usted anchors", () => { const b = block("/es/tracfone.html"); expect(hrefs(b)).toEqual(["/es/ultra-mobile.html", "/es/verizon", "/es/h2o.html"]); expect(b).toContain("Otros operadores"); expect(b).toContain("Pague su factura de Ultra Mobile"); });
  it("14 source pages, every target gains 3", () => { const all = BILL_PAGES.filter((p) => p.related); expect(all.length).toBe(14); const c: Record<string, number> = {}; all.forEach((p) => p.related!.links.forEach(([h]) => { c[h] = (c[h] ?? 0) + 1; })); for (const t of ["/h2o.html", "/lyca.html", "/net10.html", "/pageplus.html", "/tracfone.html", "/ultra-mobile.html", "/verizon"]) { expect(c[t]).toBe(3); expect(c["/es" + t]).toBe(3); } });
  it("no battleground/excluded page gets a block or is linked", () => { for (const p of ["/metropcs.html", "/boost.html", "/s1.html", "/topup-crc.html", "/topup-at.html", "/tmobile-flexi.html", "/total-wireless.html", "/straight-talk.html"]) { expect(billPageByPath(p)?.related).toBeUndefined(); } const all = BILL_PAGES.flatMap((p) => p.related?.links ?? []).map(([h]) => h); expect(all.some((h) => /metropcs|boost|s1\.html|topup-|tmobile|total-wireless|straight-talk|\/go\/|^https?:|\/$|\?|espanol|carriers\//.test(h))).toBe(false); });
  it("copy lint: no Refill/recarga, block before guide/more links", () => { for (const p of BILL_PAGES.filter((x) => x.related)) { const b = block(p.path); expect(/refill|recarga|\$/i.test(b)).toBe(false); const s = billStaticBlock(p); if (p.more) expect(s.indexOf("text-lg font-bold")).toBeLessThan(s.indexOf(p.more[0][0] + "\"")); } });
});

describe("RELATED-CARRIERS-INLINKS-1121 cricket amounts", () => {
  it("EN cricket/45 -> 25, 50 with spec anchors + title", () => { const pg = howToPayByPath("/how-to-pay/cricket/45")!; expect(htpOtherAmounts(pg)).toEqual([["/how-to-pay/cricket/25", "Cricket $25 payment"], ["/how-to-pay/cricket/50", "Cricket $50 payment"]]); expect(htpOtherAmountsTitle(pg)).toBe("Other Cricket amounts"); expect(howToPayStaticHtml(pg)).toContain("Other Cricket amounts"); });
  it("ES cricket/25 -> 45, 50", () => { const pg = howToPayByPath("/es/como-pagar/cricket/25")!; expect(htpOtherAmounts(pg)).toEqual([["/es/como-pagar/cricket/45", "Pago de Cricket de $45"], ["/es/como-pagar/cricket/50", "Pago de Cricket de $50"]]); expect(htpOtherAmountsTitle(pg)).toBe("Otros montos de Cricket"); });
  it("other carriers unchanged", () => { const pg = howToPayByPath("/how-to-pay/boost-mobile/45")!; expect(htpOtherAmountsTitle(pg)).toBe("Other amounts"); expect(htpOtherAmounts(pg).length).toBe(2); const parent = howToPayByPath("/how-to-pay/cricket")!; expect(htpOtherAmounts(parent)).toEqual([]); });
});
