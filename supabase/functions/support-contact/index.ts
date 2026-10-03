import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { restEventLogger, restRateLimiter, restSettings } from "../_shared/help-guard.ts";
import { makeSupportContactHandler, type SupportRow } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET = Deno.env.get("HELP_RATE_LIMIT_SALT") || SERVICE_KEY;

async function insert(row: SupportRow): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/support_requests`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row), // status defaults to 'new'
  });
  if (!res.ok) throw new Error(`support_insert_${res.status}`);
}

const missing = async () => { throw new Error("not_configured"); };

serve(makeSupportContactHandler({
  rateLimit: SUPABASE_URL && SERVICE_KEY ? restRateLimiter(SUPABASE_URL, SERVICE_KEY) : missing,
  insert,
  settings: SUPABASE_URL && SERVICE_KEY ? restSettings(SUPABASE_URL, SERVICE_KEY) : missing,
  logEvent: restEventLogger(SUPABASE_URL, SERVICE_KEY),
  secret: SECRET,
}));
