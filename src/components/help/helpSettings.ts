// Runtime switch for the help chat: one read of public.help_settings (id = 1, three booleans, anon column grant),
// cached 5 minutes per tab in sessionStorage. Any error = everything OFF (fail closed: no launcher, no forms).
// Imported only by the lazy HelpChat chunk, never by App.tsx.
import { supabase } from "@/integrations/supabase/client";

export interface HelpFlags { chat_enabled: boolean; status_enabled: boolean; contact_enabled: boolean; }

export const HELP_FLAGS_OFF: HelpFlags = { chat_enabled: false, status_enabled: false, contact_enabled: false };
export const HELP_SETTINGS_CACHE_KEY = "cp-help-settings-v1";
export const HELP_SETTINGS_TTL_MS = 5 * 60_000;

/** Strict parse: only real booleans count; anything else is OFF. */
export function parseHelpFlags(row: unknown): HelpFlags {
  const r = (row && typeof row === "object") ? row as Record<string, unknown> : {};
  return {
    chat_enabled: r.chat_enabled === true,
    status_enabled: r.status_enabled === true,
    contact_enabled: r.contact_enabled === true,
  };
}

// help_settings is created by the #9 migration; the generated Database types may not list it yet, so the query
// goes through a minimal structural type instead of the generated one.
type MinimalQuery = {
  from: (t: string) => {
    select: (c: string) => { eq: (k: string, v: number) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } };
  };
};

let inflight: Promise<HelpFlags> | null = null;

export function helpSettings(): Promise<HelpFlags> {
  try {
    const raw = sessionStorage.getItem(HELP_SETTINGS_CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { at?: number; flags?: unknown };
      if (typeof c.at === "number" && Date.now() - c.at < HELP_SETTINGS_TTL_MS) return Promise.resolve(parseHelpFlags(c.flags));
    }
  } catch { /* storage blocked: fall through to a live read */ }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await (supabase as unknown as MinimalQuery)
        .from("help_settings").select("chat_enabled,status_enabled,contact_enabled").eq("id", 1).maybeSingle();
      if (error || !data) return HELP_FLAGS_OFF;
      const flags = parseHelpFlags(data);
      try { sessionStorage.setItem(HELP_SETTINGS_CACHE_KEY, JSON.stringify({ at: Date.now(), flags })); } catch { /* ignore */ }
      return flags;
    } catch {
      return HELP_FLAGS_OFF;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
