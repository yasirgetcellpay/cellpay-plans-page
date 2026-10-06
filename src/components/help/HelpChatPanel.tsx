// Help chat panel: deterministic FAQ answers, order status lookup, contact form.
// Talks only to the order-status / support-contact edge functions. No checkout/relay imports.
// Auto Pay: rendered by HelpAutoPayCancel (lazy), which reuses the live AP-1 HelpQuickActions cancel unchanged.
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Mail, Send, ShieldAlert, X, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { langPath } from "@/lib/i18n";
import { HELP_CARRIERS, type HelpCarrier } from "./helpRoutes";
import type { HelpFlags } from "./helpSettings";
import { QUICK_REPLIES, STRINGS, answerFor, isFaqTopic, matchIntent, offersSupportAfter, type HelpIntent, type HelpLang } from "./helpFaq";
import { careFor } from "./helpCarrierCare";
import { MAX_MESSAGE, MAX_NAME, cleanLast4, cleanPhone, errorKindFor, formatPhoneInput, isDoNotPayAgain, isValidContact, parseOrderCards, parseOrderStatus, type HelpErrorKind, type OrderCard, type OrderStatusValue } from "./helpValidate";

const HelpAutoPayCancel = lazy(() => import("./HelpAutoPayCancel"));

type View = "chat" | "order" | "contact";
type OrderResult = OrderStatusValue | HelpErrorKind;

interface Msg { id: number; from: "bot" | "user"; lines: string[]; carriers?: HelpCarrier[] | "all"; quick?: boolean; autopay?: boolean; support?: boolean; }

const SUPPORT_EMAIL = "support@getcellpay.com"; // CellPay lists no support phone number.

/** Status code from a supabase.functions.invoke error (FunctionsHttpError carries the Response). */
function errorStatus(err: unknown): number {
  const ctx = (err as { context?: { status?: number } } | null)?.context;
  return typeof ctx?.status === "number" ? ctx.status : 0;
}

let nextId = 1;

interface Props { open: boolean; lang: HelpLang; flags: HelpFlags; onClose: () => void; }

/** Quick replies minus the forms that help_settings has switched off. */
function quickFor(flags: HelpFlags): HelpIntent[] {
  return QUICK_REPLIES.filter((q) => (q !== "order_status" || flags.status_enabled) && (q !== "contact" || flags.contact_enabled));
}

