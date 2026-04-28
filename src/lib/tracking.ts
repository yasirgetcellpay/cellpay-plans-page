// Capture and persist marketing/click tracking identifiers from URL query params.
// We store the FIRST captured value per key (don't overwrite existing IDs on
// subsequent visits — the original click attribution wins).

const STORAGE_KEY = "cellpay_tracking_ids";

// Common click/tracking identifiers across major ad networks.
const TRACKING_KEYS = [
  "gclid",       // Google Ads
  "gbraid",      // Google iOS app campaigns
  "wbraid",      // Google web-to-app
  "fbclid",      // Facebook / Meta
  "msclkid",     // Microsoft / Bing Ads
  "ttclid",      // TikTok
  "li_fat_id",   // LinkedIn
  "twclid",      // Twitter / X
  "dclid",       // Display & Video 360
  "yclid",       // Yandex
  "irclickid",   // Impact
  "epik",        // Pinterest
] as const;

export type TrackingIds = Record<string, string>;

function readStore(): TrackingIds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as TrackingIds) : {};
  } catch {
    return {};
  }
}

function writeStore(ids: TrackingIds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / privacy mode errors
  }
}

/**
 * Reads tracking IDs from the current URL query string and persists any new
 * ones to localStorage. Existing stored values are preserved (first-touch).
 */
export function captureTrackingIdsFromUrl(): TrackingIds {
  if (typeof window === "undefined") return {};
  const stored = readStore();
  let changed = false;

  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of TRACKING_KEYS) {
      const value = params.get(key);
      if (value && !stored[key]) {
        stored[key] = value;
        changed = true;
      }
    }
  } catch {
    // ignore malformed URL
  }

  if (changed) writeStore(stored);
  return stored;
}

export function getTrackingIds(): TrackingIds {
  return readStore();
}

/**
 * Returns the persisted gclid (or any other captured click identifier as a
 * fallback) for inclusion in transaction payloads.
 */
export function getGclid(): string {
  const ids = readStore();
  if (ids.gclid) return ids.gclid;
  // Fallback to other ad-network click IDs so attribution still flows through
  // under the unified `gclid` parameter expected by the backend.
  for (const key of TRACKING_KEYS) {
    if (ids[key]) return ids[key];
  }
  return "";
}
