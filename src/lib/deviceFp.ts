// FRAUD-MULTIBLOCK-1012: own device fingerprint (no external script, no network). Runs once per page, never throws.
// dev_id = a random id kept on this device (localStorage "cp_did", cookie fallback). dev_fp = "fp1:" + first 40 hex of
// SHA-256 over canvas / WebGL / font / screen / locale signals.

export type DeviceFp = { dev_fp: string; dev_id: string };

const EMPTY: DeviceFp = { dev_fp: "", dev_id: "" };
let cached: Promise<DeviceFp> | null = null;

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  try {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}

function deviceId(): string {
  const ok = (v: string | null | undefined) => !!v && /^[0-9a-z-]{8,64}$/i.test(v);
  try {
    const v = localStorage.getItem("cp_did");
    if (ok(v)) return String(v);
  } catch { /* ignore */ }
  try {
    const m = document.cookie.match(/(?:^|;\s*)cp_did=([^;]*)/);
    const v = m ? decodeURIComponent(m[1]) : "";
    if (ok(v)) {
      try { localStorage.setItem("cp_did", v); } catch { /* ignore */ }
      return v;
    }
  } catch { /* ignore */ }
  const id = randomId();
  try { localStorage.setItem("cp_did", id); } catch { /* ignore */ }
  try { document.cookie = `cp_did=${encodeURIComponent(id)}; path=/; Max-Age=${2 * 365 * 24 * 3600}; SameSite=Lax`; } catch { /* ignore */ }
  return id;
}

function canvasSig(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 240; c.height = 60;
    const g = c.getContext("2d");
    if (!g) return "";
    g.textBaseline = "top";
    g.font = "16px Arial";
    g.fillStyle = "#f60"; g.fillRect(120, 5, 80, 20);
    g.fillStyle = "#069"; g.fillText("CellPay\u{1F4F1}fp", 4, 8);
    g.font = "18px 'Times New Roman'";
    g.fillStyle = "rgba(102,204,0,0.7)"; g.fillText("CellPay\u{1F4F1}fp", 8, 30);
    g.beginPath(); g.arc(200, 40, 15, 0, Math.PI * 2, true); g.closePath(); g.fill();
    return c.toDataURL();
  } catch {
    return "";
  }
}

function webglSig(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "";
    return `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}~${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`;
  } catch {
    return "";
  }
}

const FONTS = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Trebuchet MS", "Helvetica", "Roboto", "San Francisco", "Segoe UI", "Calibri", "Noto Sans"];
function fontSig(): string {
  try {
    const g = document.createElement("canvas").getContext("2d");
    if (!g) return "";
    const s = "mmmmmmmmlli";
    g.font = "72px monospace";
    const base = g.measureText(s).width;
    return FONTS.map((f) => { g.font = `72px '${f}', monospace`; return g.measureText(s).width !== base ? "1" : "0"; }).join("");
  } catch {
    return "";
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function compute(): Promise<DeviceFp> {
  try {
    const dev_id = deviceId();
    let dev_fp = "";
    try {
      const n = navigator as Navigator & { languages?: readonly string[] };
      const sig = JSON.stringify({
        c: canvasSig(),
        w: webglSig(),
        f: fontSig(),
        s: `${screen.width}x${screen.height}x${screen.colorDepth}x${window.devicePixelRatio}`,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        ua: n.userAgent,
        l: [n.language, ...(n.languages || [])].join(","),
        hc: n.hardwareConcurrency || 0,
        p: n.platform || "",
      });
      if (crypto?.subtle) dev_fp = "fp1:" + (await sha256Hex(sig)).slice(0, 40);
    } catch {
      dev_fp = "";
    }
    return { dev_fp, dev_id };
  } catch {
    return EMPTY;
  }
}

export async function getDeviceFp(): Promise<DeviceFp> {
  try {
    if (!cached) cached = compute().catch(() => EMPTY);
    return await cached;
  } catch {
    return EMPTY;
  }
}
