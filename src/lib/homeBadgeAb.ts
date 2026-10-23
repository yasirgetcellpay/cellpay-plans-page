// HOME-INSTANT-BADGE-1023: homepage-only "Instant refill" badge A/B test. Sticky 50/50 via cookie cp_hb, fail-safe to control.
export const HOME_BADGE_ENABLED = true; // HOME-INSTANT-BADGE-1023: set false to turn off (nobody sees badge, nothing logged)
export const HOME_BADGE_AB_END = "2026-10-30T23:00:00Z"; // HOME-INSTANT-BADGE-1023

export type HomeBadgeGroup = "badge" | "control";
const ID_OK = /^[0-9a-z-]{8,64}$/i;

function readCookie(name: string): string {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}

function newId(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 32);
}

/** Device id that already reaches orders as transaction_logs.metadata.mf_did (same localStorage key / cookie / format). */
function visitorId(): string {
  try { const v = localStorage.getItem("cp_did"); if (v && ID_OK.test(v)) return v.toLowerCase(); } catch { /* ignore */ }
  const c = readCookie("cp_did");
  if (c && ID_OK.test(c)) return c.toLowerCase();
  const id = newId();
  try { localStorage.setItem("cp_did", id); } catch { /* ignore */ }
  try { document.cookie = `cp_did=${encodeURIComponent(id)}; path=/; Max-Age=${2 * 365 * 24 * 3600}; SameSite=Lax`; } catch { /* ignore */ }
  return id.toLowerCase();
}

/** Returns the group for this browser, or null when the test is off/ended (everyone sees control, nothing logged). */
export function getHomeBadgeGroup(now: number = Date.now()): { group: HomeBadgeGroup; vid: string } | null {
  try {
    if (!HOME_BADGE_ENABLED) return null;
    if (now >= Date.parse(HOME_BADGE_AB_END)) return null;
    const raw = readCookie("cp_hb");
    const [g, v] = raw.split(".");
    if ((g === "badge" || g === "control") && v && ID_OK.test(v)) return { group: g, vid: v };
    const group: HomeBadgeGroup = Math.random() < 0.5 ? "badge" : "control";
    const vid = visitorId();
    document.cookie = `cp_hb=${group}.${vid}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax; Secure`;
    return { group, vid };
  } catch { return null; }
}

/** Fire-and-forget exposure log, once per browser session. Never throws, never awaited. */
export function logHomeBadgeExposure(group: HomeBadgeGroup, vid: string, lang: string): void {
  try {
    if (!HOME_BADGE_ENABLED) return;
    if (sessionStorage.getItem("cp_hb_logged")) return;
    sessionStorage.setItem("cp_hb_logged", "1");
    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/funnel-event`;
    const body = JSON.stringify({ event: "home_badge_exposure", hb_group: group, hb_vid: vid, lang: lang.slice(0, 8), client_ts: new Date().toISOString() });
    fetch(url, { method: "POST", headers: { "content-type": "text/plain" }, body, keepalive: true }).catch(() => {});
  } catch { /* never affects render */ }
}
