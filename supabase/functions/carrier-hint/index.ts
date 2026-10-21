// CARRIER-ASSIST-1011: returns ONLY the carrier slug of the last successful payment for the exact phone sent, and only when it
// differs from the picked carrier. Production Origins only, POST only, no cache. Rate limits, lookup and logging live in the
// DB function public.carrier_hint (service role only). In shadow mode the DB returns carrier:null (the would-be suggestion is only logged).
// Every failure path answers {"carrier":null} (fail-open: checkout never waits on this and never breaks because of it). No PII is logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ORIGINS = new Set(["https://cellpay.us", "https://www.cellpay.us", "https://refill.cellpay.us"]);
const SLUGS = new Set([
  "topup-at", "s1", "lyca", "net10", "tmobile", "tracfone", "boost", "verizon", "h2o", "total-wireless",
  "topup-crc", "straight-talk", "ultra-mobile", "metropcs", "pageplus",
]);
const TRUSTED_XFF_HOPS = Number(Deno.env.get("TRUSTED_XFF_HOPS") ?? "1");
const NONE = JSON.stringify({ carrier: null });

function headersFor(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

// Same rule as the proxy's client IP: CF-Connecting-IP, else the rightmost platform-added X-Forwarded-For entry. Never a body field.
function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!xff.length) return "";
  return xff[Math.max(0, xff.length - TRUSTED_XFF_HOPS)] ?? "";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const h = headersFor(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST" || !origin || !ORIGINS.has(origin)) return new Response(NONE, { status: 200, headers: h });
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const phone = typeof body?.phone === "string" ? body.phone : "";
    const picked = typeof body?.picked === "string" ? body.picked : "";
    const sid = typeof body?.sid === "string" ? body.sid.slice(0, 64) : "";
    if (!/^[0-9]{10}$/.test(phone) || !SLUGS.has(picked) || sid.length < 8) return new Response(NONE, { status: 200, headers: h });
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return new Response(NONE, { status: 200, headers: h });
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const rpc = sb.rpc("carrier_hint", { _ip: clientIp(req), _sess: sid, _phone: phone, _picked: picked, _host: new URL(origin).hostname }).then((r) => r.data as unknown);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const data = await Promise.race([rpc, timeout]) as { carrier?: unknown } | null;
    const c = data && typeof data.carrier === "string" && SLUGS.has(data.carrier) && data.carrier !== picked ? data.carrier : null;
    if (picked === "tmobile" && (c !== null || !data)) { // TMO-LOOKUP-1020: shadow only; preserve response and never store the full phone.
      const row = c !== null // TMO-LOOKUP-1020
        ? { event: "tmo_lookup_would_block", phone_last4: phone.slice(-4), suggested: c, reason: "carrier_hint", host: new URL(origin).hostname } // TMO-LOOKUP-1020
        : { event: "tmo_lookup_failopen", phone_last4: phone.slice(-4), reason: "timeout_or_error", host: new URL(origin).hostname }; // TMO-LOOKUP-1020
      const write = Promise.resolve().then(() => sb.from("tmo_lookup_shadow").insert(row)).then(() => undefined).catch(() => undefined); // TMO-LOOKUP-1020
      try { // TMO-LOOKUP-1020
        const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime; // TMO-LOOKUP-1020
        if (rt && typeof rt.waitUntil === "function") rt.waitUntil(write); else void write; // TMO-LOOKUP-1020
      } catch { /* background logging must never change the response */ } // TMO-LOOKUP-1020
    } // TMO-LOOKUP-1020
    return new Response(JSON.stringify({ carrier: c }), { status: 200, headers: h });
  } catch {
    return new Response(NONE, { status: 200, headers: h });
  }
});
