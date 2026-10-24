// LOADTEXT-PICK-1019: proxy-side copy of the LoadText category rules in src/lib/loadTextPick.ts (logging only; never changes a reply).
// Keep RULES, GENERIC_RE, splitLoadText and categorizeLoadText identical to that file.

export type LoadTextCategory = "number" | "plan" | "amount" | "cooldown" | "system" | "generic";

const RULES: Array<[Exclude<LoadTextCategory, "generic">, RegExp]> = [
  ["amount", /product not sold|resource not found|discontinued|denomination|invalid amount/i], // REFILL-ERROR-MSG-1024
  ["number", /subscriber not found|invalid\s*(phone\s*)?number|invalid\s*(min|mdn)\b|not a valid|phone number not found with the selected carrier|suspended|not found/i], // REFILL-ERROR-MSG-1024
  ["plan", /plan does not match|not eligible|does not qualify/i],
  ["cooldown", /refill was completed on this line recently|recent|already refilled|too soon/i], // REFILL-ERROR-MSG-1024
  ["system", /invalid transaction state|error on params|vendor system error|time\s*out|timed out|terminal refused/i], // REFILL-ERROR-MSG-1024
];
const GENERIC_RE = /invalid request|unprocessable|not approved/i; // REFILL-ERROR-MSG-1024
const ORDER: LoadTextCategory[] = ["number", "plan", "amount", "cooldown", "system", "generic"]; // REFILL-ERROR-MSG-1024

export function splitLoadText(text: unknown): string[] {
  return String(text ?? "")
    .split(/\s*\|\s*|\s+&\s+/)
    .map((p) => p.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 20);
}

export function categorizeLoadText(text: unknown): { category: LoadTextCategory; unknown: boolean; unknownParts: string[]; parts: string[] } | null {
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
  return { category: productUnavailable ? "amount" : invalidState && best >= ORDER.indexOf("amount") ? "system" : ORDER[best], unknown: unknownParts.length > 0, unknownParts, parts };
}


/** True when the parsed upstream body carries TransResult "ccRefund" (any case, up to 4 levels deep). Never throws. */
export function isCcRefundBody(body: unknown): boolean {
  const walk = (v: unknown, depth: number): boolean => {
    if (!v || typeof v !== "object" || Array.isArray(v) || depth > 4) return false;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (/^transresult$/i.test(k) && typeof x === "string" && /^\s*ccrefund\s*$/i.test(x)) return true;
      if (walk(x, depth + 1)) return true;
    }
    return false;
  };
  try { return walk(body, 0); } catch { return false; }
}
