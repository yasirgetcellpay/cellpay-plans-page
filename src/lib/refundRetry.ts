export type RetryCause = "tmo_plan_mismatch" | "simple_not_found" | "metro_invalid_number" | "boost_blank"; // REFUND-RETRY-1018
export type RetryAction = "to_carrier" | "amount" | "number" | "try_again" | "other_carrier"; // REFUND-RETRY-1018
export type RetryContext = { v: 1; ts: number; cause: RetryCause; action: RetryAction; from_carrier: string; to_carrier: string; email?: string; method?: string }; // REFUND-RETRY-1018
export type RetryButton = { label: string; action: RetryAction; to_carrier?: string; notBefore?: number; disabled?: boolean }; // REFUND-RETRY-1018
const HIST = "cp_refund_hist_v1", CTX = "cp_refund_retry_v1", MIN = 60_000, DAY = 24 * 60 * MIN; // REFUND-RETRY-1018
const CAUSES: Record<string, RetryCause> = { tmobile: "tmo_plan_mismatch", s1: "simple_not_found", metropcs: "metro_invalid_number", boost: "boost_blank" }; // REFUND-RETRY-1018
const ACTIONS = ["to_carrier", "amount", "number", "try_again", "other_carrier"]; // REFUND-RETRY-1018
export const retryCauseFor = (slug: string): RetryCause | null => CAUSES[slug] ?? null; // REFUND-RETRY-1018
const TEXT: Record<RetryCause, { en: string; es: string }> = { // REFUND-RETRY-1018
  tmo_plan_mismatch: { en: "T-Mobile did not accept this refill for this number. It may be a monthly T-Mobile account, a Metro by T-Mobile number, or the amount may not fit the plan on this line.", es: "T-Mobile no aceptó esta recarga para este número. Puede ser una cuenta mensual de T-Mobile, un número de Metro by T-Mobile, o puede que el monto no corresponda al plan de esta línea." }, // REFUND-RETRY-1018
  simple_not_found: { en: "Simple Mobile could not find this number. It may be a Straight Talk, Total Wireless, Tracfone or NET10 number.", es: "Simple Mobile no encontró este número. Puede ser un número de Straight Talk, Total Wireless, Tracfone o NET10." }, // REFUND-RETRY-1018
  metro_invalid_number: { en: "Metro could not find this number. Please check the number: {phone}.", es: "Metro no encontró este número. Por favor revise el número: {phone}." }, // REFUND-RETRY-1018
  boost_blank: { en: "Boost did not accept this payment right now. Please check that this is a Boost Mobile number, or try again in a few minutes.", es: "Boost no aceptó este pago en este momento. Verifique que sea un número de Boost Mobile, o inténtelo de nuevo en unos minutos." }, // REFUND-RETRY-1018
}; // REFUND-RETRY-1018
export function retryReasonText(cause: RetryCause, lang: string, phone10: string): string { // REFUND-RETRY-1018
  const d = phone10.replace(/\D/g, "").slice(-10); // REFUND-RETRY-1018
  const phone = d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : ""; // REFUND-RETRY-1018
  return TEXT[cause][lang === "es" ? "es" : "en"].replace("{phone}", phone); // REFUND-RETRY-1018
} // REFUND-RETRY-1018
type History = Record<string, number[] | number>; // REFUND-RETRY-1018
function history(now: number): History { // REFUND-RETRY-1018
  try { // REFUND-RETRY-1018
    const raw: unknown = JSON.parse(localStorage.getItem(HIST) || "{}"); // REFUND-RETRY-1018
    const out: History = {}; // REFUND-RETRY-1018
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out; // REFUND-RETRY-1018
    for (const [key, value] of Object.entries(raw)) { // REFUND-RETRY-1018
      if (/^\d{10}\|[a-z0-9-]{1,30}$/.test(key) && Array.isArray(value)) { // REFUND-RETRY-1018
        const times = value.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t <= now && now - t < DAY).sort((a, b) => a - b).slice(-10); // REFUND-RETRY-1018
        if (times.length) out[key] = times; // REFUND-RETRY-1018
      } else if (/^try\|\d{10}$/.test(key) && typeof value === "number" && Number.isFinite(value) && value <= now && now - value < DAY) out[key] = value; // REFUND-RETRY-1018
    } // REFUND-RETRY-1018
    return out; // REFUND-RETRY-1018
  } catch { return {}; } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
