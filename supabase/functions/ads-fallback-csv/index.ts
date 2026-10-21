// SERVER-FALLBACK-1012: CSV of server-queued missed purchases for Google Ads offline conversion upload.
// GET/HEAD ?k=<token>. Missing/short/wrong token -> 404 empty. Errors -> 500 empty. No raw PII in the output.
// CSV-BASIC-AUTH-1012: without ?k, HTTP Basic auth (password = token). Failure -> 401. Any path under the function.
// ADS-CSV-FIX-1014: name = new Data Manager action, rolling 7 days, dedupe by Order ID, header-only 200 when empty.
// CP-PROFIT-1021: path ending /cp-profit.csv -> profit-value feed (rpc cp_profit_csv, from 2026-10-22 CT).
//   Both feeds append Email + Phone Number = SHA-256 hex of normalized email / E.164 phone (hashed in the DB; blank when unknown).
import { createClient } from "npm:@supabase/supabase-js@2";

const USER_SHA256 = "5f10590e26b7a02bdc7b435745b323874cdb948d72e2df2909914b8e45db8de9";
const HEADER = "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID,Email,Phone Number";
const HEX64 = /^[0-9a-f]{64}$/;

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

const clean = (s: unknown) => String(s ?? "").replace(/[\r\n,"]/g, "");
// Only ever output a 64-char lowercase hex hash, never anything else.
const hashOnly = (s: unknown) => {
  const v = String(s ?? "").trim().toLowerCase();
  return HEX64.test(v) ? v : "";
};

const csv = (lines: string[], isHead: boolean) =>
  new Response(isHead ? null : lines.join("\n") + "\n", {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

Deno.serve(async (req) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return empty(404);
    const isHead = req.method === "HEAD";
    const u = new URL(req.url);
    const params = u.searchParams;
    const isProfit = /\/cp-profit\.csv\/?$/i.test(u.pathname);
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

    if (isProfit) {
      // CP-PROFIT-1021: all successful web orders with a gclid (DB filters refunds, false successes, blocked fraud).
      const { data, error } = await sb.rpc("cp_profit_csv", { _token: token });
      if (error) return empty(500);
      const rows = (data ?? []) as Array<{ gclid: string; order_id: string; conv_time: string; value: number; email_sha256: string; phone_sha256: string }>;
      const CONV_NAME = "CP profit value";
      const seen = new Set<string>();
      const lines = [HEADER + ",Event Source"]; // EVENT-SOURCE-1021: cp-profit only
      let dropped = 0;
      for (const r of rows) {
        const gclid = clean(r.gclid);
        const oid = clean(r.order_id);
        if (!gclid || !oid || seen.has(oid)) continue;
        seen.add(oid);
        const v = Number(r.value);
        if (!Number.isFinite(v) || v <= 0) { dropped++; continue; }
        lines.push([gclid, CONV_NAME, clean(r.conv_time), v.toFixed(2), "USD", oid, hashOnly(r.email_sha256), hashOnly(r.phone_sha256), "WEB"].join(","));
      }
      console.log(`cp-profit rows=${lines.length - 1} dropped_nonpositive=${dropped}`);
      return csv(lines, isHead);
    }

    const { data, error } = await sb.rpc("purchase_fallback_csv", { _token: token });
    if (error) return empty(500);
    const rows = (data ?? []) as Array<{ gclid: string; order_id: string; conv_time: string; value: number }>;
    const CONV_NAME = "cp-missed.csv - All records from cp-missed.csv";
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const seen = new Set<string>();
    const out: Array<{ cols: string[]; oid: string }> = [];
    for (const r of rows) {
      const t = Date.parse(String(r.conv_time).replace(" ", "T"));
      if (!Number.isFinite(t) || t < cutoff) continue;
      const gclid = clean(r.gclid);
      const oid = clean(r.order_id);
      if (!gclid || !oid || seen.has(oid)) continue;
      seen.add(oid);
      out.push({ oid, cols: [gclid, CONV_NAME, clean(r.conv_time), Number(r.value).toFixed(2), "USD", oid] });
    }
    // CP-PROFIT-1021: hashed identifiers; fail open to blank columns so the feed never breaks.
    const hashes = new Map<string, { e: string; p: string }>();
    if (out.length) {
      try {
        const { data: h, error: he } = await sb.rpc("purchase_fallback_csv_hashes", { _token: token, _ids: out.map((o) => o.oid) });
        if (!he) for (const x of (h ?? []) as Array<{ order_id: string; email_sha256: string; phone_sha256: string }>) {
          hashes.set(String(x.order_id), { e: hashOnly(x.email_sha256), p: hashOnly(x.phone_sha256) });
        }
      } catch { /* blank columns */ }
    }
    const lines = [HEADER];
    for (const o of out) {
      const h = hashes.get(o.oid);
      lines.push([...o.cols, h?.e ?? "", h?.p ?? ""].join(","));
    }
    return csv(lines, isHead);
  } catch {
    return empty(500);
  }
});
