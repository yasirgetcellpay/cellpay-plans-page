import { createClient } from "npm:@supabase/supabase-js@2"; // ULTRA-SMART-PREVENT-1024
export async function ultraHealth(claim = false): Promise<Record<string, unknown> | null> { // ULTRA-SMART-PREVENT-1024
  try { // ULTRA-SMART-PREVENT-1024
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // ULTRA-SMART-PREVENT-1024
    if (!url || !key) return null; // ULTRA-SMART-PREVENT-1024
    const configured = Deno.env.get("ULTRA_BREAKER_MODE") ?? "pause"; // ULTRA-SMART-PREVENT-1024
    const mode = ["off", "warn", "pause"].includes(configured) ? configured : "off"; // ULTRA-SMART-PREVENT-1024
    if (mode === "off") return { tier: "off" }; // ULTRA-SMART-PREVENT-1024
    const db = createClient(url, key); // ULTRA-SMART-PREVENT-1024
    const work = (async () => { const { data, error } = await db.rpc("ultra_breaker_check", { _mode: mode, _claim: claim }).abortSignal(AbortSignal.timeout(1900)); return error ? null : data; })(); // ULTRA-SMART-PREVENT-1024
    let timer: ReturnType<typeof setTimeout> | undefined; // ULTRA-SMART-PREVENT-1024
    try { return await Promise.race([work.catch(() => null), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 2000); })]); } finally { if (timer) clearTimeout(timer); } // ULTRA-SMART-PREVENT-1024
  } catch { return null; } // ULTRA-SMART-PREVENT-1024
} // ULTRA-SMART-PREVENT-1024