function saveHistory(h: History): void { try { localStorage.setItem(HIST, JSON.stringify(h)); } catch { /* fail open */ } } // REFUND-RETRY-1018
export function recordRefund(phone10: string, slug: string, now: number): void { // REFUND-RETRY-1018
  try { // REFUND-RETRY-1018
    if (!/^\d{10}$/.test(phone10) || !retryCauseFor(slug) || !Number.isFinite(now)) return; // REFUND-RETRY-1018
    const h = history(now), key = `${phone10}|${slug}`, old = h[key]; // REFUND-RETRY-1018
    h[key] = [...(Array.isArray(old) ? old : []), now].slice(-10); saveHistory(h); // REFUND-RETRY-1018
  } catch { /* fail open */ } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function refundCount24h(phone10: string, slug: string, now = Date.now()): number { // REFUND-RETRY-1018
  try { const times = history(now)[`${phone10}|${slug}`]; return Array.isArray(times) ? times.length : 0; } catch { return 0; } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function recordRetryTap(phone10: string, now = Date.now()): void { // REFUND-RETRY-1018
  try { if (!/^\d{10}$/.test(phone10)) return; const h = history(now); h[`try|${phone10}`] = now; saveHistory(h); } catch { /* fail open */ } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function retryButtons(slug: string, lang: string, phone10: string, now = Date.now()): RetryButton[] { // REFUND-RETRY-1018
  const es = lang === "es", buttons: RetryButton[] = []; // REFUND-RETRY-1018
  const add = (en: string, spanish: string, action: RetryAction, to_carrier?: string) => buttons.push({ label: es ? spanish : en, action, ...(to_carrier ? { to_carrier } : {}) }); // REFUND-RETRY-1018
  if (slug === "tmobile") { add("Pay as Metro by T-Mobile", "Pagar como Metro by T-Mobile", "to_carrier", "metropcs"); add("Choose another amount", "Elegir otro monto", "amount", "tmobile"); add("Change number", "Cambiar número", "number"); } // REFUND-RETRY-1018
  if (slug === "s1") { for (const [label, target] of [["Straight Talk", "straight-talk"], ["Total Wireless", "total-wireless"], ["Tracfone", "tracfone"], ["NET10", "net10"]]) add(label, label, "to_carrier", target); add("Change number", "Cambiar número", "number"); } // REFUND-RETRY-1018
  if (slug === "metropcs") { add("Fix number", "Corregir número", "number"); add("It's a T-Mobile number", "Es un número de T-Mobile", "to_carrier", "tmobile"); add("Choose another carrier", "Elegir otra compañía", "other_carrier"); } // REFUND-RETRY-1018
  if (slug === "boost") { add("Try again", "Intentar de nuevo", "try_again", "boost"); add("Change number", "Cambiar número", "number"); add("Choose another carrier", "Elegir otra compañía", "other_carrier"); } // REFUND-RETRY-1018
  const h = history(now), times = h[`${phone10}|${slug}`], lastTry = h[`try|${phone10}`]; // REFUND-RETRY-1018
  return buttons.filter((b) => !(Array.isArray(times) && times.length >= 2 && (b.action === "amount" || b.action === "try_again")) && !(b.action === "try_again" && typeof lastTry === "number" && now - lastTry < 30 * MIN)).map((b) => { // REFUND-RETRY-1018
    if (b.action !== "try_again" || !Array.isArray(times) || !times.length) return b; // REFUND-RETRY-1018
    const notBefore = Math.max(...times) + 10 * MIN; // REFUND-RETRY-1018
    if (now >= notBefore) return { ...b, notBefore, disabled: false }; // REFUND-RETRY-1018
    const d = new Date(notBefore), hour = d.getHours(), time = `${hour % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`; // REFUND-RETRY-1018
    const label = es ? `Intentar de nuevo después de las ${time} ${hour >= 12 ? "p. m." : "a. m."}` : `Try again after ${time} ${hour >= 12 ? "PM" : "AM"}`; // REFUND-RETRY-1018
    return { ...b, notBefore, disabled: true, label }; // REFUND-RETRY-1018
  }); // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function writeRetryCtx(input: Omit<RetryContext, "v" | "ts">, now = Date.now()): void { // REFUND-RETRY-1018
  try { sessionStorage.setItem(CTX, JSON.stringify({ v: 1, ts: now, cause: input.cause, action: input.action, from_carrier: input.from_carrier, to_carrier: input.to_carrier, ...(input.email ? { email: input.email } : {}), ...(input.method ? { method: input.method } : {}) })); } catch { /* fail open */ } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function readRetryCtx(maxAgeMs = 30 * MIN): RetryContext | null { // REFUND-RETRY-1018
  try { // REFUND-RETRY-1018
    const r = JSON.parse(sessionStorage.getItem(CTX) || "null"), now = Date.now(); // REFUND-RETRY-1018
    if (!r || r.v !== 1 || typeof r.ts !== "number" || !Number.isFinite(r.ts) || now - r.ts < 0 || now - r.ts >= maxAgeMs || !Object.values(CAUSES).includes(r.cause) || !ACTIONS.includes(r.action) || typeof r.from_carrier !== "string" || !/^[a-z0-9-]{1,30}$/.test(r.from_carrier) || typeof r.to_carrier !== "string" || !/^[a-z0-9-]{1,30}$/.test(r.to_carrier)) return null; // REFUND-RETRY-1018
    return { v: 1, ts: r.ts, cause: r.cause, action: r.action, from_carrier: r.from_carrier, to_carrier: r.to_carrier, ...(typeof r.email === "string" && r.email.length <= 254 ? { email: r.email } : {}), ...(typeof r.method === "string" && /^[a-z]{2,20}$/.test(r.method) ? { method: r.method } : {}) }; // REFUND-RETRY-1018
  } catch { return null; } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function takeRetryPrefill(slug: string): { email?: string; method?: string } | null { // REFUND-RETRY-1018
  try { // REFUND-RETRY-1018
    const r = readRetryCtx(10 * MIN); if (!r || r.to_carrier !== slug) return null; // REFUND-RETRY-1018
    const { email, method, ...rest } = r; sessionStorage.setItem(CTX, JSON.stringify(rest)); return { email, method }; // REFUND-RETRY-1018
  } catch { return null; } // REFUND-RETRY-1018
} // REFUND-RETRY-1018
export function clearRetryCtx(): void { try { sessionStorage.removeItem(CTX); } catch { /* fail open */ } } // REFUND-RETRY-1018
