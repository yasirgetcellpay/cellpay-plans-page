import { tmoCapMax, tmoCapBlocked, tmoCapMsg } from "@/lib/tmoCap"; // TMO-CAP-200-1022
import { CarrierFooter } from "@/components/CarrierFooter";
import { BackButton } from "@/components/BackButton";
import { AccountDropdown } from "@/components/AccountDropdown";
import { useState, useCallback, useEffect, useRef } from "react"; // VZ-PREPAID-GUARD-1017
import { Phone, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"; // VZ-PREPAID-GUARD-1017
import { PaymentBar } from "@/components/PaymentBar";
// PAYCOPY-1008: shared payment list (same text as the vite.config.ts carrier first screen)
import { weAcceptLine } from "@/content/paymentMethods";
// TOP4-T1-1009: first screen in the searcher's words + customer-facing carrier names (display only)
import { top4Hero, displayCarrierName, trademarkCarrierName, activeLineNote, refundFaq, top4Name, esCarrierFaqs, searchFaqs, usCellularNote } from "@/content/carrierHero"; // BATCH3-1014
import { PlanGrid } from "@/components/PlanGrid";
import { ultraPlanLabel } from "@/content/ultraPlanLabel"; // ULTRA-MSG-1024
import { useUltraSmart } from "@/hooks/useUltraSmart"; // ULTRA-SMART-PREVENT-1024
import { useTmoLastPlan } from "@/hooks/useTmoLastPlan"; // REFILL-PREVENT-TMO-1026
import { TmoLastPlanNotice } from "@/components/TmoLastPlanNotice"; // REFILL-PREVENT-TMO-1026
import { tmoText, tmoEvent } from "@/lib/tmoLastPlan"; // REFILL-PREVENT-TMO-1026
import { TMO_RETRY_BLOCK_ALWAYS } from "@/lib/refillPreventFlags"; // REFILL-PREVENT-TMO-1026
import { ultraHealthText } from "@/lib/ultraSmart"; // ULTRA-SMART-PREVENT-1024
import { UltraSmartNotice } from "@/components/UltraSmartNotice"; // ULTRA-SMART-PREVENT-1024
import { RP_P1_FORMAT, RP_P2_RETRY_BLOCK, RP_P2_GUIDANCE, RP_P4_DEAD_AMOUNTS } from "@/lib/refillPreventFlags"; // REFILL-PREVENT-1024
import { RP_P2c_DISC_24H } from "@/lib/refillPreventFlags"; // LYCA-SKU-FIX-1024
import { checkDiscBlock, discBlockText } from "@/lib/refillPrevent"; // LYCA-SKU-FIX-1024
import { rpVariant, rpEvent, phoneFormatBad, formatErrorText, confirmLabel, checkRetryBlock, retryBlockText, withTimeout, guidanceText, fetchDeadAmounts, isDeadAmount, deadLabel, type DeadAmount } from "@/lib/refillPrevent"; // REFILL-PREVENT-1024
// SIMPLE-SPEC-1-1009: Simple Mobile answer page text (same source as the raw HTML in vite.config.ts)
import { SIMPLE_META, SIMPLE_ANSWER, SIMPLE_FAQ_TITLE, SIMPLE_LINKS, simpleFaqs, simpleGridPlans } from "@/content/simplePage";
import { FAQSection } from "@/components/FAQSection";
import { fetchCarrierView, verifyPhone, type CarrierViewData } from "@/services/apiWrapper";
import { fetchUltraMdnPlans, type UltraMdnPlan, type UltraMdnResult } from "@/services/apiWrapper"; // ULTRA-MDN-1029
import { applySeoHead } from "@/lib/seo";
import { feeCopy1019 } from "@/lib/feeCopy1019"; // METRO-FEECOPY-1019
import { billPageByPath, billJsonLd } from "@/content/billCarrierSeo"; // SEO-CONTENT-1014
import { takeCheckoutPrefill } from "@/lib/checkoutResume"; // EMAIL-PREFILL-1013 // ST-PREFILL-1018
import { useEmailPrefill } from "@/hooks/useEmailPrefill"; // EMAIL-PREFILL-1013 // ST-PREFILL-1018
import { t, type Language } from "@/lib/i18n";
import {
  CricketQuickPayContent,
  CRICKET_QUICK_PAY_FAQ_SCHEMA,
} from "@/components/CricketQuickPayContent";
import {
  CarrierLongFormContent,
  ATT_PREPAID_CONFIG,
  STRAIGHT_TALK_CONFIG,
  VERIZON_CONFIG,
  ATT_FAQ_SCHEMA,
  STRAIGHT_TALK_FAQ_SCHEMA,
  VERIZON_FAQ_SCHEMA,
  type CarrierLongFormConfig,
} from "@/components/CarrierLongFormContent";

/** Slug → long-form SEO content + FAQPage JSON-LD overrides. */
const LONG_FORM_BY_SLUG: Record<
  string,
  { config: CarrierLongFormConfig; schema: string; seo: { title: string; description: string; keywords: string } }
> = {
  "topup-at": {
    config: ATT_PREPAID_CONFIG,
    schema: ATT_FAQ_SCHEMA,
    seo: {
      title: "Pay Your AT&T Prepaid Bill Online – No Login | CellPay", // ATT-BILLPAY-H1-1024
      description:
        "Pay your AT&T Prepaid bill online with just your phone number. No login, no account sign-in needed. Pay for yourself or someone else.", // ATT-BILLPAY-H1-1024
      keywords:
        "at&t prepaid refill, pay att prepaid bill online, att prepaid payment, att refill, att prepaid top up, att bill pay",
    },
  },
  "straight-talk": {
    config: STRAIGHT_TALK_CONFIG,
    schema: STRAIGHT_TALK_FAQ_SCHEMA,
    seo: {
      title: "Straight Talk Refill — Pay Bill Online | CellPay",
      description:
        "Refill any Straight Talk Wireless phone online. No login needed. No refill card, all major cards & wallets. Pay your Straight Talk bill online now on CellPay.",
      keywords:
        "straight talk refill, pay straight talk bill online, straight talk payment, straight talk service plan, straight talk top up, straight talk wireless refill",
    },
  },
  straighttalk: {
    config: STRAIGHT_TALK_CONFIG,
    schema: STRAIGHT_TALK_FAQ_SCHEMA,
    seo: {
      title: "Straight Talk Refill — Pay Bill Online | CellPay",
      description:
        "Refill any Straight Talk Wireless phone online. No login needed. No refill card, all major cards & wallets. Pay your Straight Talk bill online now on CellPay.",
      keywords:
        "straight talk refill, pay straight talk bill online, straight talk payment, straight talk service plan, straight talk top up, straight talk wireless refill",
    },
  },
  verizon: {
    config: VERIZON_CONFIG,
    schema: VERIZON_FAQ_SCHEMA,
    seo: {
      title: "Verizon Prepaid Refill — Pay Bill Online | CellPay",
      description:
        "Refill any Verizon Prepaid phone online. No My Verizon login, all major cards & wallets. Pay your Verizon Prepaid bill online on CellPay.",
      keywords:
        "verizon prepaid refill, pay verizon prepaid bill online, verizon refill, verizon prepaid payment, verizon prepaid top up, verizon wireless bill pay",
    },
  },
};


const formatPhone = (value: string): string => {
  let raw = value.replace(/\D/g, ""); if (raw.length === 11 && raw.startsWith("1")) raw = raw.slice(1); if (raw.length >= 10 && raw.startsWith("1")) raw = raw.slice(1); const digits = raw.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

interface DynamicCarrierProps {
  carrierName: string;
  carrierSlug: string;
  carrierId: number;
  brandColor: string;
  logo?: string;
  lang?: Language;
  seoTitleOverride?: string;
  seoDescriptionOverride?: string;
  seoH1Override?: string;
  seoIntroOverride?: string;
}

interface NormalizedPlan {
  plan_id: string;
  price: string;
  highlight: string;
  amount: number;
  name: string;
  carrierId?: number; // per-plan carrier id (used for fixed_plans entries)
}

// Strip non-printable / replacement chars (e.g. Ultra Mobile sometimes returns U+FFFD) — feedback #40
const sanitizeText = (s: string): string =>
  s.replace(/[\uFFFD\u0000-\u001F\u007F-\u009F]/g, "").replace(/\s+/g, " ").trim();

// Normalize "Topup $80" / "Topup 70.00 USD" → "$80" / "$70" — feedback #17
const normalizeHighlight = (raw: string, amount: number): string => {
  const cleaned = sanitizeText(raw);
  if (!cleaned) return amount > 0 ? `$${amount} Refill` : "Prepaid Refill";
  // If the description is just a Topup label, replace with clean dollar amount
  if (/^topup/i.test(cleaned)) return amount > 0 ? `$${amount} Refill` : cleaned;
  return cleaned;
};

// PLAN-RANGES-1016: per-carrier amount limits on top of the API range, hidden plans, and range messages.
const PR_LIMITS: Record<string, { min?: number; max: number }> = { "topup-at": { min: 15, max: 100 }, verizon: { min: 15, max: 150 }, boost: { max: 199 } }; // PLAN-RANGES-1016
const prMin = (slug: string, apiMin: number): number => Math.max(apiMin, PR_LIMITS[slug]?.min ?? apiMin); // PLAN-RANGES-1016
const prMax = (slug: string, apiMax: number): number => Math.min(apiMax, PR_LIMITS[slug]?.max ?? apiMax); // PLAN-RANGES-1016
const prRangeMsg = (slug: string, lang: string): string | null => // PLAN-RANGES-1016
  slug === "topup-at" ? (lang === "es" ? "Pagos de AT&T: de $15 a $100" : "AT&T payments: $15 to $100")
  : slug === "verizon" ? (lang === "es" ? "Pagos de Verizon: de $15 a $150" : "Verizon payments: $15 to $150")
  : null;
const dropHiddenPlans = <T extends { plan_id: string; amount: number }>(slug: string, list: T[]): T[] => // PLAN-RANGES-1016
  list.filter((p) => p.plan_id !== "8282" && p.plan_id !== "325635" && p.plan_id !== "547871" && p.plan_id !== "32993000" && p.plan_id !== "8947005" && !(PR_LIMITS[slug] && slug !== "boost" && p.amount > PR_LIMITS[slug].max) && !tmoCapBlocked(slug, p.amount)); /* TMO-CAP-200-1022 */ // H2O-HIDE-325635-1017 // PLAN-BLOCK-CLEANUP-1017 // ULTRA64-HIDE-1017 // LYCA10-HIDE-1017

function normalizePlans(plans: Array<Record<string, unknown>>): NormalizedPlan[] {
  return plans.map((p) => {
    const id = String(p.plan_id || p.planId || p.id || p.ID || "");
    const amt = Number(p.amount || p.price || p.Amount || 0);
    const rawName = String(p.name || p.Name || p.description || "");
    const carrier = p.carrier;
    const carrierIdNum =
      typeof carrier === "number"
        ? carrier
        : typeof carrier === "string" && carrier !== ""
        ? Number(carrier)
        : undefined;
    const cleanName = normalizeHighlight(rawName, amt);
    return {
      plan_id: id,
      price: `$${amt}`,
      highlight: cleanName,
      amount: amt,
      name: cleanName,
      carrierId: Number.isFinite(carrierIdNum) ? (carrierIdNum as number) : undefined,
    };
  });
}

// ─── Amount input (CP-01) ───
// Keep digits and ONE decimal point (max 2 decimals). Never drop the "." or shift digits
// ("25.00" stays $25, never $250) and never cut digits off ("351" stays 351 and is then
// validated against the carrier's min/max).
const sanitizeAmountInput = (raw: string): string => {
  let s = (raw || "").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  s = s.replace(/^0+(?=\d)/, "");
  if (s.startsWith(".")) s = "0" + s;
  const [intPart, dec] = s.split(".");
  return intPart.slice(0, 6) + (dec !== undefined ? "." + dec : "");
};

// Paste: strip $, spaces and commas and take the first number ("$1,025.00" → "1025.00").
const parsePastedAmount = (text: string): string => {
  const m = (text || "").replace(/[$\s]/g, "").match(/\d[\d,]*(?:\.\d*)?|\.\d+/);
  return m ? sanitizeAmountInput(m[0].replace(/,/g, "")) : "";
};

// Field text → dollars (rounded to cents). NaN when empty.
const parseAmountDollars = (s: string): number => {
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

// On blur: "12.5" → "12.50", "25." → "25.00", "25" stays "25".
const normalizeAmountOnBlur = (s: string): string => {
  const n = parseAmountDollars(s);
  if (!Number.isFinite(n)) return "";
  return s.includes(".") ? n.toFixed(2) : String(n);
};

// Amount step: the carrier API only returns rangeMin/rangeMax (carrier_plans.carrier), no step.
// Every open-amount order on record is whole dollars, so the step is $1 (cents must be .00).
const AMOUNT_STEP_CENTS = 100;

const getAmountProblem = (text: string, n: number, min: number, max: number): "empty" | "range" | "step" | null => {
  if (!text || !Number.isFinite(n)) return "empty";
  if (n < min || n > max) return "range";
  if (Math.round(n * 100) % AMOUNT_STEP_CENTS !== 0) return "step";
  return null;
};

const formatDollars = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const wholeDollarMessage = (lang: string, n: number): string =>
  lang === "es"
    ? `Ingrese un monto en dólares enteros (por ejemplo $${Math.floor(n)} o $${Math.ceil(n)}).`
    : `Please enter a whole-dollar amount (for example $${Math.floor(n)} or $${Math.ceil(n)}).`;

// SPEED-WWW-1008: intrinsic logo size per carrier slug (same numbers as LOGO_DIMS in vite.config.ts), so the logo box is reserved
// before the image arrives. CSS still sets the height (32 / 44 px) and the width follows the image.
const LOGO_DIMS: Record<string, [number, number]> = {
  s1: [479, 105], "topup-crc": [234, 52], metropcs: [94, 41], tmobile: [52, 52], "topup-at": [560, 120], verizon: [475, 106], // ATT-LOGO-1023
  boost: [225, 225], h2o: [241, 76], lyca: [314, 123], net10: [140, 64], pageplus: [265, 73], pageplusadd: [265, 73],
  tracfone: [180, 84], "ultra-mobile": [801, 501],
};

const DynamicCarrier = ({
  carrierName: initialName,
  carrierSlug,
  carrierId: initialCarrierId,
  brandColor,
  logo,
  lang = "en",
  seoTitleOverride,
  seoDescriptionOverride,
  seoH1Override,
  seoIntroOverride,
}: DynamicCarrierProps) => {
  const navigate = useNavigate();
  const location = useLocation(); // VZ-PREPAID-GUARD-1017
  const focusedPhone = useRef<string | null>(null); // VZ-PREPAID-GUARD-1017
  const [searchParams] = useSearchParams();
  const tr = t(lang);
  // CK-0: number handed back by Checkout when a direct /checkout load can't be resumed (read once; never in the URL).
  const [phone, setPhone] = useState(() => formatPhone(takeCheckoutPrefill(carrierSlug)));
  const [rpV] = useState(() => (RP_P1_FORMAT || RP_P2_RETRY_BLOCK ? rpVariant() : "control")); // REFILL-PREVENT-1024
  const rpTyped = useRef(false); // REFILL-PREVENT-1024: only numbers typed here (not prefilled/retry/Auto Pay) need confirming
  const [rpConfirm, setRpConfirm] = useState(""); // REFILL-PREVENT-1024
  const [deadList, setDeadList] = useState<DeadAmount[]>([]); // REFILL-PREVENT-1024
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  // Persistent inline error message — visible until the user changes input.
  const [inlineError, setInlineError] = useState<string | null>(null);
  // Amount field has been left (blur) or pasted into — show below-min / step messages only then.
  const [amountTouched, setAmountTouched] = useState(false);

  // API-loaded state
  const [carrierName, setCarrierName] = useState(initialName);
  const [carrierId, setCarrierId] = useState(initialCarrierId);
  const [showRange, setShowRange] = useState(false); // custom amount input from carrier_plans.rangePlan
  const [showFixedPlans, setShowFixedPlans] = useState(false); // fixed plan buttons from fixed_plans.rangePlan
  const [rangeMin, setRangeMin] = useState(5);
  const [rangeMax, setRangeMax] = useState(300);
  const [rangePlanId, setRangePlanId] = useState<string>("");
  const [rangeCarrierId, setRangeCarrierId] = useState<number | undefined>(undefined); // carrier_plans.carrier.id
  const [plans, setPlans] = useState<NormalizedPlan[]>([]);
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  // LCP-ADS-1007: Metro PCS (EN) headline is known up front, so it matches the static first screen (vite.config.ts) and never changes after load.
  const isMetroEn = carrierSlug === "metropcs" && lang !== "es";
  const isTwEn = carrierSlug === "total-wireless" && lang !== "es"; // COPY-1024
  const [heading, setHeading] = useState(seoH1Override || (isMetroEn ? "Metro PCS Pay Bill Online" : isTwEn ? "Pay Your Total Wireless Bill Online" : "")); // COPY-1024
  const [subheading, setSubheading] = useState(
    seoIntroOverride || (isMetroEn ? "Pay your Metro by T-Mobile prepaid bill online. No login needed." : isTwEn ? "Pay as a guest with just the phone number. No login needed." : ""), // COPY-1024
  );

  // Apply per-route SEO overrides synchronously on mount so they're set before the API roundtrip.
  useEffect(() => {
    if (seoTitleOverride || seoDescriptionOverride) {
      applySeoHead({
        title: seoTitleOverride || "",
        description: seoDescriptionOverride || "",
      });
    }
  }, [seoTitleOverride, seoDescriptionOverride]);

  // Postpaid carriers — show "Postpaid Account?" link to corporate site (feedback)
  const postpaidUrls: Record<string, string> = {
    "topup-at": "https://www.att.com/wireless/",
    "topup-af": "https://www.att.com/firstnet/",
    verizon: "https://www.verizon.com/plans/",
    "verizon-wireless-flexi": "https://www.verizon.com/plans/",
    tmobile: "https://www.t-mobile.com/cell-phone-plans",
  };
  const postpaidUrl = postpaidUrls[carrierSlug];

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPhone(formatPhone(e.target.value));
      rpTyped.current = true; // REFILL-PREVENT-1024
      setInlineError(null);
    },
    []
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInlineError(null);
      setAmountTouched(false);
      setAmount(sanitizeAmountInput(e.target.value));
    },
    []
  );

  const handleAmountPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setInlineError(null);
    setAmount(parsePastedAmount(e.clipboardData.getData("text")));
    setAmountTouched(true);
  }, []);

  const handleAmountBlur = useCallback(() => {
    setAmount((a) => normalizeAmountOnBlur(a));
    setAmountTouched(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data: CarrierViewData = await fetchCarrierView(carrierSlug);
        if (cancelled) return;

        // Carrier info
        if (data.carrier?.name) setCarrierName(data.carrier.name);
        if (data.carrier?.carrierId) setCarrierId(data.carrier.carrierId);

        // SEO / FAQ
        if (data.seo_carrier?.faqs) setFaqs(data.seo_carrier.faqs);
        // H1/H2 are intentionally static across all product pages — do not override from API


        // Dynamic <head> SEO tags from API (fall back to seo_carrier nested fields)
        const seoSrc = (data.seo_carrier ?? {}) as Record<string, unknown>;
        const title =
          (data.title_for_layout as string) ||
          (seoSrc.title_for_layout as string) ||
          "";
        const description =
          (data.seo_description as string) ||
          (seoSrc.seo_description as string) ||
          "";
        const keywords =
          (data.seo_keywords as string) ||
          (seoSrc.seo_keywords as string) ||
          "";
        const schema =
          (data.seo_schema as string) ||
          (seoSrc.seo_schema as string) ||
          "";
        applySeoHead({ title, description, keywords, schema });

        // Cricket-specific SEO override — tightens metadata around the
        // "cricket quick pay" head term to push from position 2 → 1.
        if (carrierSlug === "topup-crc" && lang !== "es") {
          applySeoHead({
            title: "Cricket Quick Pay — Pay Your Cricket Bill Online | CellPay",
            description:
              "Cricket Quick Pay on CellPay: pay any Cricket Wireless bill online. No login needed. All major cards & wallets. Service fee shown before you pay.", // SEO-CONTENT-1014
            keywords:
              "cricket quick pay, cricket wireless quick pay, pay cricket bill online, cricket bill pay, cricket wireless payment", // SEO-CONTENT-1014
            schemaSecondary: CRICKET_QUICK_PAY_FAQ_SCHEMA,
          });
        }

        // Metro PCS SEO override — lead with the head term "metro pcs pay bill"
        // (74K/mo, currently ranking #1) and reinforce variants to defend the spot.
        if (carrierSlug === "metropcs" && lang !== "es") {
          applySeoHead({
            title: "Pay Metro PCS Bill Online as a Guest – No Login | CellPay", // GSC-MAULIK-1014 // BILLPAY-METRO-1021
            description:
              feeCopy1019(carrierSlug, lang, "Metro PCS pay bill online. Pay your Metro by T-Mobile prepaid bill with any card or wallet. No login needed. Low service fee shown before you pay."), // METRO-FEECOPY-1019
            keywords:
              "metro pcs pay bill, metropcs pay bill, pay metro pcs bill, metro pcs payment, metro by t-mobile pay bill, metropcs bill pay online", // GSC-MAULIK-1014: "metro pcs refill" removed
          });
          setHeading("Metro PCS Pay Bill Online");
          setSubheading("Pay your Metro by T-Mobile prepaid bill online. No login needed.");
        }

        // EN-META-1007: Boost Mobile (EN) title/description pinned to the same text as the static HTML
        // (vite.config.ts CARRIER_META "boost.html"; keep in sync). Replaces the API text, whose description
        // says "instantly" (removed site-wide by the claims rules).
        if (carrierSlug === "boost" && lang !== "es") {
          applySeoHead({
            title: "Pay Boost Mobile Bill Online as a Guest – No Login | CellPay", // BILLPAY-BOOST-1022
            description: feeCopy1019(carrierSlug, lang, "Pay your Boost Mobile bill online as a guest with just the phone number. No login needed. Service fee shown before you pay."), // METRO-FEECOPY-1019 BILLPAY-BOOST-1022
          });
        }
        if (carrierSlug === "total-wireless" && lang !== "es") { // COPY-1024
          applySeoHead({ title: "Pay Total Wireless Bill Online – No Login | CellPay", description: "Pay your Total Wireless bill online in minutes. No login needed — enter the phone number, pick your plan and pay with any card or wallet." }); // COPY-1024
          setHeading("Pay Your Total Wireless Bill Online"); // COPY-1024
          setSubheading("Pay as a guest with just the phone number. No login needed."); // COPY-1024
        } // COPY-1024

        // AT&T / Straight Talk / Verizon long-form SEO override (keyword-focused title,
        // description, keywords + FAQPage JSON-LD mirroring the on-page FAQ).
        const longForm = LONG_FORM_BY_SLUG[carrierSlug];
        if (longForm && lang !== "es") {
          applySeoHead({
            title: longForm.seo.title,
            description: longForm.seo.description,
            keywords: longForm.seo.keywords,
            schemaSecondary: longForm.schema,
          });
        }

        // GSC-DUP-1007: Spanish pages keep a Spanish title/description (same text as the static HTML in vite.config.ts).
        if (lang === "es") {
          applySeoHead({
            title: `Recarga de ${initialName} en Línea — Pague su Factura | CellPay`,
            // SEO-ES-META: keep in sync with esCarrierDesc in vite.config.ts.
            description: `Pague su factura de ${initialName} en línea. Sin cuenta y sin iniciar sesión. Puede pagar por otra persona. Verá el cargo por servicio antes de pagar.`,
          });
        }

        // SEO-CONTENT-1014: /es/metropcs.html, /es/boost.html, /topup-crc.html, /es/topup-crc.html: pay-wording title/description and
        // this page's FAQPage + BreadcrumbList JSON-LD (raw HTML carries it; added here only when it is missing). Drops the API schema
        // and the Cricket long-form FAQ schema so the page has one FAQPage that matches its visible FAQ.
        const billPg = billPageByPath(window.location.pathname);
        if (billPg) {
          const hasStatic = !!document.querySelector('script[type="application/ld+json"][data-bill]');
          applySeoHead({
            ...(billPg.title ? { title: billPg.title } : {}),
            description: billPg.description,
            ...(["/topup-crc.html", "/es/topup-crc.html"].includes(billPg.path) ? { keywords: billPg.lang === "es" ? "pagar factura Cricket en línea, pago Cricket sin cuenta, Cricket Quick Pay" : "cricket quick pay, cricket wireless quick pay, pay cricket bill online, cricket bill pay, cricket wireless payment" } : {}), // BILLPAY-CRICKET-1023
            schema: hasStatic ? "" : billJsonLd(billPg),
            schemaSecondary: "",
          });
        }

        // SIMPLE-SPEC-1-1009: /s1.html + /es/s1.html keep the raw-HTML title/description (no runtime swap) and drop the API
        // schema: the raw HTML carries the FAQPage + BreadcrumbList JSON-LD with this page's FAQ text.
        if (carrierSlug === "s1") {
          const sm = SIMPLE_META[lang === "es" ? "es" : "en"];
          applySeoHead({ title: sm.title, description: sm.description, schema: "" });
        }

        // Per-route overrides (e.g. /guest-metro-pcs.html) — applied LAST so they win.
        if (seoTitleOverride || seoDescriptionOverride) {
          applySeoHead({
            title: seoTitleOverride || "",
            description: seoDescriptionOverride || "",
          });
        }
        // SIMPLE-SPEC-3-1009: /guest-simple-mobile.html canonical = /s1.html (same as its raw HTML).
        if (window.location.pathname.replace(/\/+$/, "") === "/guest-simple-mobile.html") applySeoHead({ path: "/s1.html" });
        if (window.location.pathname.replace(/\/+$/, "") === "/guest-boost.html") applySeoHead({ path: "/boost.html" }); // BILLPAY-BOOST-1022
        if (seoH1Override) setHeading(seoH1Override);
        if (seoIntroOverride) setSubheading(seoIntroOverride);



        // Plans: support both `carrier_plans` (range/custom amount) and `fixed_plans` (fixed buttons).
        // `fixed_plans` may live at the response root OR nested inside `carrier_plans.fixed_plans`.
        const cp = data.carrier_plans;
        const rootFp = (data as Record<string, unknown>).fixed_plans;
        const nestedFp =
          cp && !Array.isArray(cp) ? (cp as Record<string, unknown>).fixed_plans : undefined;
        const fp = (rootFp ?? nestedFp) as
          | Array<Record<string, unknown>>
          | { rangePlan?: boolean | string; plans?: Array<Record<string, unknown>>; [k: string]: unknown }
          | undefined;

        const cpRange =
          cp && !Array.isArray(cp) &&
          (cp.rangePlan === true || (typeof cp.rangePlan === "string" && cp.rangePlan !== ""));

        // For root/nested arrays of fixed_plans, presence of items means "show fixed buttons".
        const fpRange =
          (Array.isArray(fp) && fp.length > 0) ||
          (fp && !Array.isArray(fp) &&
            (fp.rangePlan === true || (typeof fp.rangePlan === "string" && fp.rangePlan !== "")));

        // 1) Custom Range: carrier_plans.rangePlan === true → show amount input.
        //    Capture carrier_plans.carrier.id (or .ID) as the carrier id used for range purchases.
        if (cpRange && cp && !Array.isArray(cp)) {
          setShowRange(true);
          setRangeMin(prMin(carrierSlug, cp.carrier?.rangeMin ?? 5)); // PLAN-RANGES-1016
          // CS-1: CellPay's checkout rejects AT&T (topup-at) range-plan amounts over $150 ("Invalid amout for the range plan."),
          // even when carriers/view says 300 (www.cellpay.us). refill.cellpay.us already gets 150 from the API.
          setRangeMax(carrierSlug === "topup-at" || carrierSlug === "verizon" ? prMax(carrierSlug, cp.carrier?.rangeMax ?? 300) /* PLAN-RANGES-1016 */ : carrierSlug === "boost" ? Math.min(cp.carrier?.rangeMax ?? 300, 199) /* BOOST-CAP-199-1016 */ : tmoCapMax(carrierSlug, cp.carrier?.rangeMax ?? 300)); // TMO-CAP-200-1022
          if (typeof cp.rangePlan === "string" && cp.rangePlan !== "") {
            setRangePlanId(cp.rangePlan);
          } else if (cp.carrier?.rangePlan) {
            setRangePlanId(String(cp.carrier.rangePlan));
          }
          const rcRaw =
            (cp.carrier as Record<string, unknown> | undefined)?.id ??
            (cp.carrier as Record<string, unknown> | undefined)?.ID;
          const rcNum = typeof rcRaw === "number" ? rcRaw : rcRaw != null ? Number(rcRaw) : NaN;
          if (Number.isFinite(rcNum)) setRangeCarrierId(rcNum);
        } else {
          setShowRange(false);
        }

        // 2) Fixed Options: fixed_plans.rangePlan === true → show fixed plan buttons.
        //    Each entry's `carrier` field holds the carrier id to send for that plan.
        if (fpRange && fp && !Array.isArray(fp) && Array.isArray(fp.plans) && fp.plans.length > 0) {
          setShowFixedPlans(true);
          setPlans(dropHiddenPlans(carrierSlug, normalizePlans(fp.plans))); // PLAN-RANGES-1016
        } else if (Array.isArray(fp) && fp.length > 0) {
          setShowFixedPlans(true);
          setPlans(dropHiddenPlans(carrierSlug, normalizePlans(fp as Array<Record<string, unknown>>))); // PLAN-RANGES-1016
        } else if (cp && !cpRange) {
          // Fallback to carrier_plans for fixed plan list when fixed_plans is absent
          if (Array.isArray(cp)) {
            setShowFixedPlans(true);
            setPlans(dropHiddenPlans(carrierSlug, normalizePlans(cp as Array<Record<string, unknown>>))); // PLAN-RANGES-1016
          } else if (Array.isArray(cp.plans) && cp.plans.length > 0) {
            setShowFixedPlans(true);
            setPlans(dropHiddenPlans(carrierSlug, normalizePlans(cp.plans))); // PLAN-RANGES-1016
          }
        } else {
          setShowFixedPlans(false);
        }
      } catch (err) {
        console.warn("Failed to load carrier view for", carrierSlug, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [carrierSlug]);

  // Prefill amount from URL (?amount=60) — used by legacy /{amount}-{slug}-prepaid-refill.html redirects.
  // VZ-PREPAID-GUARD-1017: focus once after the visible field renders, without changing its value.
  useEffect(() => {
    if (loading || location.state?.focusPhone !== true || focusedPhone.current === location.key) return;
    const input = document.getElementById("carrier-phone-input");
    if (input instanceof HTMLInputElement) { input.focus(); if (location.state?.selectPhone === true && input.value) input.select(); focusedPhone.current = location.key; } // REFUND-RETRY-1018
  }, [loading, location.key, location.state]);

  // Runs after plans load so we can clamp to range or match an existing fixed plan.
  useEffect(() => {
    if (loading) return;
    const raw = searchParams.get("amount");
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    if (showRange) {
      const clamped = Math.min(Math.max(n, rangeMin), rangeMax);
      setAmount(String(clamped));
    } else if (showFixedPlans && plans.length > 0) {
      const match = plans.find((p) => p.amount === n);
      if (match) setAmount(String(match.amount));
    } else {
      setAmount(String(n));
    }
    // Only run once after initial load; ignore changes to searchParams afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // EMAIL-PREFILL-1013 / AUTOPAY-VISIBLE-1013: shared token handling; preserve page-specific selection. // ST-PREFILL-1018
  useEmailPrefill(carrierSlug, !loading, (r) => { // ST-PREFILL-1018
    setPhone((cur) => (cur.replace(/\D/g, "") === "" ? formatPhone(r.phone) : cur)); // ST-PREFILL-1018
    const n = r.amount; // ST-PREFILL-1018
    if (n !== null) { // ST-PREFILL-1018
      if (showRange) { // ST-PREFILL-1018
        if (Number.isInteger(n) && n >= rangeMin && n <= rangeMax) setAmount(String(n)); // ST-PREFILL-1018
      } else if (showFixedPlans && plans.length > 0) { // ST-PREFILL-1018
        const match = plans.find((p) => p.amount === n); // ST-PREFILL-1018
        if (match) setAmount(String(match.amount)); // ST-PREFILL-1018
      } // ST-PREFILL-1018
    } // ST-PREFILL-1018
  }); // ST-PREFILL-1018

  const phoneDigits = phone.replace(/\D/g, "");
  // REFILL-PREVENT-1024 (P1): fail open — any error in these checks means no extra requirement.
  const p1On = RP_P1_FORMAT && rpV === "rp";
  const rpFormatBad = p1On && phoneDigits.length === 10 && phoneFormatBad(phoneDigits);
  const rpNeedConfirm = p1On && rpTyped.current && phoneDigits.length === 10 && !rpFormatBad;
  const rpConfirmOk = !rpNeedConfirm || rpConfirm.replace(/\D/g, "").slice(-10) === phoneDigits;
  const ultraSmart = useUltraSmart(carrierSlug, phoneDigits, rpConfirmOk, plans, (plan) => setAmount(String(plan.amount))); // ULTRA-SMART-PREVENT-1024
  const tmoSmart = useTmoLastPlan(carrierSlug, phoneDigits, rpConfirmOk, plans, (plan) => setAmount(String(plan.amount))); // REFILL-PREVENT-TMO-1026
  const rpPhoneBlock = rpFormatBad || !rpConfirmOk;
  const rpFmtLogged = useRef(false);
  useEffect(() => { if (rpFormatBad && !rpFmtLogged.current) { rpFmtLogged.current = true; rpEvent("rp_format_error", carrierSlug, rpV); } if (!rpFormatBad) rpFmtLogged.current = false; }, [rpFormatBad, carrierSlug, rpV]);
  useEffect(() => { // REFILL-PREVENT-1024 (P4): list failure = everything available as today
    if (!RP_P4_DEAD_AMOUNTS || carrierSlug === "ultra-mobile") return;
    let off = false; void fetchDeadAmounts().then((l) => { if (!off) setDeadList(l); }); return () => { off = true; };
  }, [carrierSlug]);
  const rpGate = async (planId: unknown, amt: unknown): Promise<boolean> => { // REFILL-PREVENT-1024: true = may continue
    try {
      if (!ultraSmart.gate(Number(amt))) return false; // ULTRA-SMART-PREVENT-1024
      if (!tmoSmart.gate(Number(amt))) return false; // REFILL-PREVENT-TMO-1026
      if (rpPhoneBlock) {
        if (!rpFormatBad) rpEvent("rp_confirm_mismatch", carrierSlug, rpV);
        const msg = formatErrorText(lang); setInlineError(msg); return false;
      }
      if (RP_P4_DEAD_AMOUNTS && isDeadAmount(deadList, carrierSlug, planId, amt)) { setInlineError(deadLabel(lang)); return false; }
      if (RP_P2c_DISC_24H && carrierSlug !== "ultra-mobile" && await withTimeout(checkDiscBlock(phoneDigits, carrierSlug, planId), 1000, false)) { // LYCA-SKU-FIX-1024
        rpEvent("rp_retry_blocked", carrierSlug, "disc24h"); // LYCA-SKU-FIX-1024
        const msg = discBlockText(lang); setInlineError(msg); toast({ title: msg, description: msg, variant: "destructive" }); return false; // LYCA-SKU-FIX-1024
      } // LYCA-SKU-FIX-1024
      if (RP_P2_RETRY_BLOCK && (rpV === "rp" || (TMO_RETRY_BLOCK_ALWAYS && carrierSlug === "tmobile")) && await withTimeout(checkRetryBlock(phoneDigits, carrierSlug, planId), 1000, false)) { // REFILL-PREVENT-TMO-1026
        rpEvent("rp_retry_blocked", carrierSlug, rpV);
        if (carrierSlug === "tmobile") tmoEvent("tmo_retry_blocked", carrierSlug, rpV); // REFILL-PREVENT-TMO-1026
        const msg = retryBlockText(lang); setInlineError(msg); toast({ title: msg, description: msg, variant: "destructive" }); return false;
      }
    } catch { /* fail open */ }
    return true;
  };
  const amountNum = parseAmountDollars(amount) || 0; // dollars, same unit checkout and the API use
  const amountProblem = getAmountProblem(amount, amountNum, rangeMin, rangeMax);
  const rangeAmountValid = amountProblem === null;
  const amountMessage =
    amountProblem === "range"
      ? tmoCapBlocked(carrierSlug, amountNum) ? tmoCapMsg(lang) /* TMO-CAP-200-1022 */ : (carrierSlug === "boost" && amountNum > 199 ? (lang === "es" ? "Pagos de Boost: máximo $199" : "Boost payments max $199") /* BOOST-CAP-199-1016 */ : (prRangeMsg(carrierSlug, lang) ?? tr.invalidAmount(rangeMin, rangeMax)) /* PLAN-RANGES-1016 */)
      : amountProblem === "step"
      ? wholeDollarMessage(lang, amountNum)
      : null;
  // Over the max shows at once; below-min / cents show after the customer leaves the field.
  const showAmountMessage = !!amountMessage && (amountTouched || amountNum > rangeMax);

  const handlePlanSelect = (plan: { price: string; highlight: string }) => {
    setAmount(plan.price.replace("$", ""));
  };

  // ARB-0c: Verizon (slug verizon) sends its range plan for every amount in range, the same shape as Metro
  // (rangePlan id instead of a fixed plan id), with carrierId 14 (Verizon Wireless Prepaid: its plans, validate
  // and orders all use 14; the carriers/view header record says 75). Every other carrier is unchanged.
  const VERIZON_CARRIER_ID = 14;
  const isVerizonRange = (amt: number) =>
    carrierSlug === "verizon" && rangePlanId !== "" && amt >= rangeMin && amt <= rangeMax;

  // Direct checkout from plan card "Pay Now" button (fixed_plans → use that plan's carrier id)
  const handlePlanPayNow = async (plan: { price: string; highlight: string }) => {
    if (phoneDigits.length !== 10) {
      toast({ title: tr.phoneRequired, description: tr.phoneRequired, variant: "destructive" });
      return;
    }
    { const pa = Number(plan.price.replace("$", "")); if (!(await rpGate(isVerizonRange(pa) ? rangePlanId : plans.find((p) => p.amount === pa)?.plan_id, pa))) return; } // REFILL-PREVENT-1024
    setVerifying(true);
    const verify = await verifyPhone(carrierSlug, phoneDigits);
    setVerifying(false);
    if (!verify.success) {
      toast({ title: tr.invalidPhone, description: verify.message || tr.invalidPhone, variant: "destructive" });
      return;
    }
    const planAmount = Number(plan.price.replace("$", ""));
    const vzRange = isVerizonRange(planAmount); // ARB-0c
    const selectedPlan = vzRange ? undefined : plans.find((p) => p.amount === planAmount);
    navigate(lang === "es" ? "/es/checkout" : "/checkout", {
      state: {
        phone,
        amount: planAmount,
        carrierSlug,
        carrierId: vzRange ? VERIZON_CARRIER_ID : (selectedPlan?.carrierId ?? carrierId),
        carrierName,
        brandColor,
        planId: vzRange ? rangePlanId : selectedPlan?.plan_id,
        planName: selectedPlan?.name,
      },
    });
  };

  const { toast } = useToast();

  const handlePay = async () => {
    setInlineError(null);
    if (phoneDigits.length !== 10) {
      const msg = tr.phoneRequired;
      setInlineError(msg);
      toast({ title: msg, description: msg, variant: "destructive" });
      return;
    }
    if (!rangeAmountValid) {
      const msg = amountMessage || tr.invalidAmount(rangeMin, rangeMax);
      setAmountTouched(true);
      setInlineError(msg);
      toast({ title: msg, description: msg, variant: "destructive" });
      return;
    }
    if (!(await rpGate(isVerizonRange(amountNum) ? rangePlanId : (plans.find((p) => p.amount === amountNum)?.plan_id || rangePlanId), amountNum))) return; // REFILL-PREVENT-1024
    setVerifying(true);
    const verify = await verifyPhone(carrierSlug, phoneDigits);
    setVerifying(false);
    if (!verify.success) {
      const msg = verify.message || tr.invalidPhone;
      setInlineError(msg);
      toast({ title: tr.invalidPhone, description: msg, variant: "destructive" });
      return;
    }
    // Custom amount path → use carrier_plans.carrier.id when available
    const vzRange = isVerizonRange(amountNum); // ARB-0c
    const selectedPlan = vzRange ? undefined : plans.find((p) => p.amount === amountNum);
    navigate(lang === "es" ? "/es/checkout" : "/checkout", {
      state: {
        phone,
        amount: amountNum,
        carrierSlug,
        carrierId: vzRange ? VERIZON_CARRIER_ID : (selectedPlan?.carrierId ?? rangeCarrierId ?? carrierId),
        carrierName,
        brandColor,
        planId: selectedPlan?.plan_id || rangePlanId || undefined,
        planName: selectedPlan?.name,
      },
    });
  };

  // ULTRA-MDN-1029: source B (plans for this MDN). Ultra Mobile only; A plans stay the default/fallback.
  const ultraMdn10 = (() => { let d = phone.replace(/[\s\-()+]/g, "").replace(/\D/g, ""); if (d.length === 11 && d.startsWith("1")) d = d.slice(1); return carrierSlug === "ultra-mobile" && /^\d{10}$/.test(d) ? d : ""; })(); // ULTRA-MDN-1029
  const [ultraB, setUltraB] = useState<{ mdn: string; state: "loading" | "done"; r?: UltraMdnResult } | null>(null); // ULTRA-MDN-1029
  const [ultraShowAll, setUltraShowAll] = useState(false); // ULTRA-MDN-1029
  const [ultraRangeAmt, setUltraRangeAmt] = useState<Record<number, string>>({}); // ULTRA-MDN-1029
  useEffect(() => { // ULTRA-MDN-1029: one lookup per valid MDN; stale replies ignored; phone change clears B selection
    setUltraShowAll(false); setUltraRangeAmt({}); // ULTRA-MDN-1029
    if (!ultraMdn10) { setUltraB(null); return; } // ULTRA-MDN-1029
    let off = false; setUltraB({ mdn: ultraMdn10, state: "loading" }); // ULTRA-MDN-1029
    void fetchUltraMdnPlans(ultraMdn10).then((r) => { if (!off) setUltraB({ mdn: ultraMdn10, state: "done", r }); }).catch(() => { if (!off) setUltraB({ mdn: ultraMdn10, state: "done", r: { ok: false, status: 502 } }); }); // ULTRA-MDN-1029
    return () => { off = true; }; // ULTRA-MDN-1029
  }, [ultraMdn10]); // ULTRA-MDN-1029
  const ultraBRes = ultraB && ultraB.mdn === ultraMdn10 && ultraB.state === "done" ? ultraB.r : undefined; // ULTRA-MDN-1029
  const ultraBOk = ultraBRes && ultraBRes.ok ? (ultraBRes as Extract<UltraMdnResult, { ok: true }>) : null; // ULTRA-MDN-1029
  const ultraBActive = !!ultraBOk && !ultraShowAll; // ULTRA-MDN-1029: B is the default when it succeeds
  const ultraBFail = ultraBRes && !ultraBRes.ok ? (ultraBRes as { ok: false; status: number; message?: string }) : null; // ULTRA-MDN-1029
  const ultraBErr = ultraBFail ? ((ultraBFail.status === 422 || /TRANSACTION REJECTED/i.test(ultraBFail.message ?? "")) && ultraBFail.message ? { rejected: true, text: ultraBFail.message.slice(0, 300) } : { rejected: false, text: lang === "es" ? "No pudimos cargar los planes de este número. Mostramos todos los planes." : "Could not load plans for this number. Showing all plans." }) : null; // ULTRA-MDN-1029
  const handleUltraBPay = async (plan: UltraMdnPlan, amt: number) => { // ULTRA-MDN-1029: same gates as today, then checkout with ultraMdn
    setInlineError(null); // ULTRA-MDN-1029
    if (!ultraMdn10 || !plan.barcode) { toast({ title: tr.phoneRequired, description: tr.phoneRequired, variant: "destructive" }); return; } // ULTRA-MDN-1029
    if (!Number.isFinite(amt) || amt <= 0) return; // ULTRA-MDN-1029
    if (!(await rpGate(plan.planId, amt))) return; // ULTRA-MDN-1029
    setVerifying(true); // ULTRA-MDN-1029
    const verify = await verifyPhone(carrierSlug, phoneDigits); // ULTRA-MDN-1029
    setVerifying(false); // ULTRA-MDN-1029
    if (!verify.success) { toast({ title: tr.invalidPhone, description: verify.message || tr.invalidPhone, variant: "destructive" }); return; } // ULTRA-MDN-1029
    navigate(lang === "es" ? "/es/checkout" : "/checkout", { // ULTRA-MDN-1029
      state: { phone, amount: amt, carrierSlug, carrierId: plan.carrierId, carrierName, brandColor, planId: plan.planId, planName: plan.name, // ULTRA-MDN-1029
        ultraMdn: { mdn: ultraMdn10, barcode: plan.barcode, kind: plan.kind, planId: plan.planId, carrierId: plan.carrierId, rangeMin: plan.rangeMin, rangeMax: plan.rangeMax } }, // ULTRA-MDN-1029
    }); // ULTRA-MDN-1029
  }; // ULTRA-MDN-1029

  const bc = brandColor;
  // TOP4-T1-1009: display only. carrierName (API/DB name) still goes to checkout unchanged.
  const shownName = displayCarrierName(carrierName, lang === "es" ? "es" : "en");
  const top4 = seoH1Override ? null : top4Hero(carrierSlug, lang === "es" ? "es" : "en");
  // TOP4-T2A-1009: "active line" note under the number field + "Why was my payment refunded?" FAQ (4 carriers only).
  const lineNote = top4 ? activeLineNote(carrierSlug, lang === "es" ? "es" : "en") : null;
  const extraFaq = top4 ? refundFaq(carrierSlug, lang === "es" ? "es" : "en") : null;
  // TOP4-T3-1009: on the Spanish pages of the 4 carriers, show the Spanish FAQ set (same as /es/go) instead of the
  // English FAQ items from the carrier content API. EN pages keep the API FAQs. (These pages emit no FAQPage JSON-LD in ES.)
  const esTop4 = !!top4 && lang === "es";
  // TOP4-T4-1009: + 4 FAQs in searchers' words (guest, don't know the amount, paid but not working, wrong number). On ES the
  // guest FAQ replaces the "sin cuenta" item (same question). EN keeps the API FAQs first.
  const sf = top4 ? searchFaqs(carrierSlug, lang === "es" ? "es" : "en") : [];
  const qa = (l: Array<{ q: string; a: string }>) => l.map((f) => ({ question: f.q, answer: f.a }));
  const baseFaqs = esTop4 ? [...qa(sf.slice(0, 1)), ...qa(esCarrierFaqs(carrierSlug).slice(1)), ...qa(sf.slice(1))] : [...faqs, ...qa(sf)];
  const shownFaqs = extraFaq ? [...baseFaqs, { question: extraFaq.q, answer: extraFaq.a }] : baseFaqs;
  const faqName = esTop4 ? top4Name(carrierSlug, "es") || shownName : shownName;
  // SIMPLE-SPEC-1-1009 (display only): Simple Mobile plan names/order, answer, FAQ and links from src/content/simplePage.ts.
  const isSimple = carrierSlug === "s1";
  const bill = billPageByPath(typeof window !== "undefined" ? window.location.pathname : ""); // SEO-CONTENT-1014
  const sl = lang === "es" ? "es" : "en";
  const gridPlans = plans.map((p) => ({ price: p.price, highlight: ultraPlanLabel(carrierSlug, p.plan_id, p.highlight), ...(RP_P4_DEAD_AMOUNTS && isDeadAmount(deadList, carrierSlug, p.plan_id, p.amount) ? { unavailable: deadLabel(lang) } : {}), ...(tmoSmart.match && String(p.plan_id) === tmoSmart.match.plan_id && Number(p.amount) === tmoSmart.match.amount ? { badge: tmoText(lang).badge } : {}) })); // ULTRA-MSG-1024 // REFILL-PREVENT-1024 // REFILL-PREVENT-TMO-1026
  const rpGuide = RP_P2_GUIDANCE ? guidanceText(carrierSlug, lang) : null; // REFILL-PREVENT-1024
  const rpDeadShown = gridPlans.some((p) => "unavailable" in p); // REFILL-PREVENT-1024
  const rpDeadLogged = useRef(false); // REFILL-PREVENT-1024
  useEffect(() => { if (rpDeadShown && !rpDeadLogged.current) { rpDeadLogged.current = true; rpEvent("rp_dead_amount_shown", carrierSlug, rpV); } }, [rpDeadShown, carrierSlug, rpV]); // REFILL-PREVENT-1024
  const shownGrid = isSimple ? simpleGridPlans(gridPlans, sl) : { plans: gridPlans, popular: Math.min(plans.length - 1, Math.floor(plans.length / 2)) };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: bc }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            {logo ? (
              <img src={logo} alt={bill || carrierSlug === "metropcs" /* GSC-MAULIK-1014 */ ? `${carrierName} logo` /* SEO-CONTENT-1014 */ : `${carrierName} prepaid refill logo`} width={LOGO_DIMS[carrierSlug]?.[0]} height={LOGO_DIMS[carrierSlug]?.[1]} className="h-8 w-8 sm:h-11 sm:w-11 object-contain" />
            ) : (
              <span className="text-xl sm:text-2xl font-extrabold" style={{ color: bc }}>{carrierName}</span>
            )}
            <AccountDropdown />
          </div>
        </div>
        <div className="bg-[hsl(174,45%,12%)] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ul className="flex items-center justify-start sm:justify-center gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap py-2 sm:py-3 text-sm sm:text-base font-medium scrollbar-none">
              {[
                { label: "Domestic Payments", href: "/", external: false },
                { label: "Bill Payments", href: "https://billpay.cellpay.us/billpayment", external: true },
                { label: "International Topups", href: "https://international.cellpay.us/international/", external: true },
                { label: "Accessories", href: "https://shop.cellpay.us/", external: true, newTab: true },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    {...(item.external ? { rel: "noopener noreferrer", ...((item as any).newTab ? { target: "_blank" } : {}) } : {})}
                    className="inline-block px-3 sm:px-4 py-1.5 rounded-md hover:bg-white/10 transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>


      <section style={{ backgroundColor: bc }} className="text-primary-foreground">
        <div className="max-w-7xl mx-auto px-5 py-4 sm:py-5 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl md:text-2xl font-extrabold">
            {bill ? bill.h1 /* SEO-CONTENT-1014 */ : top4 ? top4.h1 : (lang === "es" || !heading) ? tr.heroH1(carrierName) : heading}
          </h1>
          <p className="text-sm opacity-90 mt-1">
            {bill ? bill.sub /* SEO-CONTENT-1014 */ : top4 ? top4.sub : (lang === "es" || !subheading) ? tr.heroH2(carrierName) : subheading}
          </p>
          {usCellularNote(carrierSlug, lang === "es" ? "es" : "en") && <p className="text-xs opacity-90 mt-1">{usCellularNote(carrierSlug, lang === "es" ? "es" : "en")}</p> /* BATCH3-1014 */}
        </div>
      </section>

      {/* LCP-ADS-1007: Auto Pay info card, always shown under the headline (same markup/copy as the static first screen in
          vite.config.ts carrierFirstScreen). Information only: Auto Pay is chosen at checkout and is never pre-checked. */}
      <div className="max-w-[420px] mx-auto px-4 pt-3">
        <p className="bg-card rounded-xl border border-border px-3 py-2.5 text-xs text-foreground leading-relaxed text-center">
          {/* METRO-FEECOPY-1019 */}
          {feeCopy1019(carrierSlug, lang, bill /* SEO-CONTENT-1014 */
            ? bill.autoPayInfoLead + (bill.lang === "es"
              ? " Lo puede activar al pagar. El Pago Automático está desactivado a menos que usted lo marque o llegue desde un enlace de Pago Automático. Cargo por servicio bajo, mostrado antes de pagar. " + weAcceptLine("es") // PLAN-BLOCK-CLEANUP-1017
              : " You can turn it on at checkout. Auto Pay stays off unless you tick it, or you came from an Auto Pay link. Low service fee shown before you pay. " + weAcceptLine("en"))
            : lang === "es"
            ? "Opcional: Auto Pago para no olvidar su recarga. Lo puede activar al pagar. El Pago Automático está desactivado a menos que usted lo marque o llegue desde un enlace de Pago Automático. Cargo por servicio bajo, mostrado antes de pagar. " + weAcceptLine("es") // PLAN-BLOCK-CLEANUP-1017
            : (carrierSlug === "metropcs" ? "Optional: Auto Pay so you never miss a payment." /* GSC-MAULIK-1014 */ : "Optional: Auto Pay so you never miss a refill.") + " You can turn it on at checkout. Auto Pay stays off unless you tick it, or you came from an Auto Pay link. Low service fee shown before you pay. " + weAcceptLine("en"))}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Phone + Amount */}
          <div className="max-w-[340px] sm:max-w-[420px] mx-auto px-4 pt-4 pb-4 sm:pt-6 sm:pb-6">
            <div className="bg-card rounded-xl shadow-lg border border-border p-4 sm:p-6 text-center">
              <label htmlFor="carrier-phone-input" className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                {tr.enterPhoneLabel(shownName)}
              </label>
              <div className="relative mb-3">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <input
                  id="carrier-phone-input"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={tr.phonePlaceholder}
                  aria-label={tr.enterPhoneLabel(shownName)}
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-11 pr-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center"
                  style={{ "--tw-ring-color": bc } as React.CSSProperties}
                />
              </div>
              {lineNote && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 -mt-2">{lineNote}</p>
              )}
              {phoneDigits.length === 10 && (
                <p className="text-[10px] sm:text-xs text-cellpay-green font-semibold mb-2 -mt-1">
                  ✓ {bill && carrierSlug === "boost" ? (bill.lang === "es" ? "Pago para" : "Paying for") : tr.refilling}: {phone}{/* BILLPAY-BOOST-1022 */}
                </p>
              )}
              {rpFormatBad && <p role="alert" data-testid="rp-format-error" className="text-[10px] sm:text-xs text-destructive font-semibold mb-2 -mt-1">{formatErrorText(lang)}</p>}{/* REFILL-PREVENT-1024 */}
              {rpNeedConfirm && (<div className="mb-3">{/* REFILL-PREVENT-1024 */}
                <label htmlFor="rp-confirm-phone" className="block text-xs sm:text-sm font-bold text-foreground mb-1.5">{confirmLabel(lang)}</label>
                <input id="rp-confirm-phone" type="tel" value={rpConfirm} onChange={(e) => { setRpConfirm(formatPhone(e.target.value)); setInlineError(null); }} placeholder={tr.phonePlaceholder} className="w-full h-10 sm:h-12 px-4 rounded-lg border border-input bg-background text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent text-center" style={{ "--tw-ring-color": bc } as React.CSSProperties} />
              </div>)}
              {phoneDigits.length > 0 && phoneDigits.length < 10 && (
                <p className="text-[10px] sm:text-xs text-destructive mb-2 -mt-1">
                  {tr.enterAll10}
                </p>
              )}


              {showRange && (
                <>
                  <label htmlFor="carrier-amount-input" className="block text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                    {tr.selectAmount}
                  </label>
                  <div className="relative mb-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <input
                      id="carrier-amount-input"
                      name="amount"
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={handleAmountChange}
                      onPaste={handleAmountPaste}
                      onBlur={handleAmountBlur}
                      placeholder={tr.amountPlaceholder(rangeMin, rangeMax)}
                      aria-label={tr.selectAmount}
                      aria-invalid={showAmountMessage}
                      aria-describedby={showAmountMessage ? "carrier-amount-error" : undefined}
                      className="w-full h-10 sm:h-12 pl-9 sm:pl-11 pr-2 sm:pr-4 rounded-lg border border-input bg-background text-base text-foreground placeholder:text-muted-foreground placeholder:text-[13px] sm:placeholder:text-base focus:outline-none focus:ring-2 focus:border-transparent text-center"
                      style={{ "--tw-ring-color": bc } as React.CSSProperties}
                    />
                  </div>
                  {showAmountMessage && (
                    <p id="carrier-amount-error" role="alert" className="text-[11px] sm:text-xs text-destructive font-semibold mt-1 mb-1">
                      {amountMessage}
                    </p>
                  )}
                  {rangeAmountValid && (
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={verifying || rpPhoneBlock || ultraSmart.paused || (ultraSmart.noHistory && !ultraSmart.acknowledged) /* REFILL-PREVENT-1024 // ULTRA-SMART-PREVENT-1024 */}
                      className="mt-3 w-full h-10 sm:h-11 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm sm:text-base transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                      style={{ backgroundColor: bc }}
                    >
                      {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                      {verifying ? tr.verifying : tr.payNow}
                    </button>
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {showFixedPlans ? tr.orSelectPlanBelow : bill ? bill.enterAmount /* SEO-CONTENT-1014 */ : tr.enterAmount}
                  </p>
                </>
              )}

              {/* Persistent inline error — feedback: "error message quickly flashes away" */}
              {inlineError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] sm:text-xs text-destructive font-semibold text-left"
                >
                  {inlineError}
                </div>
              )}
            </div>
          </div>

          {carrierSlug === "ultra-mobile" && <div className="max-w-[420px] mx-auto px-4 pb-4"><UltraSmartNotice smart={ultraSmart} lang={lang} onContinue={() => { if (ultraSmart.usual) void handlePlanPayNow({ price: `$${ultraSmart.usual.amount}`, highlight: ultraSmart.usual.name || "" }); }} /></div>}{/* // ULTRA-SMART-PREVENT-1024 */}
          {carrierSlug === "tmobile" && <div className="max-w-[420px] mx-auto px-4 pb-3"><TmoLastPlanNotice smart={tmoSmart} lang={lang} /></div>}{/* // REFILL-PREVENT-TMO-1026 */}
          {rpGuide && <p data-testid="rp-guidance" className="max-w-[420px] mx-auto px-4 pb-3 text-xs sm:text-sm text-muted-foreground text-center">{rpGuide}</p>}{/* REFILL-PREVENT-1024 */}
          {carrierSlug === "ultra-mobile" && ultraMdn10 && ( /* ULTRA-MDN-1029 */
            <div className="max-w-[420px] mx-auto px-4 pb-4" data-ultra-mdn="">{/* ULTRA-MDN-1029 */}
              {ultraB?.state === "loading" && <p className="text-xs text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />{lang === "es" ? "Buscando planes para este número…" : "Finding plans for this number…"}</p>}{/* ULTRA-MDN-1029 */}
              {ultraBErr && <p className={`text-xs ${ultraBErr.rejected ? "text-destructive/80" : "text-muted-foreground"}`}>{ultraBErr.text}</p>}{/* ULTRA-MDN-1029 */}
              {ultraBOk && ultraBOk.subscriber && <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs sm:text-sm text-foreground mb-3" style={{ whiteSpace: "pre-line" }}>{ultraBOk.subscriber}</div>}{/* ULTRA-MDN-1029 */}
              {ultraBActive && ultraBOk && ultraBOk.fixed.length > 0 && <PlanGrid plans={ultraBOk.fixed.map((p, i) => ({ price: `$${formatDollars(p.amount ?? 0)}`, highlight: p.name || "", _i: i }))} brandColor={bc} onSelect={(pl) => { const fp = ultraBOk.fixed[(pl as { _i?: number })._i ?? -1]; if (fp && fp.amount !== undefined) void handleUltraBPay(fp, fp.amount); }} />}{/* ULTRA-MDN-1029 */}
              {ultraBActive && ultraBOk && ultraBOk.range.map((rp, i) => { const mn = rp.rangeMin ?? 0; const mx = rp.rangeMax ?? 0; const v = ultraRangeAmt[i] ?? ""; const n = Number(v); const okAmt = v !== "" && Number.isFinite(n) && n >= mn && n <= mx; return ( /* ULTRA-MDN-1029 */
                <div key={`ur${i}`} className="mt-3 rounded-lg border border-border bg-card p-3">{/* ULTRA-MDN-1029 */}
                  <p className="text-sm font-bold text-foreground mb-2">{rp.name || `$${mn} – $${mx}`}</p>{/* ULTRA-MDN-1029 */}
                  <input type="number" inputMode="decimal" min={mn} max={mx} value={v} placeholder={`$${mn} – $${mx}`} onChange={(e) => setUltraRangeAmt((cur) => ({ ...cur, [i]: e.target.value }))} onBlur={() => { if (v === "" || !Number.isFinite(n)) return; setUltraRangeAmt((cur) => ({ ...cur, [i]: String(Math.min(mx, Math.max(mn, n))) })); }} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label={rp.name || "amount"} />{/* ULTRA-MDN-1029 */}
                  <button type="button" disabled={verifying || !okAmt || rpPhoneBlock || ultraSmart.paused} onClick={() => void handleUltraBPay(rp, n)} className="mt-2 w-full h-10 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-2" style={{ backgroundColor: bc }}>{verifying && <Loader2 className="h-4 w-4 animate-spin" />}{verifying ? tr.verifying : tr.payNow}</button>{/* ULTRA-MDN-1029 */}
                </div> /* ULTRA-MDN-1029 */
              ); })}
              {ultraBOk && <button type="button" className="mt-3 text-xs underline text-muted-foreground" onClick={() => setUltraShowAll((x) => !x)}>{ultraShowAll ? (lang === "es" ? "Ver los planes de este número" : "Show plans for this number") : (lang === "es" ? "Ver todos los planes de Ultra" : "Show all Ultra plans")}</button>}{/* ULTRA-MDN-1029 */}
            </div>
          )}
          {/* Plan grid (fixed_plans) */}
          {showFixedPlans && plans.length > 0 && !ultraBActive /* ULTRA-MDN-1029 */ && (
            <PlanGrid
              plans={ultraSmart.paused ? shownGrid.plans.map((plan) => ({ ...plan, unavailable: ultraHealthText("pause", lang) })) : shownGrid.plans} // ULTRA-SMART-PREVENT-1024
              brandColor={bc}
              onSelect={handlePlanPayNow}
              popularIndex={shownGrid.popular}
            />
          )}
          {/* SIMPLE-SPEC-1-1009: 2-sentence answer right under the plan buttons (same text as the raw HTML) */}
          {isSimple && (
            <p className="max-w-[420px] mx-auto px-4 pt-1 pb-4 text-sm text-foreground leading-relaxed text-center">{SIMPLE_ANSWER[sl]}</p>
          )}

          {/* Terms + Pay (custom amount path) */}
          {showRange && !ultraBActive /* ULTRA-MDN-1029 */ && (
          <div className="max-w-[420px] mx-auto px-4 pb-24 sm:pb-12">
            <p className="text-xs sm:text-sm font-bold text-foreground mb-2 mt-2">{tr.importantLabel}</p>
            <label className="flex items-start gap-2 mb-6 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: bc }} />
              <span className="text-[11px] sm:text-xs text-foreground leading-relaxed">
                {tr.confirmText}
              </span>
            </label>
            {/* Desktop / tablet Pay button (mobile uses sticky bar below) */}
            <div className="hidden sm:flex justify-center">
              <button
                type="button"
                onClick={handlePay}
                disabled={verifying || !rangeAmountValid || rpPhoneBlock || ultraSmart.paused || (ultraSmart.noHistory && !ultraSmart.acknowledged) /* REFILL-PREVENT-1024 // ULTRA-SMART-PREVENT-1024 */}
                className="h-[48px] px-14 rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-lg transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: bc }}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? tr.verifying : tr.payNow}
              </button>
            </div>
            <p className="hidden sm:block text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
              {bill ? bill.securePayment /* SEO-CONTENT-1014 */ : tr.securePayment}
            </p>
          </div>
          )}

          {/* Mobile sticky Pay bar — keeps CTA visible above numeric keyboard
              on open denomination flows (feedback Page 2 #4). HC-ALL: pr-[72px] keeps a slot at the right end for the
              Help button (48px at right 16px + 8px gap), which docks inside it (data-help-dock-slot, helpMobileGuard.ts). */}
          {showRange && !ultraBActive /* ULTRA-MDN-1029 */ && (
            <div data-help-dock-slot="" className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pl-3 pr-[72px] py-2 flex items-center gap-2"
                 style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}>
              <div className="flex-1 text-left leading-tight">
                <p className="text-[10px] text-muted-foreground">{tr.total}</p>
                <p className="text-base font-extrabold text-foreground">
                  ${amountNum > 0 ? formatDollars(amountNum) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={handlePay}
                disabled={verifying || !rangeAmountValid || rpPhoneBlock || ultraSmart.paused || (ultraSmart.noHistory && !ultraSmart.acknowledged) /* REFILL-PREVENT-1024 // ULTRA-SMART-PREVENT-1024 */}
                className="flex-[2] h-[46px] rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm transition-colors active:scale-[0.97] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: bc }}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? tr.verifying : tr.payNow}
              </button>
            </div>
          )}

          {/* Cricket-only long-form content: payment steps + extended FAQ.
              Rendered above the API FAQ block to give the page the depth
              required to outrank competing Cricket Quick Pay results. */}
          {carrierSlug === "topup-crc" && lang !== "es" && !bill && ( // BILLPAY-CRICKET-1023: these bill pages show only their matching FAQ
            <CricketQuickPayContent brandColor={bc} />
          )}

          {/* AT&T / Straight Talk / Verizon long-form content: refill steps,
              supported plans, keyword-focused headings, and extended FAQ. */}
          {LONG_FORM_BY_SLUG[carrierSlug] && lang !== "es" && (
            <CarrierLongFormContent
              brandColor={bc}
              config={LONG_FORM_BY_SLUG[carrierSlug].config}
              idPrefix={carrierSlug}
            />
          )}



          {/* FAQs from API. SIMPLE-SPEC-1-1009: Simple Mobile shows its 8-question FAQ open (text = the raw-HTML FAQPage JSON-LD). */}
          {isSimple ? (
            <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10" data-testid="simple-faq">
              <h2 className="text-2xl font-extrabold text-foreground mb-4 text-left">{SIMPLE_FAQ_TITLE[sl]}</h2>
              {simpleFaqs(sl).map((f) => (
                <div key={f.q} className="mb-4 text-left">
                  <h3 className="font-bold" style={{ color: bc }}>{f.q}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
                </div>
              ))}
            </section>
          ) : bill ? (
            /* SEO-CONTENT-1014: 4-question FAQ (text = the FAQPage JSON-LD), shown instead of the API FAQ on these pages */
            <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10" data-testid="bill-faq">
              {bill.preFaq && (<><h2 className="text-2xl font-extrabold text-foreground mb-2 text-left">{bill.preFaq[0]}</h2><p className="text-sm text-muted-foreground mb-6 text-left">{bill.preFaq[1]}</p></>)} {/* ORGANIC-TMO-REFILL-ONLINE-FAQ-1027 */}
              <h2 className="text-2xl font-extrabold text-foreground mb-4 text-left">{bill.faqTitle}</h2>
              {bill.faqs.map((f) => (
                <div key={f.q} className="mb-4 text-left">
                  <h3 className="font-bold" style={{ color: bc }}>{f.q}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
                </div>
              ))}
              {carrierSlug === "topup-crc" && bill.guide && ( // BILLPAY-CRICKET-1023
                <p className="text-sm mt-4 text-left"><a href={bill.guide[0]} className="underline">{bill.guide[1]}</a></p> /* BILLPAY-CRICKET-1023 */
              )} {/* BILLPAY-CRICKET-1023 */}
              {bill.more?.map(([href, label]) => ( // BILLPAY-BOOST-1022
                <p key={href} className="text-sm mt-2 text-left"><a href={href} className="underline">{label}</a></p>
              ))}
            </section>
          ) : shownFaqs.length > 0 && (
            <DynamicFAQ faqs={shownFaqs} carrierName={faqName} brandColor={bc} lang={lang} />
          )}

          {/* AEO-03-04-1008: link to this carrier's how-to-pay guide (EN/ES), real <a href> for crawlers */}
          {HTP_GUIDE_BY_SLUG[carrierSlug] && (
            <p className="max-w-3xl mx-auto px-4 py-4 text-sm text-center">
              <a
                href={(lang === "es" ? "/es/como-pagar/" : "/how-to-pay/") + HTP_GUIDE_BY_SLUG[carrierSlug].key}
                className="underline"
              >
                {isSimple
                  ? SIMPLE_LINKS[sl].guide[1]
                  : carrierSlug === "boost" // SEO-CONTENT-1014
                  ? (lang === "es" ? "Cómo pagar Boost Mobile" : "How to pay Boost Mobile")
                  : carrierSlug === "net10" // AEO-09-NET10-1015
                  ? (lang === "es" ? "Cómo pagar Net10 Wireless" : "How to pay Net10 Wireless")
                  : carrierSlug === "ultra-mobile" // AEO-11-ULTRA-1017
                  ? (lang === "es" ? "Cómo pagar Ultra Mobile" : "How to pay Ultra Mobile") // AEO-11-ULTRA-1017
                  : carrierSlug === "pageplus" // AEO-13-PAGEPLUS-1019
                  ? (lang === "es" ? "Cómo pagar Page Plus" : "How to pay Page Plus") // AEO-13-PAGEPLUS-1019
                  : carrierSlug === "total-wireless" // AEO-14-TOTAL-1020
                  ? (lang === "es" ? "Cómo pagar Total Wireless" : "How to pay Total Wireless") // AEO-14-TOTAL-1020
                  : carrierSlug === "tracfone" // AEO-12-TRACFONE-1018
                  ? (lang === "es" ? "Cómo pagar Tracfone" : "How to pay Tracfone") // AEO-12-TRACFONE-1018
                  : carrierSlug === "h2o" // AEO-10-H2O-1016
                  ? (lang === "es" ? "Cómo pagar H2O Wireless" : "How to pay H2O")
                  : carrierSlug === "metropcs" // GSC-MAULIK-1014
                  ? (lang === "es" ? "Cómo pagar Metro by T-Mobile" : "How to pay Metro by T-Mobile")
                  : lang === "es"
                  ? `Cómo pagar su factura de ${HTP_GUIDE_BY_SLUG[carrierSlug].name} en línea`
                  : `How to pay your ${HTP_GUIDE_BY_SLUG[carrierSlug].name} bill online`}
              </a>
            </p>
          )}
          {window.location.pathname.replace(/\/+$/, "") === "/guest-boost.html" && ( // BILLPAY-BOOST-1022
            <p className="max-w-3xl mx-auto px-4 py-2 text-sm text-center"><a href="/boost.html" className="underline">Pay your Boost Mobile bill online</a></p>
          )}
          {/* SIMPLE-SPEC-1-1009: language switch /s1.html <-> /es/s1.html */}
          {isSimple && (
            <p className="max-w-3xl mx-auto px-4 pb-4 text-sm text-center">
              <a href={SIMPLE_LINKS[sl].other[0]} hrefLang={sl === "es" ? "en" : "es"} className="underline">{SIMPLE_LINKS[sl].other[1]}</a>
            </p>
          )}
        </>
      )}

      <PaymentBar lang={lang} />
      <CarrierFooter brandColor={bc} carrierName={trademarkCarrierName(carrierName)} lang={lang} />
    </div>
  );
};

/* AEO-03-04-1008: carrier slug -> how-to-pay guide (/how-to-pay/{key}, /es/como-pagar/{key}) */
const HTP_GUIDE_BY_SLUG: Record<string, { key: string; name: string }> = {
  s1: { key: "simple-mobile", name: "Simple Mobile" },
  tmobile: { key: "t-mobile-prepaid", name: "T-Mobile Prepaid" },
  "straight-talk": { key: "straight-talk", name: "Straight Talk" },
  "topup-at": { key: "att-prepaid", name: "AT&T Prepaid" },
  verizon: { key: "verizon-prepaid", name: "Verizon Prepaid" }, // TOP4-T4-1009: /verizon, /es/verizon
  lyca: { key: "lyca-mobile", name: "Lyca Mobile" }, // AEO-06-LYCA-1011: /lyca.html, /es/lyca.html
  metropcs: { key: "metro-pcs", name: "Metro by T-Mobile" }, // AEO-07-METRO-1012: /metropcs.html, /es/metropcs.html
  boost: { key: "boost-mobile", name: "Boost Mobile" }, // SEO-CONTENT-1014: /boost.html, /es/boost.html, /guest-boost.html
  net10: { key: "net10", name: "Net10 Wireless" }, // AEO-09-NET10-1015: /net10.html, /es/net10.html, /guest-net10.html
  "ultra-mobile": { key: "ultra-mobile", name: "Ultra Mobile" }, // AEO-11-ULTRA-1017
  "tracfone": { key: "tracfone", name: "Tracfone" }, // AEO-12-TRACFONE-1018
  "pageplus": { key: "page-plus", name: "Page Plus" }, // AEO-13-PAGEPLUS-1019
  "total-wireless": { key: "total-wireless", name: "Total Wireless" }, // AEO-14-TOTAL-1020
  h2o: { key: "h2o", name: "H2O Wireless" }, // AEO-10-H2O-1016: /h2o.html, /es/h2o.html, /guest-h2o.html
};

/* ── FAQ sub-component ── */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DynamicFAQ = ({
  faqs,
  carrierName,
  brandColor,
  lang = "en",
}: {
  faqs: Array<{ question: string; answer: string }>;
  carrierName: string;
  brandColor: string;
  lang?: Language;
}) => {
  const tr = t(lang);
  return (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <h2 className="text-2xl font-extrabold text-foreground mb-4 text-left">
      {tr.faqsTitle(carrierName)}
    </h2>
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="text-left font-bold text-foreground" style={{ color: brandColor }}>
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
  );
};

export default DynamicCarrier;
