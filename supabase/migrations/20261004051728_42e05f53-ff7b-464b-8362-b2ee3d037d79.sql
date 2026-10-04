-- S3 M1: checkout velocity guard storage + RPCs (CellPay US). CellPay Fraud, Oct 3 2026. Ported from Callingmart C1
-- (callingmart-seo/card-testing/sql/m_card_testing_guard.sql) + turnstile-velocity-spec.md v3 §1 additions.
-- Additive only: 2 new tables + 2 new service_role-only functions. Touches no existing table, function, grant, policy or payment logic.
-- Hashed keys only (HMAC computed in cellpay-proxy); never a PAN/CVV/ZIP/raw phone/email/IP. Carrier CGNAT IPs arrive as ip_h NULL.
-- Can never block unless ALL hold: settings row db_enforce='on' (seeded 'off') AND _k.enforce=true AND payment_method='cardpayment'
-- AND the reason is listed in _k.enforce_rules. The P1 log-only proxy always sends enforce=false and enforce_rules=[].
-- Switches (row UPDATE only, ~30 s to take effect): see the comment on checkout_guard_settings and lovable-messages/KILL-S3LO-*.txt, SET-S3LO-frontend-deployed.txt.
-- Retention: rows older than 30 days are pruned by ~1% of checkout_guard_check calls (no cron needed).
BEGIN;

CREATE TABLE IF NOT EXISTS public.checkout_guard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  payment_method text,
  carrier_slug text,
  amount numeric,
  card_type text,
  phone_h text, email_h text, card_h text, visitor_h text, sess_h text, ip_h text,
  ip_src text,
  ip_class text,
  decision text NOT NULL DEFAULT 'allow',
  reason text,
  outcome text NOT NULL DEFAULT 'pending',
  turnstile text,
  mode text,
  CONSTRAINT checkout_guard_events_decision_chk CHECK (decision IN ('allow','block','shadow_block')),
  CONSTRAINT checkout_guard_events_outcome_chk CHECK (outcome IN ('pending','success','declined','error','blocked')),
  CONSTRAINT checkout_guard_events_ip_src_chk CHECK (ip_src IS NULL OR ip_src IN ('cf','xff','none')),
  CONSTRAINT checkout_guard_events_ip_class_chk CHECK (ip_class IS NULL OR ip_class IN ('cgnat_tmobile','cgnat_verizon','cgnat_att','cgnat_shared','other','none')),
  CONSTRAINT checkout_guard_events_cgnat_no_ip_chk CHECK (ip_class IS NULL OR ip_class NOT LIKE 'cgnat%' OR ip_h IS NULL)
);
CREATE INDEX IF NOT EXISTS cge_created_idx ON public.checkout_guard_events (created_at);
CREATE INDEX IF NOT EXISTS cge_phone_idx   ON public.checkout_guard_events (phone_h, created_at)   WHERE phone_h IS NOT NULL;
CREATE INDEX IF NOT EXISTS cge_email_idx   ON public.checkout_guard_events (email_h, created_at)   WHERE email_h IS NOT NULL;
CREATE INDEX IF NOT EXISTS cge_card_idx    ON public.checkout_guard_events (card_h, created_at)    WHERE card_h IS NOT NULL;
CREATE INDEX IF NOT EXISTS cge_visitor_idx ON public.checkout_guard_events (visitor_h, created_at) WHERE visitor_h IS NOT NULL;
CREATE INDEX IF NOT EXISTS cge_sess_idx    ON public.checkout_guard_events (sess_h, created_at)    WHERE sess_h IS NOT NULL;
CREATE INDEX IF NOT EXISTS cge_ip_idx      ON public.checkout_guard_events (ip_h, created_at)      WHERE ip_h IS NOT NULL;
ALTER TABLE public.checkout_guard_events ENABLE ROW LEVEL SECURITY;  -- no policies: browser roles can neither read nor write
REVOKE ALL ON TABLE public.checkout_guard_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_guard_events TO service_role;
COMMENT ON TABLE public.checkout_guard_events IS 'S3 velocity guard: one row per checkout/transaction attempt seen by cellpay-proxy. HMAC-hashed keys only; carrier CGNAT IPs stored as ip_h NULL. Retention 30 days (pruned by checkout_guard_check).';

