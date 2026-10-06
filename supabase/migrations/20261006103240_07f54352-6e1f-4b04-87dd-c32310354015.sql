-- retention-1006 email (CellPay US, Parvez approved 2026-10-06): opt-in refill reminders + Auto Pay pre-charge notice, SHADOW. Additive only; sends nothing.
CREATE TABLE IF NOT EXISTS public.retention_email_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.retention_email_settings (key, value) VALUES
  ('reminders_mode', 'shadow'),
  ('autopay_notice_mode', 'shadow'),
  ('autopay_allow_estimate', 'false'),
  ('holdout_pct', '10'),
  ('daily_cap', '300'),
  ('send_window_ct', '10-18'),
  ('from_address', 'reminders@notify.cellpay.us'),
  ('from_name', '__SET_ME__'),
  ('reply_to', 'support@getcellpay.com'),
  ('postal_address', '__SET_ME__')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.retention_email_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.reminder_consent_texts (
  version text NOT NULL,
  lang text NOT NULL CHECK (lang IN ('en','es')),
  consent_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version, lang)
);
INSERT INTO public.reminder_consent_texts (version, lang, consent_text) VALUES
  ('v1','en','Email me a reminder before my next refill. About 4 weeks after this payment, and once more early next month if I have not refilled. Up to 2 emails a month. Unsubscribe anytime.'),
  ('v1','es','Envíenme un correo antes de mi próxima recarga. Unas 4 semanas después de este pago, y otra vez a principios del próximo mes si no he recargado. Hasta 2 correos al mes. Puede darse de baja cuando quiera.')
