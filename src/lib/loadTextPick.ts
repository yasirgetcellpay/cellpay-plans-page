// LOADTEXT-PICK-1019: pick the most specific customer reason from CellPay's LoadText on an auto-refunded (ccRefund) order.
// LoadText joins one error per vendor tried with " | "; a part may also join errors with " & ".
// Pure module, no imports. The raw LoadText is never shown to the customer; only the fixed sentences below are. No provider names.
// The category rules (RULES, GENERIC_RE, splitLoadText, categorizeLoadText) are copied in
// supabase/functions/_shared/loadTextCategory.ts for the proxy's logging; keep both copies identical.

export type LoadTextCategory = "number" | "plan" | "amount" | "cooldown" | "generic";
export type LoadPick = { category: LoadTextCategory; unknown: boolean; unknownParts: string[]; parts: string[] };
export type PickAction = "number" | "to_carrier" | "other_carrier" | "amount" | "ok";
export type PickButton = { label: string; action: PickAction; to_carrier?: string };

// Most specific first. First matching rule wins for a part; the lowest-numbered category across all parts is shown.
const RULES: Array<[Exclude<LoadTextCategory, "generic">, RegExp]> = [
  ["number", /resource not found|invalid\s*(phone\s*)?number|invalid\s*(min|mdn)\b|not a valid|suspended|not found/i],
  ["plan", /plan does not match|not eligible|does not qualify/i],
  ["amount", /discontinued|amount|denomination/i],
  ["cooldown", /recent|already refilled|too soon/i],
];
const GENERIC_RE = /invalid request|unprocessable|time\s*out|timed out|not approved/i;
const ORDER: LoadTextCategory[] = ["number", "plan", "amount", "cooldown", "generic"];

/** Split on " | " (also a bare "|") and " & "; trimmed, empty parts dropped, max 20 parts of 200 chars. */
export function splitLoadText(text: unknown): string[] {
  return String(text ?? "")
    .split(/\s*\|\s*|\s+&\s+/)
    .map((p) => p.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 20);
}

/** Category for every part; a part that matches no rule (not even a known generic one) is "unknown" and counts as generic. */
export function categorizeLoadText(text: unknown): { category: LoadTextCategory; unknown: boolean; unknownParts: string[]; parts: string[] } | null {
  const parts = splitLoadText(text);
  if (!parts.length) return null;
  let best = ORDER.length - 1;
  const unknownParts: string[] = [];
  for (const part of parts) {
    const hit = RULES.find(([, re]) => re.test(part));
    if (hit) best = Math.min(best, ORDER.indexOf(hit[0]));
    else if (!GENERIC_RE.test(part) && unknownParts.length < 5) unknownParts.push(part.slice(0, 80));
  }
  return { category: ORDER[best], unknown: unknownParts.length > 0, unknownParts, parts };
}

export function loadTextPick(text: unknown): LoadPick | null {
  try { return categorizeLoadText(text); } catch { return null; }
}

const KEY_RE = /^(loadtext|load_text|loadmessage)$/i;
const findKey = (v: unknown, keyRe: RegExp, depth: number): unknown => {
  if (!v || typeof v !== "object" || depth > 4) return undefined;
  if (Array.isArray(v)) return undefined;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (keyRe.test(k) && typeof x === "string" && x.trim()) return x;
  for (const x of Object.values(v as Record<string, unknown>)) { const r = findKey(x, keyRe, depth + 1); if (r !== undefined) return r; }
  return undefined;
};

/** reply.load_text (set by the proxy), else LoadText / load_text / LoadMessage (any case) anywhere up to 4 levels deep. */
export function loadTextFrom(reply: unknown): string | null {
  try {
    const r = reply && typeof reply === "object" ? (reply as Record<string, unknown>) : null;
    if (!r) return null;
    if (typeof r.load_text === "string" && r.load_text.trim()) return r.load_text.trim().slice(0, 500);
    const v = findKey(r, KEY_RE, 0);
    return typeof v === "string" ? v.trim().slice(0, 500) : null;
  } catch { return null; }
}

/** True when the reply carries TransResult "ccRefund" (any case, up to 4 levels deep): the order was refunded automatically. */
export function isCcRefund(reply: unknown): boolean {
  try { const v = findKey(reply, /^transresult$/i, 0); return typeof v === "string" && /^\s*ccrefund\s*$/i.test(v); } catch { return false; }
}

