// LPX-1010 (SPEC-LPX-1): ad-lander H1 / title / subline use the words the keywords and ads use ("without signing in", "phone number").
// ONE table used by the runtime lander (GoLander.tsx) AND by the static shell (vite.config.ts), so raw HTML and rendered text match.
// Copy only: no prices, no fee amounts, no catalog or checkout values. Relative imports only (vite.config.ts loads this file).
export type GoLang = "en" | "es";
export type GoLpx = { h1?: string; title?: string; subline: string };

type Row = { name: string; h1En?: string; h1Es?: string; sublineEn?: string; sublineEs?: string; titleEn?: string; titleEs?: string };

/** Keyed by carrierSlug (as passed to GoLander). LPX-1017, BOOST-GUEST-LPX-1017 and TMO-ATT-LPX-1018 update guest-pay H1/subline/title copy; other rows keep SPEC-LPX-1 wording. */
const ROWS: Record<string, Row> = {
  boost: { name: "Boost Mobile", h1En: "Pay Your Boost Mobile Bill as a Guest", h1Es: "Pague su factura de Boost como invitado", sublineEn: "Just your phone number — no login. Pay with debit or credit card.", sublineEs: "Solo su número de teléfono, sin iniciar sesión. Tarjeta de débito o crédito.", titleEn: "Pay Your Boost Mobile Bill as a Guest | CellPay", titleEs: "Pague su factura de Boost como invitado | CellPay" },
  "topup-at": { name: "AT&T", h1En: "Pay Your AT&T Prepaid Bill Without Signing In", h1Es: "Pague su factura de AT&T Prepago sin iniciar sesión", sublineEn: "AT&T Prepaid (ATT) guest pay: just the phone number, no login. Debit or credit card." },
  tmobile: { name: "T-Mobile", h1En: "Pay Your T-Mobile Bill as a Guest", h1Es: "Pague su factura de T-Mobile sin iniciar sesión", sublineEn: "Just the phone number, without signing in. Pay for yourself or someone else with a debit or credit card.", sublineEs: "Pague el teléfono T-Mobile como invitado: solo su número, sin cuenta. Tarjeta de débito o crédito.", titleEn: "Pay My T-Mobile Bill as a Guest by Phone Number | CellPay", titleEs: "Pagar factura de T-Mobile en línea | CellPay" }, // TMO-ATT-LPX-1018
  verizon: { name: "Verizon", h1En: "Pay Your Verizon Prepaid Bill Without Signing In", h1Es: "Pague su factura de Verizon sin iniciar sesión" },
  "topup-crc": { name: "Cricket", h1En: "Pay Your Cricket Wireless Bill as a Guest — With Your Phone Number", h1Es: "Pagar Cricket por teléfono — con tarjeta, sin iniciar sesión", sublineEn: "No login. Pay online with a debit or credit card.", sublineEs: "Solo con su número de teléfono de Cricket. Tarjeta de débito o crédito.", titleEn: "Pay Your Cricket Bill as a Guest | CellPay", titleEs: "Pague Cricket en línea | CellPay" },
  h2o: { name: "H2O", h1En: "Pay Your H2O Wireless Bill Without Signing In", h1Es: "Pague su factura de H2O sin iniciar sesión" },
  s1: { name: "Simple Mobile", h1Es: "Pague su factura de Simple Mobile sin iniciar sesión" },
  metropcs: { name: "Metro", h1En: "MetroPCS Bill Payment Online — Pay as a Guest", h1Es: "Pagar MetroPCS por teléfono — solo con su número", sublineEn: "No login or PIN. Enter the Metro by T-Mobile phone number and pay online with a debit or credit card.", sublineEs: "Sin cuenta ni PIN. Ingrese el número de Metro by T-Mobile y pague en línea con tarjeta de débito o crédito.", titleEn: "Pay Your MetroPCS Bill as a Guest | CellPay", titleEs: "Pague su factura de MetroPCS como invitado | CellPay" },
};

/** Route slug (/go/<slug>) -> carrierSlug. */
const ROUTE_TO_CARRIER: Record<string, string> = {
  boost: "boost",
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
  const subline = (lang === "es" ? r.sublineEs : r.sublineEn) ?? goSublineFor(r.name, lang);
  const title = (lang === "es" ? r.titleEs : r.titleEn) ?? (h1 ? `${h1} | CellPay` : undefined);
  return { h1, title, subline };
};

/** Static shell: by build route ("go/att.html", "es/go/att/index.html"). null = unchanged page. */
export const goLpxForRoute = (route: string): GoLpx | null => {
  const m = /^(es\/)?go\/([a-z0-9-]+?)(?:\/index)?\.html$/.exec(route);
  if (!m) return null;
  const carrier = ROUTE_TO_CARRIER[m[2]];
  return carrier ? goLpxForCarrier(carrier, m[1] ? "es" : "en") : null;
};
