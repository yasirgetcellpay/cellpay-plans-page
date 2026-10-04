// CK-0: resume /checkout when the router hand-off state is missing (direct load, new tab, shared link, app switch).
// Only the carrier page's hand-off INPUTS are kept (phone, amount, plan id, carrier). No fee, tax or total is ever stored or
// computed here: Checkout re-runs validateRecharge and the server recalculates (Yasir lock 2).
import { fetchCarrierView, verifyPhone } from "@/services/apiWrapper";
import type { Language } from "@/lib/i18n";

export interface CheckoutHandoff {
  phone: string;
  amount: string;
  planId?: string | number;
  carrierSlug: string;
  carrierName: string;
  brandColor: string;
}

const CTX_KEY = "cp_checkout_ctx_v1"; // this tab only (sessionStorage)
const PREFILL_KEY = "cp_checkout_prefill_v1"; // one-shot phone hand-back to the carrier page (keeps the number out of the URL)
const CTX_TTL_MS = 30 * 60 * 1000;
const PREFILL_TTL_MS = 10 * 60 * 1000;

// Carrier API slug -> carrier page (EN path), name and colour. Dynamic entries mirror App.tsx carrierRoutes; the static pages'
// hand-off slugs (Straight Talk, US Cellular, AT&T FirstNet) only get a page to send the customer back to.
const CARRIERS: Record<string, { path: string; name: string; color: string; dynamic?: true }> = {
  s1: { path: "/s1.html", name: "Simple Mobile", color: "hsl(101,67%,44%)", dynamic: true },
  "topup-crc": { path: "/topup-crc.html", name: "Cricket Wireless", color: "hsl(82,60%,42%)", dynamic: true },
  metropcs: { path: "/metropcs.html", name: "Metro PCS", color: "hsl(270,60%,32%)", dynamic: true },
  tmobile: { path: "/tmobile-flexi.html", name: "T-Mobile", color: "hsl(330,100%,45%)", dynamic: true },
  "topup-at": { path: "/topup-at.html", name: "AT&T Prepaid", color: "hsl(196,100%,44%)", dynamic: true },
  verizon: { path: "/verizon", name: "Verizon Wireless Prepaid", color: "hsl(0,100%,45%)", dynamic: true },
  boost: { path: "/boost.html", name: "Boost Mobile", color: "hsl(27,100%,50%)", dynamic: true },
  h2o: { path: "/h2o.html", name: "H2O Wireless", color: "hsl(195,85%,50%)", dynamic: true },
  lyca: { path: "/lyca.html", name: "Lyca Mobile", color: "hsl(220,50%,22%)", dynamic: true },
  net10: { path: "/net10.html", name: "Net10 Wireless", color: "hsl(195,100%,50%)", dynamic: true },
  pageplus: { path: "/pageplus.html", name: "Page Plus", color: "hsl(0,70%,50%)", dynamic: true },
  tracfone: { path: "/tracfone.html", name: "TracFone", color: "hsl(230,70%,30%)", dynamic: true },
  "ultra-mobile": { path: "/ultra-mobile.html", name: "Ultra Mobile", color: "hsl(270,50%,40%)", dynamic: true },
  pageplusadd: { path: "/pageplus-addon", name: "Page Plus Addon Balance", color: "hsl(0,70%,50%)", dynamic: true },
  "total-wireless": { path: "/total-wireless", name: "Total Wireless", color: "hsl(200,70%,40%)", dynamic: true },
  "straight-talk": { path: "/straight-talk.html", name: "Straight Talk", color: "" },
  uscellular: { path: "/us-cellular.html", name: "US Cellular", color: "" },
  att: { path: "/att-firstnet", name: "AT&T Prepaid", color: "" },
};
// Friendly names in a ?carrier= link (same aliases as App.tsx SLUG_ALIASES, mapped to API slugs).
const URL_ALIASES: Record<string, string> = {
  cricket: "topup-crc", att: "topup-at", "at-t": "topup-at", "simple-mobile": "s1", simple: "s1", metro: "metropcs",
  "metro-pcs": "metropcs", "t-mobile": "tmobile", "tmobile-flexi": "tmobile", "pageplus-addon": "pageplusadd",
};
const RESUME_PARAMS = ["carrier", "carrierSlug", "slug", "plan", "plan_id", "planId", "amount", "phone", "phone_number"];

