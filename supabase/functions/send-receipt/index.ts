// RECEIPT-EMAIL: transactional receipt via Mandrill, called by the trg_send_receipt database trigger (pg_net).
// Auth: header x-receipt-secret must equal receipt_secret('receipt_trigger_secret'). Secrets come only from the
// receipt_secret RPC (service role). Order data is always re-read from transaction_logs; request body = transaction_id only.
// Modes (receipt_config.receipt_mode): OFF = nothing; TEST = always to pj@getcellpay.com, "[TEST] " subject, 15/day (Chicago);
// ON = to the order email. Never logs the API key or a full email. Always 200 JSON (401 only for a bad secret).
import { createClient } from "npm:@supabase/supabase-js@2";

const TEST_TO = "pj@getcellpay.com";
const TEST_CAP = 15;
const TZ = "America/Chicago";
const HOSTS = new Set(["refill.cellpay.us", "www.cellpay.us"]);
// Same carrier page paths as the site (src/lib/checkoutResume.ts CARRIERS).
const CARRIER_PATHS: Record<string, string> = {
  s1: "/s1.html", "topup-crc": "/topup-crc.html", metropcs: "/metropcs.html", tmobile: "/tmobile-flexi.html",
  "topup-at": "/topup-at.html", verizon: "/verizon", boost: "/boost.html", h2o: "/h2o.html", lyca: "/lyca.html",
  net10: "/net10.html", pageplus: "/pageplus.html", tracfone: "/tracfone.html", "ultra-mobile": "/ultra-mobile.html",
  pageplusadd: "/pageplus-addon", "total-wireless": "/total-wireless", "straight-talk": "/straight-talk.html",
  uscellular: "/us-cellular.html", att: "/att-firstnet",
};
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// First string/number value found under one of the keys (depth-limited walk of metadata / raw_response).
function findKey(v: unknown, keys: string[], d = 0): string {
  if (!v || typeof v !== "object" || d > 5) return "";
  if (Array.isArray(v)) { for (const x of v) { const f = findKey(x, keys, d + 1); if (f) return f; } return ""; }
  const o = v as Record<string, unknown>;
  for (const k of keys) { const x = o[k]; if ((typeof x === "string" && x.trim()) || typeof x === "number") return String(x).trim(); }
  for (const x of Object.values(o)) { const f = findKey(x, keys, d + 1); if (f) return f; }
  return "";
}

function chicagoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function fmtDate(iso: string, lang: "en" | "es"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const time = `${p.hour}:${p.minute} ${p.dayPeriod}`;
  if (lang === "es") {
    const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "numeric" }).format(d)) - 1;
    return `${p.day} ${MONTHS_ES[m]} ${p.year}, ${time} CT`;
  }
  return `${p.month} ${p.day}, ${p.year}, ${time} CT`;
}