const HelpChatPanel = ({ open, lang, flags, onClose }: Props) => {
  const s = STRINGS[lang];
  const [view, setView] = useState<View>("chat");
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: nextId++, from: "bot", lines: [s.ui.greeting], quick: true }]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-greet in the right language if the visitor switches EN <-> ES.
  useEffect(() => {
    setMsgs([{ id: nextId++, from: "bot", lines: [STRINGS[lang].ui.greeting], quick: true }]);
    setView("chat");
  }, [lang]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[role='dialog'][data-state='open']:not(#cp-help-panel)")) return; // AP-1 dialog on top
      onClose();
    };
    window.addEventListener("keydown", onKey);
    if (view === "chat") setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, view]);

  // Chat: keep the newest message in view. Forms: start at the top (card warning + hours first).
  useEffect(() => { if (view === "chat") listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs, view]);
  useEffect(() => { if (view !== "chat") listRef.current?.scrollTo({ top: 0 }); }, [view]);

  const respond = (intent: HelpIntent | null, userLine: string, carriers: HelpCarrier[] = []) => {
    const add: Msg[] = [{ id: nextId++, from: "user", lines: [userLine] }];
    const formOff = (intent === "order_status" && !flags.status_enabled) || (intent === "contact" && !flags.contact_enabled);
    if ((intent === "order_status" || intent === "contact") && !formOff) {
      setMsgs((m) => [...m, ...add]);
      setView(intent === "order_status" ? "order" : "contact");
      return;
    }
    if (intent === "autopay") {
      add.push({ id: nextId++, from: "bot", lines: s.autopay.lines, autopay: true, quick: true });
    } else if (formOff) {
      add.push({ id: nextId++, from: "bot", lines: [s.ui.footer], quick: true });
    } else if (isFaqTopic(intent)) {
      add.push({
        id: nextId++, from: "bot", lines: [...answerFor(intent, lang), ...careFor(intent, carriers, lang)],
        carriers: intent === "carriers" ? (carriers.length ? carriers : "all") : undefined,
        support: offersSupportAfter(intent) || undefined,
        quick: true,
      });
    } else {
      add.push({ id: nextId++, from: "bot", lines: [s.ui.fallback], quick: true });
    }
    setMsgs((m) => [...m, ...add]);
  };

  const onAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim().slice(0, 300);
    if (!q) return;
    setText("");
    const r = matchIntent(q);
    respond(r.intent, q, r.carriers);
  };

  if (!open) return null;
  const lastBotQuick = [...msgs].reverse().find((m) => m.from === "bot")?.id;

  return (
    // #9-fix1: phones = bottom 16px + safe area (the launcher steps aside while open) and the top stays >= 124px from the
    // top of the screen, below CellPay's sticky header (z-50, ~111px), so the close X is never under it. Desktop unchanged.
    <div
      id="cp-help-panel"
      role="dialog"
      aria-label={s.ui.title}
      data-testid="help-panel"
      className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] md:bottom-20 z-40 flex w-[min(380px,calc(100vw-2rem))] max-h-[calc(100dvh-140px-env(safe-area-inset-bottom))] md:max-h-[min(620px,calc(100vh-6.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 bg-cellpay-green px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold leading-tight">{s.ui.title}</p>
          <p className="text-[12px] text-white/85">{s.ui.subtitle}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={s.ui.close} className="-mr-2 -mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {view !== "chat" && (
        <button type="button" onClick={() => setView("chat")} className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-left text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {s.ui.back}
        </button>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {view === "chat" && msgs.map((m) => (
          <div key={m.id} className={`mb-3 flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={m.from === "user"
              ? "max-w-[85%] rounded-2xl rounded-br-sm bg-cellpay-green px-3 py-2 text-[14px] text-white"
              : "max-w-[92%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[14px] text-foreground"}>
              {m.lines.map((l, i) => <p key={i} className={i ? "mt-1.5" : ""}>{l}</p>)}
              {m.carriers && <CarrierLinks lang={lang} carriers={m.carriers} />}
              {m.support && (
                <button type="button" onClick={() => respond("contact", s.ui.stillNeedHelp)} data-testid="help-refund-support"
                  className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-cellpay-green underline underline-offset-2">
                  {s.ui.stillNeedHelp}
                </button>
              )}
              {m.autopay && (
                <Suspense fallback={null}>
                  <HelpAutoPayCancel openLabel={s.autopay.open} fallback={s.autopay.fallback} formLanguageNote={s.autopay.formLanguageNote} />
                </Suspense>
              )}
              {m.quick && m.id === lastBotQuick && (
                <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid="help-quick-replies">
                  {quickFor(flags).map((q) => (
                    <button key={q} type="button" onClick={() => respond(q, s.quick[q])}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-[12.5px] font-semibold text-cellpay-green hover:bg-cellpay-green hover:text-white">
                      {s.quick[q]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {view === "order" && flags.status_enabled && <OrderStatusForm lang={lang} onContact={() => setView(flags.contact_enabled ? "contact" : "chat")} />}
        {view === "contact" && flags.contact_enabled && <ContactForm lang={lang} />}
      </div>

      {view === "chat" && (
        <form onSubmit={onAsk} className="flex items-center gap-2 border-t border-border px-3 py-2.5">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
            placeholder={s.ui.inputPlaceholder} aria-label={s.ui.inputAria} data-testid="help-input"
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-[14px] outline-none focus:border-cellpay-green" />
          <button type="submit" aria-label={s.ui.send} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      )}
      <p className="border-t border-border px-4 py-1.5 text-center text-[11px] text-muted-foreground">{s.ui.footer}</p>
    </div>
  );
};

const CarrierLinks = ({ lang, carriers }: { lang: HelpLang; carriers: HelpCarrier[] | "all" }) => {
  const s = STRINGS[lang];
  const list = carriers === "all" ? HELP_CARRIERS : carriers;
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {list.map((c) => (
          <Link key={c.path} to={langPath(c.path, lang)} className="rounded-md bg-card px-2 py-1 text-[12.5px] font-semibold text-cellpay-green underline-offset-2 hover:underline">
            {c.name}
          </Link>
        ))}
      </div>
      {carriers !== "all" && (
        <Link to={langPath("/", lang)} className="mt-1.5 inline-block text-[12.5px] font-semibold text-cellpay-green underline">{s.ui.allCarriers}</Link>
      )}
    </div>
  );
};

const fieldCls = "mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-[14px] outline-none focus:border-cellpay-green";
const labelCls = "block text-[13px] font-semibold text-foreground";

const OrderStatusForm = ({ lang, onContact }: { lang: HelpLang; onContact: () => void }) => {
  const s = STRINGS[lang].orderStatus;
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [cards, setCards] = useState<OrderCard[]>([]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = cleanPhone(phone);
    if (!p) return setErr(s.invalidPhone);
    setErr(null); setBusy(true); setResult(null); setCards([]);
    try {
      const { data, error } = await supabase.functions.invoke("order-status", { body: { phone: p, lang } });
      if (error) setResult(errorKindFor(errorStatus(error)));
      else {
        setResult(parseOrderStatus(data) ?? "error");
        setCards(parseOrderCards(data));
      }
    } catch { setResult("error"); } finally { setBusy(false); }
  };

  const tone: Record<OrderResult, { cls: string; Icon: typeof CheckCircle2 }> = {
    success: { cls: "border-green-600/30 bg-green-50 text-green-900", Icon: CheckCircle2 },
    pending: { cls: "border-amber-500/40 bg-amber-50 text-amber-900", Icon: Clock },
    unconfirmed: { cls: "border-amber-500/40 bg-amber-50 text-amber-900", Icon: Clock },
    failed: { cls: "border-red-500/30 bg-red-50 text-red-900", Icon: XCircle },
    not_found: { cls: "border-border bg-muted text-foreground", Icon: AlertCircle },
    invalid: { cls: "border-border bg-muted text-foreground", Icon: AlertCircle },
    rate_limited: { cls: "border-border bg-muted text-foreground", Icon: AlertCircle },
    unavailable: { cls: "border-border bg-muted text-foreground", Icon: AlertCircle },
    error: { cls: "border-border bg-muted text-foreground", Icon: AlertCircle },
  };

  const cardLine = (c: OrderCard) => {
    const parts = [c.carrier || null, c.amount ? `$${c.amount}` : null, c.time_ct || null].filter(Boolean);
    const label = ({ success: s.cardSuccess, pending: s.cardPending, unconfirmed: s.cardUnconfirmed, failed: s.cardFailed } as Record<string, string>)[c.status] || c.status;
    return `${parts.join(" · ")}${parts.length ? " — " : ""}${label}`;
  };

  return (
    <form onSubmit={submit} noValidate data-testid="help-order-form">
      <h3 className="text-[16px] font-extrabold">{s.title}</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">{s.intro}</p>
      <label className={`${labelCls} mt-3`}>{s.phoneLabel}
        <input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} inputMode="tel" autoComplete="tel-national"
          placeholder={s.phonePlaceholder} className={fieldCls} data-testid="help-order-phone" />
      </label>
      {err && <p className="mt-2 text-[13px] font-semibold text-red-700" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="mt-3 h-10 w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {busy ? s.checking : s.submit}
      </button>
      {result && (() => { const { cls, Icon } = tone[result]; return (
        <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13.5px] ${cls}`} role="status" data-testid="help-order-result" data-do-not-pay-again={isDoNotPayAgain(result) ? "" : undefined}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p>{s.result[result]}</p>
            {cards.length > 0 && result !== "not_found" && result !== "invalid" && result !== "error" && result !== "rate_limited" && result !== "unavailable" && (
              <ul className="mt-2 space-y-1" data-testid="help-order-cards">
                {cards.map((c, i) => (
                  <li key={i} className="text-[12.5px] leading-snug">{cardLine(c)}</li>
                ))}
              </ul>
            )}
            {result !== "success" && (
              <button type="button" onClick={onContact} className="mt-1 text-[13px] font-bold underline">{STRINGS[lang].quick.contact}</button>
            )}
          </div>
        </div>
      ); })()}
    </form>
  );
};

