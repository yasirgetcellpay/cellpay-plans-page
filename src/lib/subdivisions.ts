import { Country, State } from "country-state-city";

export interface Subdivision {
  code: string; // 2-letter (or short ISO 3166-2 suffix) code
  name: string;
}

const PRIORITY = ["US", "CA", "MX", "GB", "AU", "IN", "PK", "BD", "PH", "BR", "DE", "FR", "ES", "IT", "NL", "JP", "CN"];

// Full ISO 3166-1 country list, with priority countries pinned to the top.
export const SUPPORTED_COUNTRIES: { code: string; name: string }[] = (() => {
  const all = (Country.getAllCountries() || []).map((c) => ({ code: c.isoCode, name: c.name }));
  const priority = PRIORITY
    .map((code) => all.find((c) => c.code === code))
    .filter((c): c is { code: string; name: string } => !!c);
  const rest = all
    .filter((c) => !PRIORITY.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...priority, ...rest];
})();

/**
 * Returns ISO 3166-2 subdivisions for a given ISO 3166-1 alpha-2 country code.
 * Returns [] if the country has no subdivision data — caller should render a text input.
 */
export function getSubdivisions(countryCode: string): Subdivision[] {
  if (!countryCode || countryCode === "OTHER") return [];
  const states = State.getStatesOfCountry(countryCode) || [];
  return states
    .map((s) => ({ code: (s.isoCode || "").toUpperCase(), name: s.name }))
    .filter((s) => s.code && s.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize a user-supplied region value to its ISO 3166-2 short code (e.g. "California" -> "CA").
 * Falls back to the original (uppercased, trimmed) value if no match is found.
 */
export function normalizeRegionCode(countryCode: string, value: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const subs = getSubdivisions(countryCode);
  if (subs.length === 0) return raw.toUpperCase();

  const upper = raw.toUpperCase();
  // exact code match
  const byCode = subs.find((s) => s.code === upper);
  if (byCode) return byCode.code;
  // exact name match (case-insensitive)
  const byName = subs.find((s) => s.name.toUpperCase() === upper);
  if (byName) return byName.code;
  // suffix after dash, e.g. "US-CA" -> "CA"
  if (upper.includes("-")) {
    const tail = upper.split("-").pop() || "";
    const byTail = subs.find((s) => s.code === tail);
    if (byTail) return byTail.code;
  }
  // partial name (starts with)
  const byPartial = subs.find((s) => s.name.toUpperCase().startsWith(upper));
  if (byPartial) return byPartial.code;
  return upper;
}

export function isValidCountry(countryCode: string): boolean {
  return !!Country.getCountryByCode(countryCode);
}
