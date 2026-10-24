// REFILL-PREVENT-1024 (P4): read-only list of temporarily unavailable carrier amounts. Never errors to the client:
// any failure returns { items: [] } so every amount stays available. Ultra Mobile is never included (hard guard).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
type Item = { carrier_slug: string; plan_id: string; amount: number };
let cache: { at: number; items: Item[] } | null = null;
const TTL = 10 * 60 * 1000;

const reply = (items: Item[]) => new Response(JSON.stringify({ items }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (cache && Date.now() - cache.at < TTL) return reply(cache.items);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await db.from("dead_amounts").select("id, carrier_slug, plan_id, amount, hidden_at").is("restored_at", null).limit(200);
    if (error || !data) return reply([]);
    const items: Item[] = [];
    for (const row of data) {
      if (row.carrier_slug === "ultra-mobile") continue; // hard guard: never Ultra
      const { count } = await db.from("transaction_logs").select("id", { count: "exact", head: true })
        .eq("carrier_slug", row.carrier_slug).eq("plan_id", row.plan_id).eq("status", "success").gt("created_at", row.hidden_at);
      if ((count ?? 0) > 0) { await db.from("dead_amounts").update({ restored_at: new Date().toISOString() }).eq("id", row.id); continue; } // auto-restore
      items.push({ carrier_slug: row.carrier_slug, plan_id: String(row.plan_id), amount: Number(row.amount) });
    }
    cache = { at: Date.now(), items };
    return reply(items);
  } catch {
    return reply([]);
  }
});
