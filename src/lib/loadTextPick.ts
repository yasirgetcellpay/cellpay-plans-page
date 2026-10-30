// LOADTEXT-PICK-1019: pick the most specific customer reason from CellPay's LoadText on an auto-refunded (ccRefund) order.
// LoadText joins one error per vendor tried with " | "; a part may also join errors with " & ".
// Pure module, no imports. The raw LoadText is never shown to the customer; only the fixed sentences below are. No provider names.
// The category rules (RULES, GENERIC_RE, splitLoadText, categorizeLoadText) are copied in
// supabase/functions/_shared/loadTextCategory.ts for the proxy's logging; keep both copies identical.

export type LoadTextCategory = "number" | "plan" | "amount" | "cooldown" | "system" | "generic";
export type LoadPick = { category: LoadTextCategory; unknown: boolean; unknownParts: string[]; parts: string[] };
export type PickAction = "number" | "to_carrier" | "other_carrier" | "amount" | "try_again" | "ok";
export type PickButton = { label: string; action: PickAction; to_carrier?: string };

// Most specific first. First matching rule wins for a part; the lowest-numbered category across all parts is shown.
const RULES: Array<[Exclude<LoadTextCategory, "generic">, RegExp]> = [
  ["amount", /product not sold|resource not found|discontinued|denomination|invalid amount/i], // REFILL-ERROR-MSG-1024
  ["number", /subscriber not found|invalid\s*(phone\s*)?number|invalid\s*(min|mdn)\b|not a valid|phone number not found with the selected carrier|suspended|not found/i], // REFILL-ERROR-MSG-1024
  ["plan", /plan does not match|not eligible|does not qualify/i],
  ["cooldown", /refill was completed on this line recently|recent|already refilled|too soon/i], // REFILL-ERROR-MSG-1024
  ["system", /invalid transaction state|error on params|vendor system error|time\s*out|timed out|terminal refused/i], // REFILL-ERROR-MSG-1024
];
const GENERIC_RE = /invalid request|unprocessable|not approved/i; // REFILL-ERROR-MSG-1024
const ORDER: LoadTextCategory[] = ["number", "plan", "amount", "cooldown", "system", "generic"]; // REFILL-ERROR-MSG-1024

/** Split on " | " (also a bare "|") and " & "; trimmed, empty parts dropped, max 20 parts of 200 chars. */
export function splitLoadText(text: unknown): string[] {
  return String(text ?? "")
    .split(/\s*\|\s*|\s+&\s+/)
    .map((p) => p.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 20);
}

/** Category for every part; a part that matches no rule (not even a known generic one) is "unknown" and counts as generic. */
export function categorizeLoadText(text: unknown, carrierSlug?: string): { category: LoadTextCategory; unknown: boolean; unknownParts: string[]; parts: string[] } | null { // ULTRA-MSG-1024
  const parts = splitLoadText(text);
  if (!parts.length) return null;
  let best = ORDER.length - 1;
  let productUnavailable = false, invalidState = false; // REFILL-ERROR-MSG-1024
  const unknownParts: string[] = [];
  for (const part of parts) {
    const hit = RULES.find(([, re]) => re.test(part));
    if (hit) { // REFILL-ERROR-MSG-1024
      best = Math.min(best, ORDER.indexOf(hit[0]));
      if (hit[0] === "amount" && /product not sold|resource not found/i.test(part)) productUnavailable = true;
      if (hit[0] === "system" && /invalid transaction state/i.test(part)) invalidState = true;
    }
    else if (!GENERIC_RE.test(part) && unknownParts.length < 5) unknownParts.push(part.slice(0, 80));
  }
  const ultraAmount = carrierSlug === "ultra-mobile" && parts.some((part) => /1065|invalid amount/i.test(part)); // ULTRA-MSG-1024
  return { category: ultraAmount || productUnavailable ? "amount" : invalidState && best >= ORDER.indexOf("amount") ? "system" : ORDER[best], unknown: unknownParts.length > 0, unknownParts, parts }; // ULTRA-MSG-1024
}

