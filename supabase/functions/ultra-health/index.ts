import { corsHeaders } from "npm:@supabase/supabase-js@2/cors"; // ULTRA-SMART-PREVENT-1024
import { ultraHealth } from "../_shared/ultraSmart.ts"; // ULTRA-SMART-PREVENT-1024
Deno.serve(async (req) => { // ULTRA-SMART-PREVENT-1024
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders }); // ULTRA-SMART-PREVENT-1024
  if (req.method !== "GET") return new Response("{}", { status: 405, headers: corsHeaders }); // ULTRA-SMART-PREVENT-1024
  const health = await ultraHealth(); // ULTRA-SMART-PREVENT-1024
  return new Response(JSON.stringify(health ?? {}), { status: health ? 200 : 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); // ULTRA-SMART-PREVENT-1024
}); // ULTRA-SMART-PREVENT-1024