/** Metro, Boost and Cricket say "payment" / "pago", never "refill" / "recarga". */
export const isPayWordCarrier = (slug: unknown, name: unknown): boolean => /metro|boost|cricket/i.test(`${slug ?? ""} ${name ?? ""}`);

const TEXTS: Record<Exclude<LoadTextCategory, "cooldown" | "generic">, { en: string; es: string }> = {
  number: { en: "We couldn't find this number with {carrier}. Please double-check the number and carrier.", es: "No encontramos este número con {carrier}. Verifique el número y la compañía." },
  plan: { en: "This number is on a different plan type. Please check you picked the right carrier/plan.", es: "Este número tiene otro tipo de plan. Verifique que eligió la compañía y el plan correctos." },
  amount: { en: "This amount isn't available right now. Please try a different amount.", es: "Este monto no está disponible en este momento. Elija otro monto." },
};
const COOLDOWN = {
  refill: { en: "This number was just refilled. Please try again later.", es: "Este número acaba de recibir una recarga. Inténtelo de nuevo más tarde." },
  pay: { en: "A payment was just made on this number. Please try again later.", es: "Se acaba de hacer un pago en este número. Inténtelo de nuevo más tarde." },
};
const GENERIC = {
  refill: { en: "Your refill didn't go through. Please check the number and plan and try again.", es: "Su recarga no se completó. Revise el número y el plan e inténtelo de nuevo." },
  pay: { en: "Your payment didn't go through. Please check the number and plan and try again.", es: "Su pago no se completó. Revise el número y el plan e inténtelo de nuevo." },
};
export const PICK_REFUND_LINE = { en: "You have not been charged. Your payment was refunded.", es: "No se le ha cobrado. Su pago fue reembolsado." };

/** The reason sentence for a category (no refund line). `genericText` replaces the generic sentence when given (e.g. a carrier-specific reason). */
export function pickReasonText(category: LoadTextCategory, lang: string, carrierName: string, carrierSlug: string, genericText?: string | null): string {
  const l = lang === "es" ? "es" : "en";
  const w = isPayWordCarrier(carrierSlug, carrierName) ? "pay" : "refill";
  if (category === "cooldown") return COOLDOWN[w][l];
  if (category === "generic") return genericText || GENERIC[w][l];
  const carrier = String(carrierName || "").trim() || (l === "es" ? "su compañía" : "your carrier");
  return TEXTS[category][l].split("{carrier}").join(carrier);
}

export const pickRefundLine = (lang: string): string => PICK_REFUND_LINE[lang === "es" ? "es" : "en"];

/** Reason sentence + the refund line, as one string. */
export function pickFullText(category: LoadTextCategory, lang: string, carrierName: string, carrierSlug: string, genericText?: string | null): string {
  return `${pickReasonText(category, lang, carrierName, carrierSlug, genericText)} ${pickRefundLine(lang)}`;
}

/**
 * Refund-card buttons for the matched reason. `base` = the carrier's existing REFUND-RETRY-1018 buttons (or []).
 * number -> edit number first; plan -> switch carrier first; amount -> pick another amount; cooldown -> no retry (OK only).
 * generic -> null: the caller keeps its existing buttons unchanged.
 */
export function pickButtons(category: LoadTextCategory, lang: string, base: Array<{ label: string; action: string; to_carrier?: string }> = []): PickButton[] | null {
  const es = lang === "es";
  const carriers: PickButton[] = base.filter((b) => b.action === "to_carrier" && b.to_carrier).map((b) => ({ label: b.label, action: "to_carrier", to_carrier: b.to_carrier }));
  const switchCarrier: PickButton[] = carriers.length ? carriers : [{ label: es ? "Elegir otra compañía" : "Choose another carrier", action: "other_carrier" }];
  const changeNumber: PickButton = { label: es ? "Cambiar número" : "Change number", action: "number" };
  if (category === "number") return [{ label: es ? "Corregir número" : "Edit number", action: "number" }, ...switchCarrier];
  if (category === "plan") return [...switchCarrier, changeNumber];
  if (category === "amount") return [{ label: es ? "Elegir otro monto" : "Choose another amount", action: "amount" }, changeNumber];
  if (category === "cooldown") return [{ label: es ? "Entendido" : "OK", action: "ok" }];
  return null;
}
