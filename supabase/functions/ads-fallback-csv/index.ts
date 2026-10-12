// SERVER-FALLBACK-1012: CSV of server-queued missed purchases for Google Ads offline conversion upload.
// GET/HEAD ?k=<token>. Missing/short/wrong token -> 404 empty. Errors -> 500 empty. No PII in the output.
// CSV-BASIC-AUTH-1012: without ?k, HTTP Basic auth (password = token). Failure -> 401. Any path under the function.
import { createClient } from "npm:@supabase/supabase-js@2";

const USER_SHA256 = "5f10590e26b7a02bdc7b435745b323874cdb948d72e2df2909914b8e45db8de9";

const empty = (status: number) =>
  new Response("", { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const unauthorized = () =>
  new Response("", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="cellpay-ads", charset="UTF-8"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeBasic(h: string | null): { user: string; pass: string } | null {
  if (!h || !/^Basic\s+/i.test(h)) return null;
  try {
    const bin = atob(h.replace(/^Basic\s+/i, "").trim());
    const txt = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const i = txt.indexOf(":");
    if (i < 0) return null;
    return { user: txt.slice(0, i), pass: txt.slice(i + 1) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return empty(404);
    const isHead = req.method === "HEAD";
    const params = new URL(req.url).searchParams;
    const hasK = params.has("k");
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let token: string;
    if (hasK) {
      token = params.get("k") ?? "";
      if (token.length < 40 || token.length > 512) return empty(404);
    } else {
      const cred = decodeBasic(req.headers.get("Authorization"));
      if (!cred) return unauthorized();
      if ((await sha256Hex(cred.user)) !== USER_SHA256) return unauthorized();
      if (cred.pass.length < 40 || cred.pass.length > 512) return unauthorized();
      token = cred.pass;
    }
    if (!url || !key) return empty(500);
    const sb = createClient(url, key, { auth: { persistSession: false } });
    // Check the token first so a wrong token is a 404 (k) / 401 (Basic), never an empty list.
    const { data: ok, error: e2 } = await sb.rpc("purchase_fallback_csv_token_ok", { _token: token });
    if (e2) return empty(500);
    if (ok !== true) return hasK ? empty(404) : unauthorized();
    const { data, error } = await sb.rpc("purchase_fallback_csv", { _token: token });
    if (error) return empty(500);
    const rows = (data ?? []) as Array<{ gclid: string; order_id: string; conv_time: string; value: number }>;
    const clean = (s: unknown) => String(s ?? "").replace(/[\r\n,"]/g, "");
    const lines = ["Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID"];
    for (const r of rows) {
      lines.push([clean(r.gclid), "CP offline missed purchase", clean(r.conv_time), Number(r.value).toFixed(2), "USD", clean(r.order_id)].join(","));
    }
    return new Response(isHead ? null : lines.join("\n") + "\n", {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch {
    return empty(500);
  }
});
