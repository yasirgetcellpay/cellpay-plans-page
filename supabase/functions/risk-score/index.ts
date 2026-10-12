// FRAUD-MULTIBLOCK-1012 5b: pre-payment risk score endpoint (shadow by default; checkout_guard_controls.riskengine).
// Service role inside. IP comes from x-forwarded-for (first hop), never from the client body. Any error -> allow.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { scoreRisk } from "../_shared/riskLogic.ts";

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ action: "allow", error: true });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const dev = (b.cp_dev && typeof b.cp_dev === "object" ? b.cp_dev : {}) as Record<string, unknown>;
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const r = await scoreRisk({
      phone: str(b.phone, 20), email: str(b.email, 200), amount: Number(b.amount), carrier_slug: str(b.carrier_slug, 40),
      payment_method: str(b.payment_method, 30), checkout_session_id: str(b.checkout_session_id, 100),
      cp_dev: { dev_fp: /^fp1:[0-9a-f]{40}$/.test(String(dev.dev_fp ?? "")) ? String(dev.dev_fp) : undefined,
                dev_id: /^[0-9a-z-]{8,64}$/i.test(String(dev.dev_id ?? "")) ? String(dev.dev_id).toLowerCase() : undefined },
      visitorId: str(b.visitorId, 200), card_bin6: str(b.card_bin6, 6), card_last4: str(b.card_last4, 4), addr_norm: str(b.addr_norm, 200), ip,
    });
    return json(r);
  } catch {
    return json({ action: "allow", error: true });
  }
});
