// FAILPAY-EMAIL-1008 (CellPay US): failed-payment follow-up email, EN/ES. Plain ESM JS so the same file runs in the Supabase
// edge function (Deno) and in local tests (Node). Content rules (Fraud & QA screen): no decline reason, no card digits, no
// marketing, neutral "didn't go through, try again", link prefilled with carrier + amount only (no phone in the URL),
// suggest another method, unsubscribe link. Copy bans (house rules): never instant / free / no fees / 24/7 / PIN / refunds promise.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const CARRIER_NAMES = {
  s1: "Simple Mobile", "topup-crc": "Cricket Wireless", metropcs: "Metro by T-Mobile", tmobile: "T-Mobile", "topup-at": "AT&T Prepaid",
  verizon: "Verizon Prepaid", boost: "Boost Mobile", h2o: "H2O Wireless", lyca: "Lyca Mobile", net10: "Net10 Wireless", pageplus: "Page Plus",
  tracfone: "TracFone", "ultra-mobile": "Ultra Mobile", pageplusadd: "Page Plus", "total-wireless": "Total Wireless",
  "straight-talk": "Straight Talk", uscellular: "US Cellular", att: "AT&T Prepaid",
};
export const carrierName = (slug) => CARRIER_NAMES[String(slug || "").toLowerCase()] || "";

/** Other ways to pay, never repeating the method that just failed. */
function otherMethods(lang, failedMethod) {
  const m = String(failedMethod || "").toLowerCase();
  const en = { applepay: "Apple Pay", googlepay: "Google Pay", pockyt: "Cash App", card: "a different card" };
  const es = { applepay: "Apple Pay", googlepay: "Google Pay", pockyt: "Cash App", card: "otra tarjeta" };
  const names = lang === "es" ? es : en;
  const keys = ["applepay", "googlepay", "pockyt", "card"].filter((k) => k !== m);
  const list = keys.map((k) => names[k]);
  const last = list.pop();
  return `${list.join(", ")} ${lang === "es" ? "u" : "or"} ${last}`;
}

/**
 * v: { lang: "en"|"es", carrierSlug, amount, method, (phoneLast4 ignored since v3), refunded: boolean, refillUrl, unsubUrl, postal?, test?: boolean }
 * returns { subject, html, text }
 */