CREATE TABLE IF NOT EXISTS public.checkout_guard_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- P1 log-only value set. Any later enforce value needs its own reviewed migration that widens this constraint.
  CONSTRAINT checkout_guard_settings_value_chk CHECK (
       (key IN ('turnstile_mode', 'velocity_mode') AND value IN ('shadow', 'off'))
    OR (key = 'db_enforce' AND value IN ('off', 'on'))
    OR (key = 'velocity_enforce_rules' AND value ~ '^[a-z0-9_,]*$')
    OR (key = 'frontend_deployed_at' AND value ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'))
);
ALTER TABLE public.checkout_guard_settings ENABLE ROW LEVEL SECURITY;  -- no policies
REVOKE ALL ON TABLE public.checkout_guard_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_guard_settings TO service_role;
COMMENT ON TABLE public.checkout_guard_settings IS 'S3 guard settings, read by cellpay-proxy every 30 s. Change them with a row UPDATE only (no secret or owner step). turnstile_mode / velocity_mode = shadow|off (both off = S3 kill switch). db_enforce = off|on is the database-side enforce flag: while off, checkout_guard_check never returns block. frontend_deployed_at = ISO time of the last front-end deploy: Turnstile missing verdicts within 10 min of it are stored as missing_grace.';
INSERT INTO public.checkout_guard_settings (key, value) VALUES
  ('turnstile_mode', 'shadow'), ('velocity_mode', 'shadow'), ('db_enforce', 'off'), ('frontend_deployed_at', '1970-01-01T00:00:00Z')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.checkout_guard_check(_k jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  l jsonb := CASE WHEN jsonb_typeof(_k->'limits') = 'object' THEN _k->'limits' ELSE '{}'::jsonb END;
  w interval;
  lim_card int; lim_phone int; lim_email int; lim_visitor int; lim_ip int; lim_sess int; lim_ipa int; lim_cards int; lim_ppc int; lim_p24 int;
  k_phone text := NULLIF(left(_k->>'phone_h', 64), '');
  k_email text := NULLIF(left(_k->>'email_h', 64), '');
  k_card text := NULLIF(left(_k->>'card_h', 64), '');
  k_visitor text := NULLIF(left(_k->>'visitor_h', 64), '');
  k_sess text := NULLIF(left(_k->>'sess_h', 64), '');
  k_ip text := NULLIF(left(_k->>'ip_h', 64), '');
  v_ip_src text := CASE WHEN _k->>'ip_src' IN ('cf','xff','none') THEN _k->>'ip_src' END;
  v_ip_class text := CASE WHEN _k->>'ip_class' IN ('cgnat_tmobile','cgnat_verizon','cgnat_att','cgnat_shared','other','none') THEN _k->>'ip_class' END;
  v_method text := left(_k->>'payment_method', 40);
  is_card boolean;
  enforce boolean := false;
  rules text[] := '{}';
  db_on boolean := false;
  since timestamptz;
  reason text;
  anchor timestamptz;
  span interval;
  retry int := 0;
  dec text := 'allow';
  new_id uuid;
BEGIN
  lim_card    := CASE WHEN l->>'card_declines'      ~ '^\d{1,4}$' THEN LEAST((l->>'card_declines')::int, 1000)      ELSE 3  END;
  lim_phone   := CASE WHEN l->>'phone_declines'     ~ '^\d{1,4}$' THEN LEAST((l->>'phone_declines')::int, 1000)     ELSE 3  END;
  lim_email   := CASE WHEN l->>'email_declines'     ~ '^\d{1,4}$' THEN LEAST((l->>'email_declines')::int, 1000)     ELSE 3  END;
  lim_visitor := CASE WHEN l->>'visitor_declines'   ~ '^\d{1,4}$' THEN LEAST((l->>'visitor_declines')::int, 1000)   ELSE 3  END;
  lim_ip      := CASE WHEN l->>'ip_declines'        ~ '^\d{1,4}$' THEN LEAST((l->>'ip_declines')::int, 1000)        ELSE 4  END;
  lim_sess    := CASE WHEN l->>'session_attempts'   ~ '^\d{1,4}$' THEN LEAST((l->>'session_attempts')::int, 1000)   ELSE 5  END;
  lim_ipa     := CASE WHEN l->>'ip_attempts'        ~ '^\d{1,4}$' THEN LEAST((l->>'ip_attempts')::int, 1000)        ELSE 10 END;
  lim_cards   := CASE WHEN l->>'distinct_cards'     ~ '^\d{1,4}$' THEN LEAST((l->>'distinct_cards')::int, 1000)     ELSE 3  END;
  lim_ppc     := CASE WHEN l->>'phones_per_card'    ~ '^\d{1,4}$' THEN LEAST((l->>'phones_per_card')::int, 1000)    ELSE 3  END;
  lim_p24     := CASE WHEN l->>'phone_declines_24h' ~ '^\d{1,4}$' THEN LEAST((l->>'phone_declines_24h')::int, 1000) ELSE 0  END;
  w := make_interval(mins => CASE WHEN l->>'window_min' ~ '^\d{1,5}$' THEN LEAST(GREATEST((l->>'window_min')::int, 1), 1440) ELSE 60 END);
  since := now() - w;
  is_card := lower(coalesce(v_method, '')) = 'cardpayment';
  enforce := coalesce(_k->>'enforce', '') = 'true';
  IF jsonb_typeof(_k->'enforce_rules') = 'array' THEN
    SELECT coalesce(array_agg(left(x, 40)), '{}') INTO rules FROM jsonb_array_elements_text(_k->'enforce_rules') AS x;
  END IF;
  -- Carrier CGNAT (hard lock 5): never an IP-rule key, whatever the caller sent.
  IF coalesce(v_ip_class, '') LIKE 'cgnat%' THEN k_ip := NULL; END IF;

  -- Serialise concurrent attempts for the same card/phone so parallel requests can't both slip past (C1).
  PERFORM pg_advisory_xact_lock(hashtext('cge|' || coalesce(k_card, k_phone, k_visitor, k_ip, '')));

  -- n-th most recent counted event per key in the window; when it ages out, the key is allowed again (decay).
  IF k_card IS NOT NULL AND lim_card > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE card_h = k_card AND outcome = 'declined' AND created_at >= since ORDER BY created_at DESC OFFSET lim_card - 1 LIMIT 1;
    IF FOUND THEN reason := 'card_declines'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_phone IS NOT NULL AND lim_phone > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE phone_h = k_phone AND outcome = 'declined' AND created_at >= since ORDER BY created_at DESC OFFSET lim_phone - 1 LIMIT 1;
    IF FOUND THEN reason := 'phone_declines'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_email IS NOT NULL AND lim_email > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE email_h = k_email AND outcome = 'declined' AND created_at >= since ORDER BY created_at DESC OFFSET lim_email - 1 LIMIT 1;
    IF FOUND THEN reason := 'email_declines'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_visitor IS NOT NULL AND lim_visitor > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE visitor_h = k_visitor AND outcome = 'declined' AND created_at >= since ORDER BY created_at DESC OFFSET lim_visitor - 1 LIMIT 1;
    IF FOUND THEN reason := 'visitor_declines'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_sess IS NOT NULL AND lim_sess > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE sess_h = k_sess AND created_at >= since ORDER BY created_at DESC OFFSET lim_sess - 1 LIMIT 1;
    IF FOUND THEN reason := 'session_attempts'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_card IS NOT NULL AND lim_cards > 0 AND (k_phone IS NOT NULL OR k_email IS NOT NULL OR k_visitor IS NOT NULL OR k_ip IS NOT NULL) THEN
    -- card cycling: this is a NEW card and the same phone/email/device (or non-CGNAT IP) already used >= lim_cards other cards
    SELECT min(last_use) INTO anchor FROM (
      SELECT card_h, max(created_at) AS last_use FROM public.checkout_guard_events
      WHERE created_at >= since AND card_h IS NOT NULL AND card_h <> k_card AND outcome <> 'blocked'
        AND ((k_phone IS NOT NULL AND phone_h = k_phone) OR (k_email IS NOT NULL AND email_h = k_email)
          OR (k_visitor IS NOT NULL AND visitor_h = k_visitor) OR (k_ip IS NOT NULL AND ip_h = k_ip))
      GROUP BY card_h ORDER BY max(created_at) DESC LIMIT lim_cards) c
    HAVING count(*) >= lim_cards;
    IF FOUND AND anchor IS NOT NULL THEN reason := 'distinct_cards'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_card IS NOT NULL AND lim_ppc > 1 AND k_phone IS NOT NULL THEN
    -- v3: this attempt would be the lim_ppc-th distinct phone for the same card in 24 h
    SELECT min(last_use) INTO anchor FROM (
      SELECT phone_h, max(created_at) AS last_use FROM public.checkout_guard_events
      WHERE card_h = k_card AND phone_h IS NOT NULL AND phone_h <> k_phone AND created_at >= now() - interval '24 hours'
      GROUP BY phone_h ORDER BY max(created_at) DESC LIMIT lim_ppc - 1) p
    HAVING count(*) >= lim_ppc - 1;
    IF FOUND AND anchor IS NOT NULL THEN reason := 'phones_per_card'; span := interval '24 hours'; END IF;
  END IF;
  IF reason IS NULL AND k_phone IS NOT NULL AND lim_p24 > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE phone_h = k_phone AND outcome = 'declined' AND created_at >= now() - interval '24 hours' ORDER BY created_at DESC OFFSET lim_p24 - 1 LIMIT 1;
    IF FOUND THEN reason := 'phone_declines_24h'; span := interval '24 hours'; END IF;
  END IF;
  -- IP rules last, and only for a non-CGNAT IP (k_ip is NULL for CGNAT or when no IP was derived).
  IF reason IS NULL AND k_ip IS NOT NULL AND lim_ip > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE ip_h = k_ip AND outcome = 'declined' AND created_at >= since ORDER BY created_at DESC OFFSET lim_ip - 1 LIMIT 1;
    IF FOUND THEN reason := 'ip_declines'; span := w; END IF;
  END IF;
  IF reason IS NULL AND k_ip IS NOT NULL AND lim_ipa > 0 THEN
    SELECT created_at INTO anchor FROM public.checkout_guard_events WHERE ip_h = k_ip AND created_at >= since ORDER BY created_at DESC OFFSET lim_ipa - 1 LIMIT 1;
    IF FOUND THEN reason := 'ip_attempts'; span := w; END IF;
  END IF;

  IF reason IS NOT NULL THEN
    retry := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (anchor + span - now())))::int);
    SELECT coalesce((SELECT value FROM public.checkout_guard_settings WHERE key = 'db_enforce') = 'on', false) INTO db_on;
    -- 'block' needs every gate; otherwise the hit is only recorded (wallets/Klarna/Plaid/Cash App can never be blocked).
    dec := CASE WHEN db_on AND enforce AND is_card AND reason = ANY (rules) THEN 'block' ELSE 'shadow_block' END;
  END IF;

  INSERT INTO public.checkout_guard_events (payment_method, carrier_slug, amount, card_type, phone_h, email_h, card_h, visitor_h, sess_h, ip_h,
                                            ip_src, ip_class, decision, reason, outcome, turnstile, mode)
  VALUES (v_method, left(_k->>'carrier_slug', 80),
          CASE WHEN (_k->>'amount') ~ '^\d{1,6}(\.\d{1,2})?$' THEN (_k->>'amount')::numeric END,
          left(_k->>'card_type', 20), k_phone, k_email, k_card, k_visitor, k_sess, k_ip, v_ip_src, v_ip_class, dec, reason,
          CASE WHEN dec = 'block' THEN 'blocked' ELSE 'pending' END,
          left(_k->>'turnstile', 20), left(_k->>'mode', 10))
  RETURNING id INTO new_id;

  IF random() < 0.01 THEN
    DELETE FROM public.checkout_guard_events WHERE created_at < now() - interval '30 days';
  END IF;

  RETURN jsonb_build_object('id', new_id, 'decision', dec, 'reason', reason, 'retry_after', retry);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_guard_outcome(_id uuid, _outcome text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.checkout_guard_events SET outcome = _outcome
  WHERE id = _id AND outcome = 'pending' AND _outcome IN ('success','declined','error')
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.checkout_guard_check(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_guard_outcome(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_guard_check(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_guard_outcome(uuid, text) TO service_role;

DO $$
DECLARE r text; t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(r, 'public.checkout_guard_check(jsonb)', 'EXECUTE') OR has_function_privilege(r, 'public.checkout_guard_outcome(uuid,text)', 'EXECUTE') THEN
      RAISE EXCEPTION '% can execute an S3 function', r; END IF;
    FOREACH t IN ARRAY ARRAY['public.checkout_guard_events','public.checkout_guard_settings'] LOOP
      IF has_table_privilege(r, t, 'SELECT') OR has_table_privilege(r, t, 'INSERT') OR has_table_privilege(r, t, 'UPDATE') OR has_table_privilege(r, t, 'DELETE') THEN
        RAISE EXCEPTION '% has privileges on %', r, t; END IF;
    END LOOP;
  END LOOP;
  IF NOT (has_function_privilege('service_role', 'public.checkout_guard_check(jsonb)', 'EXECUTE') AND has_function_privilege('service_role', 'public.checkout_guard_outcome(uuid,text)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'service_role cannot execute the S3 functions'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.checkout_guard_events'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.checkout_guard_settings'::regclass) THEN
    RAISE EXCEPTION 'RLS is off on an S3 table'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('checkout_guard_events','checkout_guard_settings')) THEN
    RAISE EXCEPTION 'unexpected RLS policy on an S3 table'; END IF;
  IF coalesce((SELECT value FROM public.checkout_guard_settings WHERE key = 'db_enforce'), '') <> 'off' THEN
    RAISE EXCEPTION 'db_enforce must be off after M1'; END IF;
  IF (SELECT count(*) FROM public.checkout_guard_settings WHERE key IN ('turnstile_mode','velocity_mode') AND value = 'shadow') <> 2
     OR NOT EXISTS (SELECT 1 FROM public.checkout_guard_settings WHERE key = 'frontend_deployed_at') THEN
    RAISE EXCEPTION 'settings rows turnstile_mode/velocity_mode (shadow) and frontend_deployed_at must exist after M1'; END IF;
END $$;

COMMIT;