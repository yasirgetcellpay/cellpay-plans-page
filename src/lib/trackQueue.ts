// DB-OUTAGE-TRACK-1017: non-personal tracking writes only; payment requests never enter this queue.
type Kind = "log_purchase_fire" | "record_marketing_opt_in";
type Entry = { k: Kind; id: string; b: Record<string, unknown>; n: number; next: number; t0: number };
const KEY = "cp_track_q_v1";
const LOCK = "cp_track_q_lock";
const AGE = 7 * 86400000;
export const TRACK_BACKOFF = [5000, 15000, 60000, 300000, 1800000, 7200000, 43200000, 86400000] as const;
const FIELDS: Record<Kind, string[]> = {
  log_purchase_fire: ["_transaction_id", "_hashid", "_value", "_source"],
  record_marketing_opt_in: ["p_hashid", "p_opt_in", "p_lang", "p_browser_language"],
};
let started = false;
let flushing = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function clean(k: Kind, b: Record<string, unknown>): { id: string; b: Record<string, unknown> } | null {
  if (!Object.prototype.hasOwnProperty.call(FIELDS, k)) return null;
  const id = b[k === "log_purchase_fire" ? "_transaction_id" : "p_hashid"];
  if (typeof id !== "string" || !/^[A-Za-z0-9_.:-]{4,128}$/.test(id)) return null;
  return { id, b: Object.fromEntries(FIELDS[k].filter((f) => Object.prototype.hasOwnProperty.call(b, f)).map((f) => [f, b[f]])) };
}
function read(): Entry[] {
  const raw: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
  const now = Date.now();
  return (Array.isArray(raw) ? raw : []).filter((e): e is Entry => {
    if (!e || typeof e !== "object" || !e.b || typeof e.b !== "object") return false;
    const c = clean(e.k, e.b);
    return c?.id === e.id && Number.isInteger(e.n) && e.n >= 1 && e.n < 8 && Number.isFinite(e.next) && Number.isFinite(e.t0) && now - e.t0 <= AGE;
  }).map((e) => ({ ...e, b: clean(e.k, e.b)?.b || {} }));
}
function write(q: Entry[]): void { localStorage.setItem(KEY, JSON.stringify(q.sort((a, b) => a.t0 - b.t0).slice(-20))); }
function remove(k: Kind, id: string): void { write(read().filter((e) => e.k !== k || e.id !== id)); }
function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const q = read();
  if (q.length) timer = setTimeout(flushTrackQueue, Math.max(5000, Math.min(1800000, Math.min(...q.map((e) => e.next)) - Date.now())));
}
async function attempt(k: Kind, b: Record<string, unknown>, ms: number, keepalive: boolean): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${k}`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(b), keepalive, signal: controller.signal,
    });
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429);
  } catch { return false; } finally { clearTimeout(timeout); }
}
export function sendTracked(kind: Kind, body: Record<string, unknown>, opts?: { firstTimeoutMs?: number }): void {
  try {
    const c = clean(kind, body);
    if (!c) return;
    // Probe storage before doing anything: an unusable store is deliberately fail-open.
    write(read());
    void attempt(kind, c.b, opts?.firstTimeoutMs ?? 15000, true).then((done) => {
      try {
        if (done) { remove(kind, c.id); return; }
        const q = read();
        if (!q.some((e) => e.k === kind && e.id === c.id)) {
          const now = Date.now();
          q.push({ k: kind, id: c.id, b: c.b, n: 1, next: now + TRACK_BACKOFF[0], t0: now });
        }
        write(q);
        startTrackQueue();
        schedule();
      } catch { /* storage unavailable: never block */ }
    }).catch(() => {});
  } catch { /* never throws */ }
}
export function flushTrackQueue(): void {
  try {
    if (flushing) return;
    const now = Date.now();
    const q = read();
    write(q);
    if (Number(localStorage.getItem(LOCK)) > now) { schedule(); return; }
    let lease = now + 15000;
    localStorage.setItem(LOCK, String(lease));
    flushing = true;
    void (async () => {
      try {
        for (const e of q.filter((entry) => entry.next <= now)) {
          // Renew our lease for sequential batches without stealing another tab's lease.
          if (Number(localStorage.getItem(LOCK)) !== lease) break;
          lease = Date.now() + 15000;
          localStorage.setItem(LOCK, String(lease));
          const current = read().find((v) => v.k === e.k && v.id === e.id);
          if (!current || current.next > Date.now()) continue;
          const done = await attempt(current.k, current.b, 5000, false);
          const latest = read();
          const index = latest.findIndex((v) => v.k === e.k && v.id === e.id);
          if (index < 0) continue;
          if (done || current.n + 1 >= 8) latest.splice(index, 1);
          else latest[index] = { ...current, n: current.n + 1, next: Date.now() + TRACK_BACKOFF[current.n] };
          write(latest);
        }
      } catch { /* best effort */ } finally {
        flushing = false;
        try { if (Number(localStorage.getItem(LOCK)) === lease) localStorage.removeItem(LOCK); schedule(); } catch { /* unavailable */ }
      }
    })().catch(() => {});
  } catch { /* never throws */ }
}
export function startTrackQueue(): void {
  try {
    if (started) return;
    started = true;
    flushTrackQueue();
    window.addEventListener("online", flushTrackQueue);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") flushTrackQueue(); });
  } catch { /* never blocks app startup */ }
}