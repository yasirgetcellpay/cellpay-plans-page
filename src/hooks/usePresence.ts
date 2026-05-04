import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "cellpay_presence_sid";

function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

export function usePresence() {
  const location = useLocation();

  useEffect(() => {
    // Don't track admin pages in presence
    if (location.pathname.startsWith("/admin")) return;

    const sid = getSessionId();
    const path = location.pathname + location.search;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;

    const ping = async () => {
      try {
        await supabase
          .from("page_visitors")
          .upsert(
            { session_id: sid, path, user_agent: ua, last_seen: new Date().toISOString() },
            { onConflict: "session_id" }
          );
      } catch {
        // ignore
      }
    };

    ping();
    const interval = window.setInterval(ping, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location.pathname, location.search]);
}