export function failpayEmail(v) {
  const es = v.lang === "es";
  const c = carrierName(v.carrierSlug) || (es ? "su operador" : "your carrier");
  const amt = Number(v.amount) > 0 ? money(v.amount) : "";
  // v3: no phone digits in the body (Fraud & QA: a mistyped email must not show a stranger any digits). phoneLast4 is ignored.
  const pre = v.test ? "[TEST] " : "";
  const subject = pre + (v.refunded ? (es ? "Su recarga no se completó" : "Your refill didn't go through")
                                    : (es ? "Su recarga no se completó. No se le cobró." : "Your refill didn't go through. You were not charged."));
  const h1 = es ? "Su recarga no se completó" : "Your refill didn't go through";
  const what = es
    ? `Su recarga de ${c}${amt ? ` de ${amt}` : ""} no se completó.`
    : `Your ${c} refill${amt ? ` of ${amt}` : ""} didn't go through.`;
  const charged = v.refunded
    ? (es ? "Cualquier cargo de ese intento se revirtió automáticamente. Su banco podría mostrarlo como pendiente por un tiempo."
          : "Any charge from that attempt was reversed automatically. Your bank may show it as pending for a short time.")
    : String(v.method || "").toLowerCase() === "pockyt"
      ? (es ? "No se le hizo ningún cargo." : "You were NOT charged.")
      : (es ? "No se hizo ningún cargo a su tarjeta." : "Your card was NOT charged.");
  // v2 (Parvez 10:03 CT): declined-auth hold note, directly under the NOT charged line (not on the refunded variant).
  const hold = v.refunded ? "" : (es
    ? "Si ve un cargo pendiente en su cuenta, es una retención temporal de su banco. Se eliminará automáticamente en 24–48 horas."
    : "If you see a pending charge on your account, it's a temporary hold from your bank. It will be removed automatically within 24–48 hours.");
  const finish = es ? "Puede terminar su recarga en unos pasos. El operador y el monto ya están listos; solo escriba su número."
                    : "You can finish your refill in a few steps. Your carrier and amount are ready; just enter your number.";
  const cta = es ? "Terminar mi recarga" : "Finish my refill";
  const tip = es ? `Consejo: pruebe pagar con ${otherMethods("es", v.method)}.` : `Tip: try paying with ${otherMethods("en", v.method)}.`;
  const help = es ? "¿Preguntas? Responda a este correo o escriba a support@getcellpay.com." : "Questions? Reply to this email or write to support@getcellpay.com.";
  const why = es ? "Recibe este único correo porque un pago de recarga en CellPay no se completó."
                 : "You're getting this one-time email because a refill payment on CellPay didn't go through.";
  const unsub = es ? "Darse de baja" : "Unsubscribe";
  const postal = v.postal && !String(v.postal).includes("__SET_ME__") ? `<br>CellPay · ${esc(v.postal)}` : "<br>CellPay";
  const testTxt = es ? "CORREO DE PRUEBA con datos falsos. No es una transacción real." : "TEST email with fake order data. Not a real transaction.";
  const testBanner = v.test ? `<p style="background:#fff3cd;border:1px solid #f0d27a;border-radius:6px;padding:8px 10px;font-size:13px;margin:0 0 16px">${esc(testTxt)}</p>` : "";
  const html = `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222"><div style="max-width:520px;margin:0 auto;padding:24px 16px">` +
    `<div style="background:#fff;border-radius:10px;padding:24px">${testBanner}` +
    `<h1 style="font-size:20px;margin:0 0 12px">${esc(h1)}</h1>` +
    `<p style="margin:0 0 12px;line-height:1.5">${esc(what)}</p>` +
    `<p style="margin:0 0 ${hold ? "6" : "12"}px;line-height:1.5;font-weight:bold">${esc(charged)}</p>` +
    (hold ? `<p style="margin:0 0 12px;line-height:1.5;font-size:14px;color:#444">${esc(hold)}</p>` : "") +
    `<p style="margin:0 0 4px;line-height:1.5">${esc(finish)}</p>` +
    `<p style="margin:24px 0"><a href="${esc(v.refillUrl)}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:8px;display:inline-block">${esc(cta)}</a></p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="background:#f1f8f4;border:1px solid #cfe8d9;border-radius:8px;padding:12px 14px;line-height:1.5;font-size:15px">${esc(tip)}</td></tr></table>` +
    `<p style="margin:0;font-size:14px;color:#444;line-height:1.5">${esc(help)}</p></div>` +
    `<div style="font-size:12px;color:#666;padding:16px 4px;line-height:1.5">${esc(why)}<br><a href="${esc(v.unsubUrl)}" style="color:#666">${unsub}</a>${postal}</div>` +
    `</div></body></html>`;
  const text = `${v.test ? testTxt + "\n\n" : ""}${h1}\n\n${what}\n${charged}\n${hold ? hold + "\n" : ""}\n${finish}\n${cta}: ${v.refillUrl}\n\n${tip}\n${help}\n\n--\n${why}\n${unsub}: ${v.unsubUrl}\nCellPay${v.postal && !String(v.postal).includes("__SET_ME__") ? ` · ${v.postal}` : ""}\n`;
  return { subject, html, text };
}

/** Banned-copy check used by tests. */
export const BANNED = [/instant/i, /\bfree\b/i, /no fees?/i, /24\/7/i, /\bPIN\b/, /declin/i, /insufficient/i, /fraud/i, /flagged/i, /\b\d{4}\s?\d{4}\b/];
