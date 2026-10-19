// FRAUD-MULTIBLOCK-1012 5b: pre-payment risk score endpoint (shadow by default; checkout_guard_controls.riskengine).
// Service role inside. IP (RISK-COVER-IP-1019): CF-Connecting-IP, else the rightmost public x-forwarded-for entry (never the leftmost,
// which the client can set), never from the client body. Any error -> allow.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { scoreRisk } from "../_shared/riskLogic.ts";

const isIp = (v: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) || (/^[0-9a-f:]+$/i.test(v) && v.includes(":"));
const isPrivate = (ip: string) => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) || /^(::1$|f[cd]|fe[89ab])/i.test(ip);
function clientIp(req: Request): { ip: string | null; src: string; country: string | null } {
  const cc = (req.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  const country = /^[A-Z][A-Z0-9]$/.test(cc) && cc !== "XX" ? cc : null;
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (isIp(cf)) return { ip: cf, src: "cf", country };
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (let i = xff.length - 1; i >= 0; i--) if (isIp(xff[i]) && !isPrivate(xff[i])) return { ip: xff[i], src: i === 0 ? "xff_first" : `xff_r${xff.length - 1 - i}`, country };
  return { ip: null, src: "none", country };
}

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ action: "allow", error: true });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const dev = (b.cp_dev && typeof b.cp_dev === "object" ? b.cp_dev : {}) as Record<string, unknown>;
    const cip = clientIp(req);
    const r = await scoreRisk({
      phone: str(b.phone, 20), email: str(b.email, 200), amount: Number(b.amount), carrier_slug: str(b.carrier_slug, 40),
      payment_method: str(b.payment_method, 30), checkout_session_id: str(b.checkout_session_id, 100),
      cp_dev: { dev_fp: /^fp1:[0-9a-f]{40}$/.test(String(dev.dev_fp ?? "")) ? String(dev.dev_fp) : undefined,
                dev_id: /^[0-9a-z-]{8,64}$/i.test(String(dev.dev_id ?? "")) ? String(dev.dev_id).toLowerCase() : undefined },
      visitorId: str(b.visitorId, 200), card_bin6: str(b.card_bin6, 6), card_last4: str(b.card_last4, 4), addr_norm: str(b.addr_norm, 200),
      ip: cip.ip, ip_src: cip.src, ip_country_hdr: cip.country,
    });
    return json(r);
  } catch {
    return json({ action: "allow", error: true });
  }
});