function methodLabel(pm: string, last4: string): string {
  const m = pm.toLowerCase();
  const base = m.includes("apple") ? "Apple Pay" : m.includes("google") ? "Google Pay" : m.includes("paypal") ? "PayPal" : "Card";
  return /^\d{4}$/.test(last4) ? `${base} •••• ${last4}` : base;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, skipped: "method" });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ ok: false, error: "config" });
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Auth
  let trigSecret = "";
  try {
    const { data } = await db.rpc("receipt_secret", { p_name: "receipt_trigger_secret" });
    trigSecret = typeof data === "string" ? data : "";
  } catch { trigSecret = ""; }
  const given = req.headers.get("x-receipt-secret") || "";
  if (!trigSecret || given.length !== trigSecret.length || given !== trigSecret) return json({ ok: false, error: "unauthorized" }, 401);

  let txId = "";
  try {
    const b = asObj(await req.json().catch(() => ({})));
    txId = typeof b.transaction_id === "string" ? b.transaction_id.trim().slice(0, 200) : "";
    if (!txId) return json({ ok: true, skipped: "no_transaction_id" });

    // Mode
    const { data: cfg } = await db.from("receipt_config").select("value").eq("key", "receipt_mode").maybeSingle();
    const mode = String(cfg?.value ?? "OFF");
    if (mode !== "TEST" && mode !== "ON") return json({ ok: true, skipped: "off" });

    // Order (success only)
    const { data: order } = await db.from("transaction_logs")
      .select("transaction_id, hashid, status, email, phone_number, carrier_name, carrier_slug, amount, total, payment_method, metadata, raw_response, created_at")
      .eq("transaction_id", txId).eq("status", "success").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!order) return json({ ok: true, skipped: "not_success" });

    // Idempotency
    const { data: won } = await db.from("receipt_sends")
      .upsert({ transaction_id: txId, mode }, { onConflict: "transaction_id", ignoreDuplicates: true })
      .select("transaction_id");
    if (!won || won.length === 0) return json({ ok: true, duplicate: true });

    const meta = asObj(order.metadata);
    const raw = order.raw_response;
    const lang: "en" | "es" = meta.lang === "es" ? "es" : "en";
    const update = (patch: Record<string, unknown>) =>
      db.from("receipt_sends").update({ ...patch, lang, updated_at: new Date().toISOString() }).eq("transaction_id", txId);

    const email = String(order.email || "").trim();
    const slug = String(order.carrier_slug || "");
    if (txId.startsWith("GATE_") || String(order.hashid || "").startsWith("GATE_") || email.toLowerCase().endsWith("@example.com") || slug === "blocklist-test") {
      await update({ status: "skipped_test" });
      return json({ ok: true, skipped: "test_order" });
    }

    let to = "";
    let recipientKind = "";
    if (mode === "TEST") {
      const now = new Date();
      const since = new Date(now.getTime() - 36 * 3600 * 1000).toISOString();
      const { data: recent } = await db.from("receipt_sends").select("created_at, status, transaction_id")
        .eq("mode", "TEST").gte("created_at", since);
      const today = chicagoDay(now);
      const sentToday = (recent || []).filter((r) => r.transaction_id !== txId && r.created_at && chicagoDay(new Date(r.created_at)) === today
        && !["test_capped", "skipped_test"].includes(String(r.status))).length;
      if (sentToday >= TEST_CAP) { await update({ status: "test_capped", recipient_kind: "test" }); return json({ ok: true, skipped: "test_capped" }); }
      to = TEST_TO; recipientKind = "test";
    } else {
      if (!/^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email)) {
        await update({ status: "no_email", recipient_kind: "customer" });
        return json({ ok: true, skipped: "no_email" });
      }
      to = email; recipientKind = "customer";
    }

    // Merge vars
    const amount = Number(order.amount), total = Number(order.total);
    const carrier = String(order.carrier_name || "");
    const isPay = /metro|boost|cricket/i.test(slug) || /metro|boost|cricket/i.test(carrier);
    const plan = findKey(meta, ["plan_name", "planName", "plan_display_name"]) || findKey(raw, ["plan_name", "planName", "plan_display_name", "productName", "product_name"]) || `${money(amount)} plan`;
    const last4 = findKey(raw, ["card_last4", "cardLast4", "last4", "lastFour"]) || findKey(meta, ["card_last4", "cardLast4", "last4"]);
    const host = HOSTS.has(String(meta.caller_host || "")) ? String(meta.caller_host) : "refill.cellpay.us";
    const reorder = `https://${host}${lang === "es" ? "/es" : ""}${CARRIER_PATHS[slug] || "/"}`;
    const phoneDigits = String(order.phone_number || "").replace(/\D/g, "");
    const vars: Record<string, unknown> = {
      IS_PAYMENT_CARRIER: isPay,
      CARRIER: carrier,
      PLAN: plan,
      PHONE_LAST4: phoneDigits.slice(-4),
      AMOUNT: money(amount),
      FEE: money((Number.isFinite(total) ? total : amount) - amount),
      TOTAL: money(Number.isFinite(total) ? total : amount),
      TRANSACTION_ID: txId,
      ORDER_DATETIME: fmtDate(String(order.created_at || ""), lang),
      PAYMENT_METHOD: methodLabel(String(order.payment_method || ""), last4),
      REORDER_URL: reorder,
    };
    const subject = (mode === "TEST" ? "[TEST] " : "") + (lang === "es" ? `Tu recibo de CellPay – ${carrier} ${money(amount)}` : `Your CellPay receipt – ${carrier} ${money(amount)}`);

    const { data: mk } = await db.rpc("receipt_secret", { p_name: "mandrill_api_key" });
    const apiKey = typeof mk === "string" ? mk : "";
    if (!apiKey) { await update({ status: "error", error: "no_api_key", recipient_kind: recipientKind }); return json({ ok: false, error: "config" }); }
    const { data: logo } = await db.from("receipt_assets").select("mime, b64").eq("name", "cellpay-logo").maybeSingle();

    const payload = {
      key: apiKey,
      template_name: lang === "es" ? "cellpay-receipt-v1-es" : "cellpay-receipt-v1",
      template_content: [],
      message: {
        from_email: "receipts@getcellpay.com", from_name: "CellPay", subject,
        to: [{ email: to, type: "to" }],
        merge_language: "handlebars",
        global_merge_vars: Object.entries(vars).map(([name, content]) => ({ name, content })),
        tags: ["receipt"], metadata: { transaction_id: txId },
        track_opens: false, track_clicks: false,
        ...(logo?.b64 ? { images: [{ type: "image/png", name: "cellpay-logo", content: String(logo.b64) }] } : {}),
      },
    };

    // Send: retry only on network errors / 5xx (1 s, 3 s); never on a Mandrill rejection.
    const waits = [1000, 3000];
    let attempts = 0;
    let lastErr = "";
    for (;;) {
      attempts++;
      try {
        const r = await fetch("https://mandrillapp.com/api/1.0/messages/send-template", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
        });
        if (r.status >= 500) { lastErr = `http_${r.status}`; await r.body?.cancel(); }
        else {
          const out = await r.json().catch(() => null);
          const first = Array.isArray(out) ? asObj(out[0]) : {};
          if (!r.ok || !Array.isArray(out)) {
            const o = asObj(out);
            await update({ status: "error", error: String(o.name || o.message || `http_${r.status}`).slice(0, 300), attempts, recipient_kind: recipientKind });
            return json({ ok: false, status: "error" });
          }
          const st = String(first.status || "error");
          await update({
            status: st, mandrill_id: first._id ? String(first._id) : null,
            error: st === "rejected" || st === "invalid" ? String(first.reject_reason || st).slice(0, 300) : null,
            attempts, recipient_kind: recipientKind,
          });
          return json({ ok: true, status: st });
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.name : "network";
      }
      if (attempts >= 3) break;
      await sleep(waits[attempts - 1]);
    }
    await update({ status: "error", error: lastErr.slice(0, 300), attempts, recipient_kind: recipientKind });
    return json({ ok: false, status: "error" });
  } catch {
    console.error("send-receipt failed", txId);
    try { if (txId) await db.from("receipt_sends").update({ status: "error", error: "exception", updated_at: new Date().toISOString() }).eq("transaction_id", txId); } catch { /* ignore */ }
    return json({ ok: false, status: "error" });
  }
});
