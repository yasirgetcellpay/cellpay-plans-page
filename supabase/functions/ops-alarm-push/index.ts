// OPTION B alarm push for CellPay ops alarms (server-side fraud watch, AP1A). pg_net (ops_alarm_raise) POSTs {"text": "..."} here;
// this forwards it to Telegram chat 1622708569 (Parvez) and nowhere else.
//
// SEND-ONLY. The bot token (edge secret TELEGRAM_BOT_TOKEN) belongs to the EXISTING SHARED bot that the box polls with getUpdates.
// This function must ONLY ever call the Bot API method `sendMessage`. It must NEVER call getUpdates, setWebhook, deleteWebhook,
// logOut, close, setMyCommands or any other method: getUpdates would steal the box's updates, and a webhook change would break the
// box's polling for everyone. Enforced by test/check_send_only.sh (grep check, run before every send of this file).
//
// Auth: the caller must present ?k=<key>. The key lives only in Vault ('ops_alarm_push_key', generated inside the DB) and is checked
// by the RPC ops_alarm_push_key_ok (digest compare). verify_jwt must be false for this function (pg_net sends no JWT).
import { createClient } from "npm:@supabase/supabase-js@2";

const CHAT_ID = "1622708569"; // fixed: Parvez. Deliberately not configurable.
const TG_METHOD = "sendMessage"; // the ONLY Bot API method this function may call

// Fraud push policy (Lead GO 2026-10-04 10:05 CT): of the fraud-watch alarms, ONLY these are forwarded. New blocks, REVIEW,
// SITEWIDE, LARGE_ATTACK and "recovered" are never pushed (the database already keeps them table-only; this is a second guard).
// Non-fraud ops alarms (AP1A Auto Pay, support relay, the setup test) are forwarded unchanged.
const FRAUD_ALLOWED = [
  "CellPay FRAUD ALARM [job_stale]",
  "CellPay FRAUD ALARM [run_failing]",
  "CellPay FRAUD ALARM [backlog_truncated]",
  "CellPay FRAUD [IB false positive]",
];
const pushAllowed = (t: string) => !t.startsWith("CellPay FRAUD") || FRAUD_ALLOWED.some((p) => t.startsWith(p));

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const k = new URL(req.url).searchParams.get("k") ?? "";
  if (k.length < 32) return new Response("forbidden", { status: 403 });
  const { data: ok, error } = await sb.rpc("ops_alarm_push_key_ok", { _k: k });
  if (error || ok !== true) return new Response("forbidden", { status: 403 });
  let text = "";
  try { text = String((await req.json())?.text ?? ""); } catch { return new Response("bad json", { status: 400 }); }
  if (!text) return new Response("empty", { status: 400 });
  if (!pushAllowed(text)) return new Response(JSON.stringify({ ok: true, skipped: "fraud push policy" }), { status: 200, headers: { "content-type": "application/json" } });
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return new Response("TELEGRAM_BOT_TOKEN not set", { status: 500 });
  const r = await fetch(`https://api.telegram.org/bot${token}/${TG_METHOD}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: text.slice(0, 3900), disable_web_page_preview: true }),
  });
  // Never echo the token or Telegram's body; status only (pg_net stores this response for the delivery receipt).
  return new Response(JSON.stringify({ ok: r.ok, telegram_status: r.status }), { status: r.ok ? 200 : 502, headers: { "content-type": "application/json" } });
});