const ContactForm = ({ lang }: { lang: HelpLang }) => {
  const s = STRINGS[lang].contact;
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [last4, setLast4] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length > MAX_NAME) return setErr(s.invalidName);
    if (!isValidContact(contact)) return setErr(s.invalidContact);
    if (!message.trim() || message.length > MAX_MESSAGE) return setErr(s.invalidMessage);
    if (last4.trim() && !cleanLast4(last4)) return setErr(s.invalidLast4);
    setErr(null); setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("support-contact", {
        body: {
          name: name.trim(), contact: contact.trim(), message: message.trim(),
          order_last4: last4.trim() || undefined, lang, page_path: window.location.pathname, website,
        },
      });
      if (error) setErr(s[errorKindFor(errorStatus(error))]);
      else setSent(true);
    } catch { setErr(s.error); } finally { setBusy(false); }
  };

  const direct = (
    <div className="mt-4 rounded-lg border border-border px-3 py-2.5 text-[13px]">
      <p className="font-bold">{s.directLabel}</p>
      <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 flex items-center gap-1.5 text-cellpay-green hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{SUPPORT_EMAIL}</a>
      <p className="mt-1 text-[12px] text-muted-foreground" data-testid="help-hours">
        <span className="block text-balance">{s.hoursWeekday}</span>
        <span className="block text-balance">{s.hoursWeekend}</span>
      </p>
    </div>
  );

  if (sent) {
    return (
      <div data-testid="help-contact-sent">
        <div className="flex items-start gap-2 rounded-lg border border-green-600/30 bg-green-50 px-3 py-2.5 text-[14px] text-green-900" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{s.sent}</p>
        </div>
        {direct}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate data-testid="help-contact-form">
      <h3 className="text-[16px] font-extrabold">{s.title}</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">{s.intro}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{s.hours}</p>
      <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{s.cardWarning}</p>
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots that fill it are silently ignored. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" /></label>
      </div>
      <label className={`${labelCls} mt-3`}>{s.nameLabel}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="name" className={fieldCls} />
      </label>
      <label className={`${labelCls} mt-3`}>{s.contactLabel}
        <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={254} autoComplete="email" className={fieldCls} />
      </label>
      <label className={`${labelCls} mt-3`}>{s.messageLabel}
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))} maxLength={MAX_MESSAGE} rows={4}
          className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[14px] outline-none focus:border-cellpay-green" />
        <span className="block text-right text-[11px] font-normal text-muted-foreground">{message.length}/{MAX_MESSAGE}</span>
      </label>
      <label className={`${labelCls} mt-1`}>{s.last4Label}
        <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))} maxLength={4}
          autoComplete="off" className={`${fieldCls} w-28 font-mono tracking-widest`} />
      </label>
      {err && <p className="mt-2 text-[13px] font-semibold text-red-700" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="mt-3 h-10 w-full rounded-lg bg-primary text-[14px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {busy ? s.sending : s.submit}
      </button>
      {direct}
    </form>
  );
};

export default HelpChatPanel;
