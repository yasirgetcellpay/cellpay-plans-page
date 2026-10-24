// ULTRA-SMART-PREVENT-1024
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"; // ULTRA-SMART-PREVENT-1024
import { PGlite } from "@electric-sql/pglite"; // ULTRA-SMART-PREVENT-1024
import { Blob as NodeBlob } from "node:buffer"; // ULTRA-SMART-PREVENT-1024
import { readFileSync } from "node:fs"; // ULTRA-SMART-PREVENT-1024
describe("atomic Ultra breaker", () => { // ULTRA-SMART-PREVENT-1024
  let db: PGlite; // ULTRA-SMART-PREVENT-1024
  beforeAll(async () => { // ULTRA-SMART-PREVENT-1024
    vi.stubGlobal("Blob", NodeBlob); vi.stubGlobal("fetch", async (url: string | URL) => { const bytes = readFileSync(String(url).replace("file://", "")); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; }); // ULTRA-SMART-PREVENT-1024
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob }); await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE transaction_logs(carrier_slug text,created_at timestamptz,status text,load_text text,error_message text,raw_response jsonb); CREATE TABLE proxy_guard_events(id uuid,guard_version text,code text,method text,endpoint_shape text);"); // ULTRA-SMART-PREVENT-1024
    await db.exec(readFileSync("drizzle/migrations/0021_ultra_smart_prevent_1024.sql", "utf8")); // ULTRA-SMART-PREVENT-1024
  }, 30000); // ULTRA-SMART-PREVENT-1024
  afterAll(async () => { await db.close(); vi.unstubAllGlobals(); }); // ULTRA-SMART-PREVENT-1024
  async function seed(n: number, failures: number) { await db.exec("TRUNCATE transaction_logs,ultra_breaker_state,proxy_guard_events;"); for (let i = 0; i < n; i++) await db.query("INSERT INTO transaction_logs VALUES('ultra-mobile',now(),$1,$2,'','{}')", [i < failures ? "failed" : "success", i < failures ? "1065" : ""]); } // ULTRA-SMART-PREVENT-1024
  async function check(mode = "pause", claim = false) { const r = await db.query<{ health: Record<string, unknown> }>("SELECT ultra_breaker_check($1,$2) as health", [mode, claim]); return r.rows[0].health; } // ULTRA-SMART-PREVENT-1024
  it("warns at 40% with five attempts", async () => { await seed(5, 2); expect((await check()).tier).toBe("warn"); }); // ULTRA-SMART-PREVENT-1024
  it("does not pause with only five attempts", async () => { await seed(5, 5); expect((await check()).tier).toBe("warn"); }); // ULTRA-SMART-PREVENT-1024
  it("pauses at 70% with at least six attempts, for 20 minutes", async () => { await seed(10, 7); const h = await check(); expect(h.tier).toBe("pause"); expect(h.allowed).toBe(false); expect(h.retry_after).toBe(1200); }); // ULTRA-SMART-PREVENT-1024
  it("warn mode never pauses and off mode allows", async () => { await seed(6, 6); expect((await check("warn")).tier).toBe("warn"); expect((await check("off", true)).allowed).toBe(true); }); // ULTRA-SMART-PREVENT-1024
  it("counts last ten when they are larger than the 60 minute window", async () => { await seed(10, 7); await db.exec("UPDATE transaction_logs SET created_at=now()-interval '2 hours';"); expect((await check()).attempts).toBe(10); expect((await check()).tier).toBe("pause"); }); // ULTRA-SMART-PREVENT-1024
  it("excludes subscriber-not-found, duplicate and blocked", async () => { await seed(2, 0); for (const text of ["Subscriber not found", "duplicate", "Blocked: risk"]) await db.query("INSERT INTO transaction_logs VALUES('ultra-mobile',now(),'failed',$1,$1,'{}')", [text]); expect((await check()).attempts).toBe(2); }); // ULTRA-SMART-PREVENT-1024
  it("allows one atomic probe after 20 minutes and restores after probe success", async () => { await seed(6, 6); await check(); await db.exec("UPDATE ultra_breaker_state SET pause_until=now()-interval '1 second';"); expect((await check()).probe_available).toBe(true); expect((await check("pause", true)).allowed).toBe(true); expect((await check("pause", true)).allowed).toBe(false); await db.exec("INSERT INTO transaction_logs VALUES('ultra-mobile',clock_timestamp(),'success','','','{}');"); expect((await check()).tier).toBe("off"); }); // ULTRA-SMART-PREVENT-1024
}); // ULTRA-SMART-PREVENT-1024