const digits10 = (input: string): string => {
  let d = (input || "").replace(/\D/g, "");
  while (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 && !/^[01]/.test(d) ? d : "";
};
const formatPhone10 = (d: string): string => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
const langPrefix = (lang: Language) => (lang === "es" ? "/es" : "");

/** Cash App (Pockyt) return params on /checkout -> the existing status page, query + hash kept. */
export function cashAppReturnTarget(pathname: string, search: string, hash: string): string | null {
  const q = new URLSearchParams(search);
  if (!q.get("pockyt_session_id") && !q.get("session_id")) return null;
  return `${pathname.startsWith("/es/") ? "/es" : ""}/checkout/cashapp-return${search}${hash}`;
}

/** Query string without the resume params (phone never travels on in a URL); gclid, utm_* etc. kept. */
export function stripResumeParams(search: string, amount?: string): string {
  const q = new URLSearchParams(search);
  RESUME_PARAMS.forEach((k) => q.delete(k));
  if (amount) q.set("amount", amount);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function readRaw(): (CheckoutHandoff & { ts: number }) | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CTX_KEY) || "null");
    if (!v || v.v !== 1 || typeof v.ts !== "number") return null;
    if (!digits10(String(v.phone || "")) || !(Number(v.amount) > 0)) return null;
    if (typeof v.carrierSlug !== "string" || !v.carrierSlug || typeof v.carrierName !== "string") return null;
    return {
      ts: v.ts, phone: String(v.phone), amount: String(v.amount), planId: v.planId ?? undefined,
      carrierSlug: v.carrierSlug, carrierName: v.carrierName, brandColor: typeof v.brandColor === "string" ? v.brandColor : "",
    };
  } catch {
    return null;
  }
}

/** This tab's saved hand-off, if younger than 30 minutes. A link carrying its own ?carrier / ?phone wins over it. */
export function readCheckoutCtx(search = ""): CheckoutHandoff | null {
  const q = new URLSearchParams(search);
  if (["carrier", "carrierSlug", "slug", "phone", "phone_number"].some((k) => q.has(k))) return null;
  // A Cash App hand-off started in this tab: never reopen the payment form by itself (the customer may have paid).
  try { if (sessionStorage.getItem("cashapp_return_ctx")) return null; } catch { return null; }
  const v = readRaw();
  if (!v || Date.now() - v.ts > CTX_TTL_MS || v.ts > Date.now() + 60000) return null;
  const { ts: _ts, ...s } = v;
  return s;
}

export function writeCheckoutCtx(s: CheckoutHandoff): void {
  try {
    sessionStorage.setItem(CTX_KEY, JSON.stringify({
      v: 1, ts: Date.now(), phone: s.phone, amount: String(s.amount), planId: s.planId ?? null,
      carrierSlug: s.carrierSlug, carrierName: s.carrierName, brandColor: s.brandColor,
    }));
  } catch { /* storage unavailable: no resume */ }
}

export function clearCheckoutCtx(): void {
  try { sessionStorage.removeItem(CTX_KEY); } catch { /* ignore */ }
}

/** Carrier page for a slug (EN/ES), with ?amount= (the page already prefills it) and the phone handed back via sessionStorage.
 *  Unknown carrier -> home. Query (gclid, utm_*) and hash kept. */
export function carrierPageTarget(lang: Language, slug: string | null, phone: string, amount: string | number | undefined, search: string, hash: string): string {
  const c = slug ? CARRIERS[slug] : undefined;
  if (!c) return `${langPrefix(lang) || "/"}${stripResumeParams(search)}${hash}`;
  const d = digits10(phone);
  if (d) {
    try { sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ slug, phone: d, ts: Date.now() })); } catch { /* ignore */ }
  }
  const n = Number(amount);
  return `${langPrefix(lang)}${c.path}${stripResumeParams(search, n > 0 ? String(n) : undefined)}${hash}`;
}

/** Carrier page: phone number handed back by Checkout for this carrier (read once, then removed). */
export function takeCheckoutPrefill(slug: string): string {
  try {
    const v = JSON.parse(sessionStorage.getItem(PREFILL_KEY) || "null");
    if (!v) return "";
    sessionStorage.removeItem(PREFILL_KEY);
    return v.slug === slug && Date.now() - Number(v.ts) < PREFILL_TTL_MS ? digits10(String(v.phone || "")) : "";
  } catch {
    return "";
  }
}

