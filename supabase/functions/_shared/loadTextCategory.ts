// LOADTEXT-PICK-1019: proxy-side copy of the LoadText category rules in src/lib/loadTextPick.ts (logging only; never changes a reply).
// Keep RULES, GENERIC_RE, splitLoadText and categorizeLoadText identical to that file.

export type LoadTextCategory = "number" | "plan" | "amount" | "cooldown" | "generic";

const RULES: Array<[Exclude<LoadTextCategory, "generic">, RegExp]> = [
  ["number", /resource not found|invalid\s*(phone\s*)?number|invalid\s*(min|mdn)\b|not a valid|suspended|not found/i],
  ["plan", /plan does not match|not eligible|does not qualify/i],
  ["amount", /discontinued|amount|denomination/i],
  ["cooldown", /recent|already refilled|too soon/i],
];
const GENERIC_RE = /invalid request|unprocessable|time\s*out|timed out|not approved/i;
const ORDER: LoadTextCategory[] = ["number", "plan", "amount", "cooldown", "generic"];

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
  const unknownParts: string[] = [];
  for (const part of parts) {
    const hit = RULES.find(([, re]) => re.test(part));
    if (hit) best = Math.min(best, ORDER.indexOf(hit[0]));
    else if (!GENERIC_RE.test(part) && unknownParts.length < 5) unknownParts.push(part.slice(0, 80));
  }
  return { category: ORDER[best], unknown: unknownParts.length > 0, unknownParts, parts };
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
