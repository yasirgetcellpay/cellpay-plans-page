// LOADTEXT-REASON-1017 (REFUNDED-STATE-1017): map CellPay's load-failure reason (LoadText) to a simple customer sentence.
// Pure module. The raw LoadText is never shown to the customer; only the fixed sentences below are.

export type LoadReasonKind = "bad_number" | "bad_amount" | "paused" | "not_found";

const KEY_RE = /^(loadtext|load_text|loadmessage)$/i;

const asObj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const fromObj = (o: Record<string, unknown> | null): string | null => {
  if (!o) return null;
  for (const [k, v] of Object.entries(o)) {
    if (KEY_RE.test(k) && typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** reply.load_text, else LoadText / load_text / LoadMessage (any case) at reply.data, then reply.data.data. */
export function loadTextFrom(reply: unknown): string | null {
  try {
    const r = asObj(reply);
    if (!r) return null;
    if (typeof r.load_text === "string" && r.load_text.trim()) return r.load_text.trim();
    const d = asObj(r.data);
    return fromObj(d) ?? fromObj(asObj(d?.data));
  } catch {
    return null;
  }
}

/** Checked in this order: bad_number, bad_amount, paused, not_found. Anything else (or empty) -> null. */
export function loadReasonKind(text: string | null | undefined): LoadReasonKind | null {
  const s = String(text ?? "");
  if (!s.trim()) return null;
  if (/invalid\s*min|invalid\s*phone\s*number|not\s*a\s*valid\s*number|invalid\s*mdn|prepaid[_\s]?number/i.test(s)) return "bad_number";
  if (/invalid\s*amount|amount\s*not\s*allowed|denomination/i.test(s)) return "bad_amount";
  if (/\bpaus(e|ed)\b|paused\s*plan/i.test(s)) return "paused";
  if (/subscriber\s*not\s*found|resource\s*not\s*found|not\s*found/i.test(s)) return "not_found";
  return null;
}

const TEXTS: Record<LoadReasonKind, { en: string; es: string }> = {
  bad_number: { en: "This number isn't valid for {carrier}. Please check it and try again.", es: "Este número no es válido para {carrier}. Revíselo e inténtelo de nuevo." },
  bad_amount: { en: "That amount isn't allowed for this plan. Please choose another amount.", es: "Ese monto no está permitido para este plan. Elija otro monto." },
  paused: { en: "This line is on a paused plan.", es: "Esta línea tiene un plan en pausa." },
  not_found: { en: "We couldn't find this number with {carrier}.", es: "No encontramos este número con {carrier}." },
};

export function loadReasonText(kind: LoadReasonKind | null | undefined, lang: string, carrierName: string): string | null {
  if (!kind || !TEXTS[kind]) return null;
  return TEXTS[kind][lang === "es" ? "es" : "en"].split("{carrier}").join(String(carrierName || ""));
}