function slugFromParam(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/^\/+/, "").replace(/^es\//, "").replace(/\.html$/, "");
  if (CARRIERS[s]) return s;
  if (URL_ALIASES[s]) return URL_ALIASES[s];
  const byPath = Object.keys(CARRIERS).find((k) => CARRIERS[k].path.replace(/^\//, "").replace(/\.html$/, "") === s);
  return byPath || null;
}

type Plan = { id: string; amount: number };
const toPlans = (arr: Array<Record<string, unknown>>): Plan[] =>
  arr.map((p) => ({ id: String(p.plan_id || p.planId || p.id || p.ID || ""), amount: Number(p.amount || p.price || p.Amount || 0) }));

/** Rebuild the hand-off from ?carrier&plan|amount&phone with the carrier page's own data (carriers/view + verify-phone, the
 *  same calls PAY NOW makes, same plan rules as DynamicCarrier). Otherwise: carrier page prefilled, or home. */
export async function resolveCheckoutFromUrl(lang: Language, search: string, hash: string): Promise<{ state?: CheckoutHandoff; to: string }> {
  const q = new URLSearchParams(search);
  let slug = slugFromParam(q.get("carrier") || q.get("carrierSlug") || q.get("slug"));
  let phone = digits10(q.get("phone") || q.get("phone_number") || "");
  const planRaw = (q.get("plan") || q.get("plan_id") || q.get("planId") || "").trim();
  const amtRaw = (q.get("amount") || "").trim();
  const nRaw = Number(amtRaw || planRaw);
  let amount: number | undefined = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : undefined;
  if (!slug) {
    // Expired hand-off in this tab: send the customer back to that carrier, number and amount filled in.
    const old = readRaw();
    if (old && Date.now() - old.ts < 24 * 60 * 60 * 1000) {
      slug = old.carrierSlug; phone = digits10(old.phone); amount = Number(old.amount) || undefined;
    }
    clearCheckoutCtx();
    return { to: carrierPageTarget(lang, slug, phone, amount, search, hash) };
  }
  const fromSlug = slug;
  const back = () => ({ to: carrierPageTarget(lang, fromSlug, phone, amount, search, hash) });
  const c = CARRIERS[slug];
  if (!c.dynamic || !phone || (!planRaw && !amtRaw)) return back();
  try {
    const data = await fetchCarrierView(slug);
    const cp = data.carrier_plans as unknown;
    const cpObj = cp && !Array.isArray(cp) ? (cp as Record<string, unknown>) : null;
    const fp = ((data as Record<string, unknown>).fixed_plans ?? cpObj?.fixed_plans) as unknown;
    const fpObj = fp && !Array.isArray(fp) ? (fp as Record<string, unknown>) : null;
    const isRange = (v: unknown) => v === true || (typeof v === "string" && v !== "");
    const cpRange = !!cpObj && isRange(cpObj.rangePlan);
    const fpRange = (Array.isArray(fp) && fp.length > 0) || (!!fpObj && isRange(fpObj.rangePlan));
    let plans: Plan[] = [];
    if (fpRange && fpObj && Array.isArray(fpObj.plans) && fpObj.plans.length > 0) plans = toPlans(fpObj.plans);
    else if (Array.isArray(fp) && fp.length > 0) plans = toPlans(fp);
    else if (cp && !cpRange) {
      if (Array.isArray(cp)) plans = toPlans(cp);
      else if (cpObj && Array.isArray(cpObj.plans) && cpObj.plans.length > 0) plans = toPlans(cpObj.plans as Array<Record<string, unknown>>);
    }
    const carrierInfo = (cpObj?.carrier ?? {}) as Record<string, unknown>;
    const rangePlanId = cpObj && typeof cpObj.rangePlan === "string" && cpObj.rangePlan !== ""
      ? cpObj.rangePlan : carrierInfo.rangePlan ? String(carrierInfo.rangePlan) : "";
    const min = Number(carrierInfo.rangeMin ?? 5), max = Number(carrierInfo.rangeMax ?? 300);
    const picked = (planRaw && plans.find((p) => p.id !== "" && p.id === planRaw)) || (amount !== undefined ? plans.find((p) => p.amount === amount) : undefined);
    let planId: string | undefined;
    if (picked && picked.amount > 0) {
      amount = picked.amount;
      planId = picked.id || (cpRange ? rangePlanId : "") || undefined;
    } else if (cpRange && amount !== undefined && Number.isInteger(amount) && amount >= min && amount <= max) {
      planId = rangePlanId || undefined;
    } else {
      return back();
    }
    const verify = await verifyPhone(slug, phone);
    if (!verify.success) return back();
    return {
      to: "",
      state: {
        phone: formatPhone10(phone), amount: String(amount), planId, carrierSlug: slug,
        carrierName: (data.carrier?.name as string) || c.name, brandColor: c.color,
      },
    };
  } catch {
    return back();
  }
}
