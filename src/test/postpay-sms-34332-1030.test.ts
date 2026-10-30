// Server-side receipt tests with the project's standard test setup. // POSTPAY-SMS-34332-1030
import { describe, it, expect, vi } from "vitest"; // POSTPAY-SMS-34332-1030
import { readFileSync } from "node:fs"; // POSTPAY-SMS-34332-1030
import { PGlite } from "@electric-sql/pglite"; // POSTPAY-SMS-34332-1030
import ts from "typescript"; // POSTPAY-SMS-34332-1030
import { postpayMdn, sendPostpaySms } from "../../supabase/functions/_shared/postpaySms"; // POSTPAY-SMS-34332-1030
const receipt = { phone_number: "2025550123", amount: "26", carrier_name: "Ultra Mobile", lang: "es" }; // POSTPAY-SMS-34332-1030
const setup = (status = 201, code?: number) => { // POSTPAY-SMS-34332-1030
  const rpc = vi.fn(async (name: string) => name === "claim_postpay_sms" ? [receipt] : null); // POSTPAY-SMS-34332-1030
  const fetch = vi.fn(async () => new Response(JSON.stringify({ sid: `SM${"a".repeat(32)}`, code }), { status })); // POSTPAY-SMS-34332-1030
  const env = (name: string) => name === "POSTPAY_SMS_ENABLED" ? "true" : "test-only"; return { rpc, fetch, env }; // POSTPAY-SMS-34332-1030
}; // POSTPAY-SMS-34332-1030
describe("POSTPAY-SMS-34332-1030 sender", () => { // POSTPAY-SMS-34332-1030
  it("defaults off with no metadata claim or send", async () => { const d = setup(); await sendPostpaySms("id", { ...d, env: () => undefined }); expect(d.rpc).not.toHaveBeenCalled(); expect(d.fetch).not.toHaveBeenCalled(); }); // POSTPAY-SMS-34332-1030
  it.each(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID"])("skips when %s is absent", async (missing) => { const d = setup(); await sendPostpaySms("id", { ...d, env: (name) => name === missing ? undefined : d.env(name) }); expect(d.rpc).not.toHaveBeenCalled(); expect(d.fetch).not.toHaveBeenCalled(); }); // POSTPAY-SMS-34332-1030
  it("skips an already claimed or unpaid row", async () => { const d = setup(); d.rpc.mockResolvedValue(null); await sendPostpaySms("id", d); expect(d.fetch).not.toHaveBeenCalled(); }); // POSTPAY-SMS-34332-1030
  it("normalizes US MDNs and rejects invalid numbers", () => { expect(postpayMdn("+1 (202) 555-0123")).toBe("+12025550123"); for (const v of ["123", "120255501234", "2021550123", "abc2025550123"]) expect(postpayMdn(v)).toBeNull(); }); // POSTPAY-SMS-34332-1030
  it.each(["en", "es"] as const)("sends %s using MessagingServiceSid with no From or receipt link", async (lang) => { // POSTPAY-SMS-34332-1030
    const d = setup(); d.rpc.mockImplementation(async (name) => name === "claim_postpay_sms" ? [{ ...receipt, lang }] : null); await sendPostpaySms("id", d); // POSTPAY-SMS-34332-1030
    const [, options] = (d.fetch.mock.calls as unknown as [string, RequestInit][])[0]; const body = options.body as URLSearchParams; expect(body.get("To")).toBe("+12025550123"); expect(body.get("MessagingServiceSid")).toBe("test-only"); expect(body.has("From")).toBe(false); expect(body.get("Body")).toContain("$26.00"); expect(body.get("Body")).toContain("***0123"); expect(body.get("Body")).not.toContain("http"); expect(options.signal).toBeDefined(); // POSTPAY-SMS-34332-1030
    expect(d.rpc).toHaveBeenLastCalledWith("tx_log_meta_merge", { _id: "id", _patch: { postpay_sms: expect.objectContaining({ status: "sent", lang, sid: `SM${"a".repeat(32)}`, error_code: null }) } }); // POSTPAY-SMS-34332-1030
  }); // POSTPAY-SMS-34332-1030
  it.each([400, 401, 429])("does not retry HTTP %i", async (status) => { const d = setup(status); await sendPostpaySms("id", d); expect(d.fetch).toHaveBeenCalledTimes(1); }); // POSTPAY-SMS-34332-1030
  it("retries 5xx only once", async () => { const d = setup(503); await sendPostpaySms("id", d); expect(d.fetch).toHaveBeenCalledTimes(2); }); // POSTPAY-SMS-34332-1030
  it("STOP 21610 is non-fatal and not retried", async () => { const d = setup(400, 21610); await expect(sendPostpaySms("id", d)).resolves.toBeUndefined(); expect(d.fetch).toHaveBeenCalledTimes(1); expect(d.rpc).toHaveBeenLastCalledWith("tx_log_meta_merge", { _id: "id", _patch: { postpay_sms: expect.objectContaining({ status: "opted_out", error_code: "21610" }) } }); }); // POSTPAY-SMS-34332-1030
  it("bounds Twilio requests to five seconds", async () => { const d = setup(); const timeout = vi.spyOn(AbortSignal, "timeout"); await sendPostpaySms("id", d); expect(timeout).toHaveBeenCalledWith(5000); timeout.mockRestore(); }); // POSTPAY-SMS-34332-1030
  it("network failure never throws or retries", async () => { const d = setup(); d.fetch.mockRejectedValue(new Error("offline")); await expect(sendPostpaySms("id", d)).resolves.toBeUndefined(); expect(d.fetch).toHaveBeenCalledTimes(1); }); // POSTPAY-SMS-34332-1030
  it("metadata failure never throws", async () => { const d = setup(); d.rpc.mockRejectedValue(new Error("offline")); await expect(sendPostpaySms("id", d)).resolves.toBeUndefined(); expect(d.fetch).not.toHaveBeenCalled(); }); // POSTPAY-SMS-34332-1030
  it("success finalizer returns without waiting for SMS, and failed finalization never starts it", async () => { // POSTPAY-SMS-34332-1030
    const source = readFileSync("supabase/functions/cellpay-proxy/index.ts", "utf8"); const start = source.indexOf("async function finishTransactionLog("); const end = source.indexOf("\n// [CASHAPP-STUCK-1007]", start); const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; // POSTPAY-SMS-34332-1030
    const db = vi.fn().mockResolvedValue(null), sms = vi.fn(() => new Promise(() => {})); const finish = new Function("callDatabaseRpc", "startPostpaySms", "unwrapTransactionResult", "asRecord", "text", `${code};return finishTransactionLog;`)(db, sms, (w: { data: unknown }) => w.data, (v: unknown) => v ?? {}, (v: unknown) => v ?? null); // POSTPAY-SMS-34332-1030
    await finish("id", { success: true, data: { status: true, hashid: "paid" } }, "card"); expect(sms).toHaveBeenCalledOnce(); sms.mockClear(); await finish("id", { success: false, data: { status: false } }, "card"); expect(sms).not.toHaveBeenCalled(); db.mockRejectedValue(new Error("offline")); const log = vi.spyOn(console, "error").mockImplementation(() => {}); await finish("id", { success: true, data: { status: true } }, "card"); expect(sms).not.toHaveBeenCalled(); log.mockRestore(); // POSTPAY-SMS-34332-1030
  }); // POSTPAY-SMS-34332-1030
}); // POSTPAY-SMS-34332-1030
describe("POSTPAY-SMS-34332-1030 atomic claim", () => { // POSTPAY-SMS-34332-1030
  it("claims successful identity once, preserves metadata/status and restricts execution", async () => { // POSTPAY-SMS-34332-1030
    const db = new PGlite(); try { // POSTPAY-SMS-34332-1030
      await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.transaction_logs(id uuid primary key, status text, hashid text, transaction_id text, phone_number text, amount numeric, carrier_name text, metadata jsonb); ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;"); // POSTPAY-SMS-34332-1030
      await db.exec(readFileSync("drizzle/migrations/0022_postpay_sms_34332_1030.sql", "utf8")); // POSTPAY-SMS-34332-1030
      const ids = [1, 2, 3, 4].map((n) => `00000000-0000-0000-0000-00000000000${n}`); // POSTPAY-SMS-34332-1030
      for (let i = 0; i < ids.length; i++) await db.query("INSERT INTO public.transaction_logs VALUES ($1,$2,$3,$4,'2025550123',26,'Ultra Mobile',$5)", [ids[i], i === 3 ? "pending" : "success", i === 2 ? "unique" : "same", i === 1 ? "different" : "shared", { retained: true, uiLang: "es" }]); // POSTPAY-SMS-34332-1030
      const claim = (id: string) => db.query("SELECT * FROM public.claim_postpay_sms($1)", [id]); expect((await claim(ids[0])).rows).toHaveLength(1); for (const id of ids) expect((await claim(id)).rows).toHaveLength(0); // POSTPAY-SMS-34332-1030
      const rows = await db.query<{ status: string; metadata: { retained: boolean; postpay_sms?: { lang: string } } }>("SELECT status, metadata FROM public.transaction_logs ORDER BY id"); expect(rows.rows[0].status).toBe("success"); expect(rows.rows[0].metadata.retained).toBe(true); expect(rows.rows[0].metadata.postpay_sms?.lang).toBe("es"); expect(rows.rows[1].metadata.postpay_sms).toBeUndefined(); // POSTPAY-SMS-34332-1030
      const permissions = await db.query("SELECT has_function_privilege('anon','public.claim_postpay_sms(uuid)','execute') AS anon, has_function_privilege('authenticated','public.claim_postpay_sms(uuid)','execute') AS authenticated, has_function_privilege('service_role','public.claim_postpay_sms(uuid)','execute') AS service"); expect(permissions.rows[0]).toEqual({ anon: false, authenticated: false, service: true }); // POSTPAY-SMS-34332-1030
    } finally { await db.close(); } // POSTPAY-SMS-34332-1030
  }); // POSTPAY-SMS-34332-1030
}); // POSTPAY-SMS-34332-1030