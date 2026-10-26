import { createClient } from "npm:@supabase/supabase-js@2"; // REFILL-PREVENT-TMO-1026
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors"; // REFILL-PREVENT-TMO-1026
import { clientIp, bucketKey } from "../_shared/help-guard.ts"; // REFILL-PREVENT-TMO-1026
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); // REFILL-PREVENT-TMO-1026
Deno.serve(async (req) => { // REFILL-PREVENT-TMO-1026
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders }); // REFILL-PREVENT-TMO-1026
  if (req.method !== "GET") return reply({}, 405); // REFILL-PREVENT-TMO-1026
  let phone = (new URL(req.url).searchParams.get("phone") ?? "").replace(/\D/g, ""); // REFILL-PREVENT-TMO-1026
  if (phone.length === 11 && phone.startsWith("1")) phone = phone.slice(1); // REFILL-PREVENT-TMO-1026
  if (!/^\d{10}$/.test(phone)) return reply({}, 400); // REFILL-PREVENT-TMO-1026
  try { // REFILL-PREVENT-TMO-1026
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // REFILL-PREVENT-TMO-1026
    if (!url || !key) return reply({}, 503); // REFILL-PREVENT-TMO-1026
    const db = createClient(url, key); const deadline = AbortSignal.timeout(1900); // REFILL-PREVENT-TMO-1026
    const bucket = await bucketKey(key, "tmo-history-ip", clientIp(req).ip ?? "unknown"); // REFILL-PREVENT-TMO-1026
    const { data: allowed, error: limiterError } = await db.rpc("ap1_rate_limit_hit", { _bucket: bucket, _limit: 120, _window_seconds: 600 }).abortSignal(deadline); // REFILL-PREVENT-TMO-1026
    if (limiterError) return reply({}, 503); if (allowed !== true) return reply({}, 429); // REFILL-PREVENT-TMO-1026
    const { data, error } = await db.from("transaction_logs").select("amount,plan_id").eq("carrier_slug", "tmobile").eq("phone_number", phone).eq("status", "success").is("refunded_at", null).gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(1).abortSignal(deadline); // REFILL-PREVENT-TMO-1026
    if (error) return reply({}, 503); const row = data?.[0]; // REFILL-PREVENT-TMO-1026
    return row && row.plan_id && Number(row.amount) > 0 ? reply({ plan_id: String(row.plan_id), amount: Number(row.amount) }) : reply({}); // REFILL-PREVENT-TMO-1026
  } catch { return reply({}, 503); } // REFILL-PREVENT-TMO-1026
}); // REFILL-PREVENT-TMO-1026
