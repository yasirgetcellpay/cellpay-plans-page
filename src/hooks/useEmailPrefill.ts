import { useEffect, useRef } from "react"; // ST-PREFILL-1018
import { resolveEmailPrefill } from "@/lib/checkoutResume"; // ST-PREFILL-1018
import { trackFunnel } from "@/lib/funnelEvents"; // ST-PREFILL-1018
// EMAIL-PREFILL-1013 / AUTOPAY-VISIBLE-1013: shared once-ready email hand-off. // ST-PREFILL-1018
export function useEmailPrefill(slug: string, ready: boolean, onResolved: (r: { phone: string; amount: number | null }) => void): void { // ST-PREFILL-1018
  const resolvedRef = useRef(onResolved); // ST-PREFILL-1018
  resolvedRef.current = onResolved; // ST-PREFILL-1018
  const done = useRef(false); // ST-PREFILL-1018
  useEffect(() => { // ST-PREFILL-1018
    if (!ready || done.current) return; // ST-PREFILL-1018
    done.current = true; // ST-PREFILL-1018
    let tok: string | null = null; // ST-PREFILL-1018
    try { tok = new URLSearchParams(window.location.search).get("t"); } catch { tok = null; } // ST-PREFILL-1018
    try { // ST-PREFILL-1018
      const q = new URLSearchParams(window.location.search); // ST-PREFILL-1018
      if (q.get("ap") === "1") sessionStorage.setItem("cp_email_ap", JSON.stringify({ slug, ts: Date.now() })); // ST-PREFILL-1018
      if (!tok && q.has("ap")) { // ST-PREFILL-1018
        const u = new URL(window.location.href); // ST-PREFILL-1018
        u.searchParams.delete("ap"); // ST-PREFILL-1018
        window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); // ST-PREFILL-1018
      } // ST-PREFILL-1018
    } catch { /* ignore */ } // ST-PREFILL-1018
    if (!tok) return; // ST-PREFILL-1018
    void (async () => { // ST-PREFILL-1018
      try { // ST-PREFILL-1018
        const r = await resolveEmailPrefill(slug, window.location.search); // ST-PREFILL-1018
        if (r) { // ST-PREFILL-1018
          resolvedRef.current(r); // ST-PREFILL-1018
          trackFunnel("prefill_used", { carrier: slug, amount: r.amount ?? null, fee: null, total: null }); // ST-PREFILL-1018
        } // ST-PREFILL-1018
      } catch { /* behave as today */ } // ST-PREFILL-1018
      try { // ST-PREFILL-1018
        const u = new URL(window.location.href); // ST-PREFILL-1018
        u.searchParams.delete("t"); // ST-PREFILL-1018
        u.searchParams.delete("ap"); // AUTOPAY-VISIBLE-1013 // ST-PREFILL-1018
        window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); // ST-PREFILL-1018
      } catch { /* ignore */ } // ST-PREFILL-1018
    })(); // ST-PREFILL-1018
  }, [slug, ready]); // ST-PREFILL-1018
} // ST-PREFILL-1018