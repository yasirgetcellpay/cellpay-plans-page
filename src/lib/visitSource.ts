// AI-REFERRALS-1010: analytics only. Records WHERE a visit came from (referrer host, utm_source, utm_medium, landing path without query string)
// once per browser tab session, so AI answer-engine traffic (chatgpt.com, perplexity.ai, gemini, copilot, ...) can be counted.
// No personal data: no query string, no full referrer URL, no click IDs. Fire-and-forget; every failure is swallowed.
// Deliberately separate from checkout, payments and conversion tags. It runs after the page is idle and never blocks anything.
import { supabase } from "@/integrations/supabase/client";

const FLAG = "cp_vs_sent";
const SESSION_KEY = "cellpay_presence_sid"; // same anonymous id the visitor presence ping already uses

const clean = (v: string | null | undefined, n: number): string | null => {
  const s = (v ?? "").trim().toLowerCase().replace(/[^a-z0-9._:\-\s]/g, "").slice(0, n);
  return s || null;
};

export function recordVisitSource(): void {
  try {
    if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return;
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
    const sid = localStorage.getItem(SESSION_KEY);
    if (!sid) return;
    const own = /(^|\.)cellpay\.us$/i;
    let refHost: string | null = null;
    try {
      if (document.referrer) {
        const h = new URL(document.referrer).hostname.toLowerCase();
        refHost = own.test(h) ? null : h.slice(0, 100);
      }
    } catch { /* ignore */ }
    const q = new URLSearchParams(window.location.search);
    const args = {
      _session_id: sid,
      _referrer_host: refHost,
      _utm_source: clean(q.get("utm_source"), 60),
      _utm_medium: clean(q.get("utm_medium"), 60),
      _landing_path: window.location.pathname.slice(0, 200),
      _host: window.location.hostname.slice(0, 60),
    };
    // AI-REFERRALS-1010b: keep the same three values for this tab so the order row can carry them (read by apiWrapper.submitTransaction).
    try { sessionStorage.setItem("cp_vs", JSON.stringify({ ref_host: refHost, utm_source: args._utm_source, landing_path: args._landing_path })); } catch { /* ignore */ }
    const send = () => {
      try {
        const c = supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<unknown> };
        void Promise.resolve(c.rpc("record_visit_source", args)).catch(() => undefined);
      } catch { /* ignore */ }
    };
    window.setTimeout(send, 3000);
  } catch { /* ignore */ }
}