export function loadTextPick(text: unknown, carrierSlug?: string): LoadPick | null { // ULTRA-MSG-1024
  try { return categorizeLoadText(text, carrierSlug); } catch { return null; } // ULTRA-MSG-1024
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

// REFILL-ERROR-MSG-1024
const TEXTS: Record<Exclude<LoadTextCategory, "cooldown" | "generic">, { en: string; es: string }> = {
  number: { en: "This number isn't active on {carrier}. Check the number or pick a different carrier.", es: "Este número no está activo con {carrier}. Revise el número o elija otra compañía." },
  plan: { en: "This plan doesn't match your line's plan. Pick your current plan.", es: "Este plan no coincide con el plan de su línea. Elija su plan actual." },
  amount: { en: "This amount isn't available right now. Pick another amount.", es: "Este monto no está disponible ahora. Elija otro monto." },
  system: { en: "The carrier's system had a problem. You weren't charged. Please try again in a few minutes.", es: "El sistema de la compañía tuvo un problema. No se le cobró. Inténtelo de nuevo en unos minutos." }, // REFILL-ERROR-MSG-1024
};
// REFILL-ERROR-MSG-1024: fixed customer wording only; never raw reply parts.
const COOLDOWN = {
  refill: { en: "This line was just refilled. Check your balance before paying again.", es: "Esta línea acaba de recibir una recarga. Revise su saldo antes de pagar otra vez." },
  pay: { en: "This line was just refilled. Check your balance before paying again.", es: "Esta línea acaba de recibir una recarga. Revise su saldo antes de pagar otra vez." },
};
const GENERIC = {
  refill: { en: "Your refill didn't go through. Please check the number and plan and try again.", es: "Su recarga no se completó. Revise el número y el plan e inténtelo de nuevo." },
  pay: { en: "Your payment didn't go through. Please check the number and plan and try again.", es: "Su pago no se completó. Revise el número y el plan e inténtelo de nuevo." },
};
export const PICK_REFUND_LINE = { en: "You have not been charged. Your payment was refunded.", es: "No se le ha cobrado. Su pago fue reembolsado." };

/** The reason sentence for a category (no refund line). `genericText` replaces the generic sentence when given (e.g. a carrier-specific reason). */
export function pickReasonText(category: LoadTextCategory, lang: string, carrierName: string, carrierSlug: string, genericText?: string | null, loadText?: string): string { // ULTRA-MSG-1024
  const l = lang === "es" ? "es" : "en";
  if (category === "number" && /metro/i.test(`${carrierSlug ?? ""} ${carrierName ?? ""}`)) return l === "es" ? "No se puede hacer el pago de Metro para este número. Revise que el número de teléfono esté correcto e inténtelo de nuevo." : "This number can't be paid with Metro. Check that the phone number is correct and try again."; // METRO-INVALID-PHONE-UX-1030
  if (carrierSlug === "ultra-mobile" && category === "amount" && /1065|invalid amount/i.test(loadText || "")) return l === "es" ? "Este monto no coincide con su plan de Ultra. Elija el plan que tiene su línea ahora." : "This amount doesn't match your Ultra plan. Pick the plan your line has now."; // ULTRA-MSG-1024
  if (carrierSlug === "ultra-mobile" && category === "number" && /subscriber not found/i.test(loadText || "")) return l === "es" ? "Ultra no encontró este número. Revise el número e inténtelo de nuevo." : "Ultra couldn't find this number. Please check the number and try again."; // ULTRA-MSG-1024
  const w = isPayWordCarrier(carrierSlug, carrierName) ? "pay" : "refill";
  if (category === "cooldown") return COOLDOWN[w][l];
  if (category === "generic") return genericText || GENERIC[w][l];
  const carrier = String(carrierName || "").trim() || (l === "es" ? "su compañía" : "your carrier");
  return TEXTS[category][l].split("{carrier}").join(carrier);
}

export const pickRefundLine = (lang: string, category: LoadTextCategory = "generic"): string => category === "generic" ? PICK_REFUND_LINE[lang === "es" ? "es" : "en"] : (lang === "es" ? "No se le cobró. Su pago fue reembolsado." : "You were not charged. Your payment was refunded."); // REFILL-ERROR-MSG-1024

/** Reason sentence + the refund line, as one string. */
export function pickFullText(category: LoadTextCategory, lang: string, carrierName: string, carrierSlug: string, genericText?: string | null): string {
  return `${pickReasonText(category, lang, carrierName, carrierSlug, genericText)} ${pickRefundLine(lang, category)}`;
}

/**
 * Refund-card buttons for the matched reason. `base` = the carrier's existing REFUND-RETRY-1018 buttons (or []).
 * number -> edit number first; plan -> switch carrier first; amount -> pick another amount; cooldown -> no retry (OK only).
 * generic -> null: the caller keeps its existing buttons unchanged.
 */
export function pickButtons(category: LoadTextCategory, lang: string, base: Array<{ label: string; action: string; to_carrier?: string }> = [], carrierSlug?: string): PickButton[] | null { // METRO-INVALID-PHONE-UX-1030
  const es = lang === "es";
  if (category === "number" && /metro/i.test(carrierSlug ?? "")) return [{ label: es ? "Corregir número" : "Edit number", action: "number" }]; // METRO-INVALID-PHONE-UX-1030
  if (category === "number") return [{ label: es ? "Corregir número" : "Edit number", action: "number" }, { label: es ? "Elegir otra compañía" : "Choose another carrier", action: "other_carrier" }]; // REFILL-ERROR-MSG-1024
  if (category === "plan") return [{ label: es ? "Elegir plan" : "Choose plan", action: "amount" }]; // REFILL-ERROR-MSG-1024: existing amount action opens the same carrier plan list
  if (category === "amount") return [{ label: es ? "Elegir otro monto" : "Choose another amount", action: "amount" }]; // REFILL-ERROR-MSG-1024
  if (category === "system") return [{ label: es ? "Intentar de nuevo" : "Try again", action: "try_again" }]; // REFILL-ERROR-MSG-1024
  if (category === "cooldown") return [{ label: es ? "Entendido" : "OK", action: "ok" }];
  return null;
}
