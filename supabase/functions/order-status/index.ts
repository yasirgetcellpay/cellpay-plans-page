import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { restEventLogger, restRateLimiter, restSettings } from "../_shared/help-guard.ts";
import { makeOrderStatusHandler, ordersQueryUrl, type OrderRow } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET = Deno.env.get("HELP_RATE_LIMIT_SALT") || SERVICE_KEY;

async function findOrders(phone10: string): Promise<OrderRow[]> {
  const res = await fetch(ordersQueryUrl(SUPABASE_URL, phone10), {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`orders_query_${res.status}`);
  return (await res.json()) as OrderRow[];
}

const missing = async () => { throw new Error("not_configured"); };

serve(makeOrderStatusHandler({
  rateLimit: SUPABASE_URL && SERVICE_KEY ? restRateLimiter(SUPABASE_URL, SERVICE_KEY) : missing,
  findOrders,
  settings: SUPABASE_URL && SERVICE_KEY ? restSettings(SUPABASE_URL, SERVICE_KEY) : missing,
  logEvent: restEventLogger(SUPABASE_URL, SERVICE_KEY),
  secret: SECRET,
}));
