import { createClient } from "npm:@supabase/supabase-js@2"; // ULTRA-SMART-PREVENT-1024
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors"; // ULTRA-SMART-PREVENT-1024
import { clientIp, bucketKey } from "../_shared/help-guard.ts"; // ULTRA-SMART-PREVENT-1024
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); // ULTRA-SMART-PREVENT-1024
Deno.serve(async (req) => { // ULTRA-SMART-PREVENT-1024
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders }); // ULTRA-SMART-PREVENT-1024
  if (req.method !== "GET") return reply({}, 405); // ULTRA-SMART-PREVENT-1024
  const phone = new URL(req.url).searchParams.get("phone"); // ULTRA-SMART-PREVENT-1024
  if (!phone || !/^\d{10}$/.test(phone)) return reply({}, 400); // ULTRA-SMART-PREVENT-1024
  if ((Deno.env.get("ULTRA_LAST_PLAN") ?? "on") !== "on") return reply({}, 503); // ULTRA-SMART-PREVENT-1024
  try { // ULTRA-SMART-PREVENT-1024
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // ULTRA-SMART-PREVENT-1024
    if (!url || !key) return reply({}, 503); // ULTRA-SMART-PREVENT-1024
    const db = createClient(url, key); const deadline = AbortSignal.timeout(1900); // ULTRA-SMART-PREVENT-1024
    const bucket = await bucketKey(key, "ultra-history-ip", clientIp(req).ip ?? "unknown"); // ULTRA-SMART-PREVENT-1024
    const { data: allowed, error: limiterError } = await db.rpc("help_rate_limit_hit", { _bucket: bucket, _max: 120, _window_seconds: 600 }).abortSignal(deadline); // ULTRA-SMART-PREVENT-1024
    if (limiterError) return reply({}, 503); if (allowed !== true) return reply({}, 429); // ULTRA-SMART-PREVENT-1024
    const { data, error } = await db.from("transaction_logs").select("amount,plan_id,created_at").eq("carrier_slug", "ultra-mobile").eq("phone_number", phone).eq("status", "success").is("refunded_at", null).gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(1).abortSignal(deadline); // ULTRA-SMART-PREVENT-1024
    if (error) return reply({}, 503); const row = data?.[0]; // ULTRA-SMART-PREVENT-1024
    return row && row.plan_id && Number(row.amount) > 0 ? reply({ amount: Number(row.amount), plan_id: String(row.plan_id), date: row.created_at }) : reply({}); // ULTRA-SMART-PREVENT-1024
  } catch { return reply({}, 503); } // ULTRA-SMART-PREVENT-1024
}); // ULTRA-SMART-PREVENT-1024