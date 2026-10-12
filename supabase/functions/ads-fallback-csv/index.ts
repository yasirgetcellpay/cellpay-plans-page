// SERVER-FALLBACK-1012: CSV of server-queued missed purchases for Google Ads offline conversion upload.
// GET ?k=<token>. Missing/short/wrong token -> 404 empty. Errors -> 500 empty. No PII in the output.
import { createClient } from "npm:@supabase/supabase-js@2";

const empty = (status: number) =>
  new Response("", { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

Deno.serve(async (req) => {
  try {
    if (req.method !== "GET") return empty(404);
    const k = new URL(req.url).searchParams.get("k") ?? "";
    if (k.length < 40 || k.length > 512) return empty(404);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return empty(500);
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.rpc("purchase_fallback_csv", { _token: k });
    if (error) return empty(500);
    const rows = (data ?? []) as Array<{ gclid: string; order_id: string; conv_time: string; value: number }>;
    // The function returns no rows for a wrong token; check the token separately so a wrong token is a 404, never an empty list.
    const { data: ok, error: e2 } = await sb.rpc("purchase_fallback_csv_token_ok", { _token: k });
    if (e2) return empty(500);
    if (ok !== true) return empty(404);
    const clean = (s: unknown) => String(s ?? "").replace(/[\r\n,"]/g, "");
    const lines = ["Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID"];
    for (const r of rows) {
      lines.push([clean(r.gclid), "CP offline missed purchase", clean(r.conv_time), Number(r.value).toFixed(2), "USD", clean(r.order_id)].join(","));
    }
    return new Response(lines.join("\n") + "\n", {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch {
    return empty(500);
  }
});