ON CONFLICT (version, lang) DO NOTHING;
ALTER TABLE public.reminder_consent_texts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.reminder_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  phone text NOT NULL CHECK (phone ~ '^[0-9]{10}$'),
  email text NOT NULL CHECK (length(email) BETWEEN 6 AND 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_sha256 text NOT NULL,
  carrier text,
  carrier_slug text,
  amount numeric(10,2),
  consent_at timestamptz NOT NULL,
  consent_text text NOT NULL,
  consent_version text NOT NULL,
  source text NOT NULL CHECK (source IN ('order_confirmation','checkout')),
  lang text NOT NULL CHECK (lang IN ('en','es')),
  host text,
  order_id uuid,
  hashid text,
  ip_hash text,
  holdout boolean NOT NULL DEFAULT false,
  unsubscribed_at timestamptz,
  unsubscribe_source text,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  UNIQUE (phone, email_sha256)
);
CREATE INDEX IF NOT EXISTS reminder_optins_active ON public.reminder_optins (phone) WHERE unsubscribed_at IS NULL;
ALTER TABLE public.reminder_optins ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.email_suppression (
  email_sha256 text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint','manual')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_suppression ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('refill_reminder','autopay_notice')),
  touch text NOT NULL CHECK (touch IN ('day27','month_start','precharge')),
  mode text NOT NULL CHECK (mode IN ('shadow','live')),
  status text NOT NULL CHECK (status IN ('would_send','queued','sending','sent','skipped','failed','failed_unknown')),
  skip_reason text,
  cycle_key text NOT NULL,
  optin_id uuid,
  order_id uuid,
  phone_last4 text,
  email_sha256 text,
  carrier_slug text,
  amount numeric(10,2),
  lang text,
  holdout boolean,
  last_refill_at timestamptz,
  charge_date date,
  charge_date_source text CHECK (charge_date_source IN ('cellpay_feed','estimate')),
  token_hash text UNIQUE,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  provider text,
  provider_ref text,
  sent_at timestamptz,
  error text,
  UNIQUE (kind, cycle_key, touch)
);
CREATE INDEX IF NOT EXISTS email_send_log_created ON public.email_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_queued ON public.email_send_log (status) WHERE status IN ('queued','sending');
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.retention_email_setting(_key text, _default text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT s.value FROM public.retention_email_settings s WHERE s.key = _key), _default);
$$;
CREATE OR REPLACE FUNCTION public.retention_bucket(_phone text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ((get_byte(decode(md5('rt1006:' || coalesce(_phone,'')), 'hex'), 0) * 256
         + get_byte(decode(md5('rt1006:' || coalesce(_phone,'')), 'hex'), 1)) % 100)::int;
$$;
CREATE OR REPLACE FUNCTION public.retention_is_fraud(_phone text, _email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.checkout_blocklist b
           WHERE b.active AND (b.expires_at IS NULL OR b.expires_at > now())
             AND ((b.key_type = 'phone' AND b.value_norm = public.blocklist_norm('phone', _phone))
               OR (b.key_type = 'email' AND b.value_norm = public.blocklist_norm('email', _email))))
      OR EXISTS (
           SELECT 1 FROM public.fraud_watch_lists w
           WHERE w.list = 'blocked' AND (w.value = _phone OR lower(w.value) = lower(coalesce(_email,''))));
$$;
CREATE OR REPLACE FUNCTION public.reminder_optin_create(_hashid text, _lang text, _consent_version text, _email text DEFAULT NULL,
                                                        _source text DEFAULT 'order_confirmation')
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  tx record; v_email text; v_text text; v_lang text := CASE WHEN _lang = 'es' THEN 'es' ELSE 'en' END;
  v_phone text; v_ip text; v_host text;
BEGIN
  IF _hashid IS NULL OR length(_hashid) NOT BETWEEN 4 AND 64 OR _hashid !~ '^[A-Za-z0-9_-]+$'
     OR _source NOT IN ('order_confirmation','checkout') THEN RETURN 'bad_input'; END IF;
  SELECT c.consent_text INTO v_text FROM public.reminder_consent_texts c WHERE c.version = _consent_version AND c.lang = v_lang;
  IF v_text IS NULL THEN RETURN 'bad_input'; END IF;
  SELECT t.id, t.phone_number, t.email, t.carrier_name, t.carrier_slug, t.amount, t.metadata->>'caller_host' AS host
    INTO tx
    FROM public.transaction_logs t
   WHERE t.created_at > now() - interval '6 hours' AND t.hashid = _hashid AND t.status = 'success'
   ORDER BY t.created_at DESC LIMIT 1;
  IF tx.id IS NULL THEN RETURN 'not_found'; END IF;
  v_phone := right(regexp_replace(coalesce(tx.phone_number,''), '\D', '', 'g'), 10);
  IF v_phone !~ '^[0-9]{10}$' THEN RETURN 'not_found'; END IF;
  v_email := lower(btrim(coalesce(tx.email,'')));
  IF v_email = '' OR v_email = 'customer@cellpay.us' THEN
    v_email := lower(btrim(coalesce(_email,'')));
  END IF;
  IF v_email = '' OR v_email = 'customer@cellpay.us' THEN RETURN 'need_email'; END IF;
  IF length(v_email) NOT BETWEEN 6 AND 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN 'bad_input'; END IF;
  BEGIN
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'cf-connecting-ip',
                                current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  EXCEPTION WHEN others THEN v_ip := ''; END;
  v_host := left(coalesce(tx.host, ''), 100);
  INSERT INTO public.reminder_optins AS o (phone, email, email_sha256, carrier, carrier_slug, amount, consent_at, consent_text, consent_version,
                                           source, lang, host, order_id, hashid, ip_hash, holdout)
  VALUES (v_phone, v_email, encode(extensions.digest(v_email, 'sha256'), 'hex'), tx.carrier_name, tx.carrier_slug, tx.amount, now(), v_text,
          _consent_version, _source, v_lang, NULLIF(v_host,''), tx.id, _hashid,
          CASE WHEN v_ip <> '' THEN encode(extensions.digest('rt1006ip:' || btrim(v_ip), 'sha256'), 'hex') END,
          public.retention_bucket(v_phone) < public.retention_email_setting('holdout_pct','10')::int)
  ON CONFLICT (phone, email_sha256) DO UPDATE
    SET updated_at = now(), carrier = EXCLUDED.carrier, carrier_slug = EXCLUDED.carrier_slug, amount = EXCLUDED.amount,
        consent_at = EXCLUDED.consent_at, consent_text = EXCLUDED.consent_text, consent_version = EXCLUDED.consent_version,
        source = EXCLUDED.source, lang = EXCLUDED.lang, host = EXCLUDED.host, order_id = EXCLUDED.order_id, hashid = EXCLUDED.hashid,
        ip_hash = EXCLUDED.ip_hash, unsubscribed_at = NULL, unsubscribe_source = NULL;
  DELETE FROM public.email_suppression s
   WHERE s.email_sha256 = encode(extensions.digest(v_email, 'sha256'), 'hex') AND s.reason = 'unsubscribe';
  RETURN 'ok';
END $$;
CREATE OR REPLACE FUNCTION public.reminder_unsubscribe(_token text, _source text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE o record;
BEGIN
  SELECT id, email_sha256 INTO o FROM public.reminder_optins WHERE token = _token;
  IF o.id IS NULL THEN RETURN 'not_found'; END IF;
  UPDATE public.reminder_optins SET unsubscribed_at = coalesce(unsubscribed_at, now()), unsubscribe_source = coalesce(unsubscribe_source, left(_source, 40)),
         updated_at = now() WHERE id = o.id;
  INSERT INTO public.email_suppression (email_sha256, reason, source) VALUES (o.email_sha256, 'unsubscribe', left(_source, 40))
    ON CONFLICT (email_sha256) DO NOTHING;
  RETURN 'ok';
END $$;
CREATE OR REPLACE FUNCTION public.retention_reminder_plan(_now timestamptz DEFAULT now())
RETURNS TABLE (optin_id uuid, cycle_key text, order_id uuid, touch text, skip_reason text, phone_last4 text, email_sha256 text,
               carrier_slug text, amount numeric, lang text, holdout boolean, last_refill_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH o AS (
    SELECT * FROM public.reminder_optins WHERE unsubscribed_at IS NULL
  ), last AS (
    SELECT o.id AS optin_id, o.phone, o.email, o.email_sha256, o.lang, o.holdout, t.id AS tx_id, t.created_at, t.carrier_slug, t.amount,
           ((_now AT TIME ZONE 'America/Chicago')::date - (t.created_at AT TIME ZONE 'America/Chicago')::date) AS age_days
    FROM o
    CROSS JOIN LATERAL (
      SELECT x.id, x.created_at, x.carrier_slug, x.amount FROM public.transaction_logs x
      WHERE x.phone_number = o.phone AND x.status = 'success' AND x.created_at > _now - interval '60 days' AND x.created_at <= _now
      ORDER BY x.created_at DESC LIMIT 1) t
  ), cand AS (
    SELECT l.*, 'day27'::text AS touch FROM last l
     WHERE l.age_days BETWEEN 27 AND 30
       AND NOT EXISTS (SELECT 1 FROM public.email_send_log g WHERE g.kind = 'refill_reminder' AND g.cycle_key = l.tx_id::text AND g.touch = 'day27')
    UNION ALL
    SELECT l.*, 'month_start'::text FROM last l
     WHERE extract(day FROM (_now AT TIME ZONE 'America/Chicago')) BETWEEN 1 AND 3
       AND EXISTS (SELECT 1 FROM public.email_send_log g WHERE g.kind = 'refill_reminder' AND g.cycle_key = l.tx_id::text AND g.touch = 'day27'
                     AND (g.status IN ('sent','would_send') OR g.skip_reason = 'holdout')
                     AND g.created_at <= _now - interval '3 days' AND g.created_at > _now - interval '30 days')
       AND NOT EXISTS (SELECT 1 FROM public.email_send_log g WHERE g.kind = 'refill_reminder' AND g.cycle_key = l.tx_id::text AND g.touch = 'month_start')
  )
  SELECT c.optin_id, c.tx_id::text, c.tx_id, c.touch,
         CASE
           WHEN EXISTS (SELECT 1 FROM public.transaction_logs a WHERE a.phone_number = c.phone AND a.status = 'success'
                          AND a.created_at > _now - interval '40 days' AND a.metadata->>'autopay' = 'true') THEN 'autopay'
           WHEN public.retention_is_fraud(c.phone, c.email) THEN 'fraud'
           WHEN EXISTS (SELECT 1 FROM public.email_suppression s WHERE s.email_sha256 = c.email_sha256) THEN 'suppressed'
           WHEN c.holdout THEN 'holdout'
         END,
         right(c.phone, 4), c.email_sha256, c.carrier_slug, c.amount, c.lang, c.holdout, c.created_at
  FROM cand c;
$$;
CREATE OR REPLACE FUNCTION public.retention_reminder_run(_now timestamptz DEFAULT now(), _ignore_window boolean DEFAULT false)
RETURNS TABLE (log_id uuid, status text, skip_reason text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_mode text := public.retention_email_setting('reminders_mode', 'shadow');
        v_win text := public.retention_email_setting('send_window_ct', '10-18');
        v_hour int := extract(hour FROM (_now AT TIME ZONE 'America/Chicago'))::int;
BEGIN
  IF v_mode = 'off' THEN RETURN; END IF;
  IF v_mode NOT IN ('shadow','live') THEN v_mode := 'shadow'; END IF;
  IF NOT _ignore_window AND v_hour NOT BETWEEN split_part(v_win,'-',1)::int AND split_part(v_win,'-',2)::int THEN RETURN; END IF;
  RETURN QUERY
  INSERT INTO public.email_send_log AS g (created_at, kind, touch, mode, status, skip_reason, cycle_key, optin_id, order_id, phone_last4, email_sha256,
                                         carrier_slug, amount, lang, holdout, last_refill_at)
  SELECT _now, 'refill_reminder', p.touch, v_mode,
         CASE WHEN p.skip_reason IS NOT NULL THEN 'skipped' WHEN v_mode = 'live' THEN 'queued' ELSE 'would_send' END,
         p.skip_reason, p.cycle_key, p.optin_id, p.order_id, p.phone_last4, p.email_sha256, p.carrier_slug, p.amount, p.lang, p.holdout, p.last_refill_at
  FROM public.retention_reminder_plan(_now) p
  ON CONFLICT (kind, cycle_key, touch) DO NOTHING
  RETURNING g.id, g.status, g.skip_reason;
END $$;
CREATE OR REPLACE FUNCTION public.autopay_notice_plan(_now timestamptz DEFAULT now())
RETURNS TABLE (cycle_key text, order_id uuid, charge_date date, skip_reason text, phone_last4 text, email_sha256 text, carrier_slug text, amount numeric, lang text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH today AS (SELECT (_now AT TIME ZONE 'America/Chicago')::date AS d),
  enr AS (
    SELECT DISTINCT ON (t.phone_number) t.id, t.phone_number, lower(btrim(t.email)) AS email, t.carrier_slug, t.amount, t.created_at,
           (t.created_at AT TIME ZONE 'America/Chicago')::date AS d0
    FROM public.transaction_logs t
    WHERE t.status = 'success' AND t.metadata->>'autopay' = 'true' AND t.created_at <= _now
      AND t.created_at > greatest(_now - interval '400 days', timestamptz '2026-10-04 07:29:00-05')
    ORDER BY t.phone_number, t.created_at DESC
  ), nxt AS (
    SELECT e.*, (SELECT (e.d0 + make_interval(months => n))::date FROM generate_series(1, 14) n
                  WHERE (e.d0 + make_interval(months => n))::date > (SELECT d FROM today) ORDER BY n LIMIT 1) AS charge
    FROM enr e
  )
  SELECT n.id::text || ':' || n.charge::text, n.id, n.charge,
         CASE
           WHEN public.retention_is_fraud(n.phone_number, n.email) THEN 'fraud'
           WHEN EXISTS (SELECT 1 FROM public.email_suppression s WHERE s.email_sha256 = encode(extensions.digest(coalesce(n.email,''), 'sha256'), 'hex')
                          AND s.reason IN ('bounce','complaint')) THEN 'suppressed_bounce'
           WHEN n.email IS NULL OR n.email = '' OR n.email = 'customer@cellpay.us' THEN 'no_email'
         END,
         right(n.phone_number, 4), encode(extensions.digest(coalesce(n.email,''), 'sha256'), 'hex'), n.carrier_slug, n.amount, 'en'
  FROM nxt n, today
  WHERE n.charge IS NOT NULL AND (n.charge - today.d) BETWEEN 1 AND 3
    AND NOT EXISTS (SELECT 1 FROM public.email_send_log g WHERE g.kind = 'autopay_notice' AND g.cycle_key = n.id::text || ':' || n.charge::text);
$$;
CREATE OR REPLACE FUNCTION public.autopay_notice_run(_now timestamptz DEFAULT now(), _ignore_window boolean DEFAULT false)
RETURNS TABLE (log_id uuid, status text, skip_reason text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_mode text := public.retention_email_setting('autopay_notice_mode', 'shadow');
        v_est boolean := public.retention_email_setting('autopay_allow_estimate', 'false') = 'true';
        v_win text := public.retention_email_setting('send_window_ct', '10-18');
        v_hour int := extract(hour FROM (_now AT TIME ZONE 'America/Chicago'))::int;
BEGIN
  IF v_mode = 'off' THEN RETURN; END IF;
  IF v_mode NOT IN ('shadow','live') OR NOT v_est THEN v_mode := 'shadow'; END IF;
  IF NOT _ignore_window AND v_hour NOT BETWEEN split_part(v_win,'-',1)::int AND split_part(v_win,'-',2)::int THEN RETURN; END IF;
  RETURN QUERY
  INSERT INTO public.email_send_log AS g (created_at, kind, touch, mode, status, skip_reason, cycle_key, order_id, phone_last4, email_sha256, carrier_slug,
                                         amount, lang, charge_date, charge_date_source)
  SELECT _now, 'autopay_notice', 'precharge', v_mode,
         CASE WHEN p.skip_reason IS NOT NULL THEN 'skipped' WHEN v_mode = 'live' THEN 'queued' ELSE 'would_send' END,
         p.skip_reason, p.cycle_key, p.order_id, p.phone_last4, p.email_sha256, p.carrier_slug, p.amount, p.lang, p.charge_date, 'estimate'
  FROM public.autopay_notice_plan(_now) p
  ON CONFLICT (kind, cycle_key, touch) DO NOTHING
  RETURNING g.id, g.status, g.skip_reason;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'retention_email_hmac_key') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'retention_email_hmac_key', 'retention-1006: HMAC key for unsubscribe / cancel links');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'retention_email_cron_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'retention_email_cron_token', 'retention-1006: pg_cron -> send-reminders / autopay-notice auth');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.retention_email_cron_auth(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(length(_token) = 64 AND _token = (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'retention_email_cron_token' LIMIT 1), false);
$$;
CREATE OR REPLACE FUNCTION public.retention_email_hmac_key()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'retention_email_hmac_key' LIMIT 1;
$$;
REVOKE ALL ON public.retention_email_settings, public.reminder_consent_texts, public.reminder_optins, public.email_suppression, public.email_send_log
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retention_email_setting(text, text), public.retention_bucket(text), public.retention_is_fraud(text, text),
  public.reminder_optin_create(text, text, text, text, text), public.reminder_unsubscribe(text, text),
  public.retention_reminder_plan(timestamptz), public.retention_reminder_run(timestamptz, boolean),
  public.autopay_notice_plan(timestamptz), public.autopay_notice_run(timestamptz, boolean),
  public.retention_email_cron_auth(text), public.retention_email_hmac_key()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_email_setting(text, text), public.retention_bucket(text), public.retention_is_fraud(text, text),
  public.reminder_optin_create(text, text, text, text, text), public.reminder_unsubscribe(text, text),
  public.retention_reminder_plan(timestamptz), public.retention_reminder_run(timestamptz, boolean),
  public.autopay_notice_plan(timestamptz), public.autopay_notice_run(timestamptz, boolean),
  public.retention_email_cron_auth(text), public.retention_email_hmac_key()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reminder_optin_create(text, text, text, text, text) TO anon, authenticated;