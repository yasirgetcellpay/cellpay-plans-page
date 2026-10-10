// LPX-1010 (SPEC-LPX-1): ad-lander H1 / title / subline use the words the keywords and ads use ("without signing in", "phone number").
// ONE table used by the runtime lander (GoLander.tsx) AND by the static shell (vite.config.ts), so raw HTML and rendered text match.
// Copy only: no prices, no fee amounts, no catalog or checkout values. Relative imports only (vite.config.ts loads this file).
export type GoLang = "en" | "es";
export type GoLpx = { h1?: string; title?: string; subline: string };

type Row = { name: string; h1En?: string; h1Es?: string };

/** Keyed by carrierSlug (as passed to GoLander). H1 is only set where SPEC-LPX-1 asks for a new one; Simple/Metro EN and Metro ES keep theirs. */
const ROWS: Record<string, Row> = {
  "topup-at": { name: "AT&T", h1En: "Pay Your AT&T Prepaid Bill Without Signing In", h1Es: "Pague su factura de AT&T Prepago sin iniciar sesión" },
  tmobile: { name: "T-Mobile", h1En: "Pay Your T-Mobile Bill Without Signing In", h1Es: "Pague su factura de T-Mobile sin iniciar sesión" },
  verizon: { name: "Verizon", h1En: "Pay Your Verizon Prepaid Bill Without Signing In", h1Es: "Pague su factura de Verizon sin iniciar sesión" },
  "topup-crc": { name: "Cricket", h1En: "Pay Your Cricket Wireless Bill Without Signing In", h1Es: "Pague su factura de Cricket sin iniciar sesión" },
  h2o: { name: "H2O", h1En: "Pay Your H2O Wireless Bill Without Signing In", h1Es: "Pague su factura de H2O sin iniciar sesión" },
  s1: { name: "Simple Mobile", h1Es: "Pague su factura de Simple Mobile sin iniciar sesión" },
  metropcs: { name: "Metro" },
};

/** Route slug (/go/<slug>) -> carrierSlug. */
const ROUTE_TO_CARRIER: Record<string, string> = {
  att: "topup-at",
  tmobile: "tmobile",
  verizon: "verizon",
  cricket: "topup-crc",
  h2o: "h2o",
  "simple-mobile": "s1",
  metro: "metropcs",
};

export const goSublineFor = (name: string, lang: GoLang): string =>
  lang === "es"
    ? `Pago como invitado con solo su número de teléfono de ${name}. Pague por usted o por otra persona. Sin cuenta.`
    : `Guest bill pay with just your ${name} phone number. Pay for yourself or someone else. No account needed.`;

/** Runtime: by carrierSlug + lang. null = leave the lander exactly as it is. */
export const goLpxForCarrier = (carrierSlug: string, lang: GoLang): GoLpx | null => {
  const r = ROWS[carrierSlug];
  if (!r) return null;
  const h1 = lang === "es" ? r.h1Es : r.h1En;
  return { h1, title: h1 ? `${h1} | CellPay` : undefined, subline: goSublineFor(r.name, lang) };
};

/** Static shell: by build route ("go/att.html", "es/go/att/index.html"). null = unchanged page. */
export const goLpxForRoute = (route: string): GoLpx | null => {
  const m = /^(es\/)?go\/([a-z0-9-]+?)(?:\/index)?\.html$/.exec(route);
  if (!m) return null;
  const carrier = ROUTE_TO_CARRIER[m[2]];
  return carrier ? goLpxForCarrier(carrier, m[1] ? "es" : "en") : null;
};
