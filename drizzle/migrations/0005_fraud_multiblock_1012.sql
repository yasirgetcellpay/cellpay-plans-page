-- FRAUD-MULTIBLOCK-1012
-- kill-switch keys allowed in checkout_guard_controls (existing keys keep their rules)
ALTER TABLE public.checkout_guard_controls DROP CONSTRAINT checkout_guard_controls_check;
ALTER TABLE public.checkout_guard_controls ADD CONSTRAINT checkout_guard_controls_check CHECK (
  (key = ANY (ARRAY['dupcharge'::text, 'spread'::text, 'vel1'::text])
     AND value = ANY (ARRAY['on'::text, 'shadow'::text, 'off'::text])
     AND NOT (key = 'spread' AND value = 'shadow'))
  OR (key = 'server_fallback' AND value = ANY (ARRAY['off'::text, 'shadow'::text, 'live'::text]))
  OR (key = 'server_fallback_csv_sha256')
  OR (key = 'mfblock' AND value = ANY (ARRAY['on'::text, 'shadow'::text, 'off'::text]))
  OR (key = 'mflink' AND value = ANY (ARRAY['on'::text, 'dryrun'::text, 'off'::text]))
  OR (key = 'riskengine' AND value = ANY (ARRAY['off'::text, 'shadow'::text, 'enforce'::text]))
);

-- new blocklist key types
ALTER TABLE public.checkout_blocklist DROP CONSTRAINT checkout_blocklist_key_type_check;
ALTER TABLE public.checkout_blocklist ADD CONSTRAINT checkout_blocklist_key_type_check
  CHECK (key_type = ANY (ARRAY['phone','email','card_hash','visitor','session','device','card','address']));
ALTER TABLE public.checkout_blocklist ADD CONSTRAINT cb_card_shape CHECK (key_type <> 'card' OR value_norm ~ '^[0-9]{6}:[0-9]{4}(:[0-9]{4})?$');

CREATE OR REPLACE FUNCTION public.addr_norm(_line text, _zip text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE v text := lower(coalesce(_line,'')); z text := left(regexp_replace(coalesce(_zip,''), '\D', '', 'g'), 5);
BEGIN
  v := regexp_replace(v, '[^a-z0-9 ]', ' ', 'g');
  v := ' ' || regexp_replace(v, '\s+', ' ', 'g') || ' ';
  v := regexp_replace(v, ' (street|str) ', ' st ', 'g');   v := regexp_replace(v, ' (avenue|av|ave) ', ' ave ', 'g');
  v := regexp_replace(v, ' (road) ', ' rd ', 'g');          v := regexp_replace(v, ' (drive) ', ' dr ', 'g');
  v := regexp_replace(v, ' (boulevard|blv) ', ' blvd ', 'g'); v := regexp_replace(v, ' (lane) ', ' ln ', 'g');
  v := regexp_replace(v, ' (court) ', ' ct ', 'g');         v := regexp_replace(v, ' (place) ', ' pl ', 'g');
  v := regexp_replace(v, ' (apartment|apt|unit|suite|ste|#) ', ' apt ', 'g');
  v := regexp_replace(v, ' (north) ', ' n ', 'g'); v := regexp_replace(v, ' (south) ', ' s ', 'g');
  v := regexp_replace(v, ' (east) ', ' e ', 'g');  v := regexp_replace(v, ' (west) ', ' w ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  IF length(v) < 4 OR length(z) <> 5 THEN RETURN NULL; END IF;
  RETURN v || '|' || z;
END $$;

CREATE OR REPLACE FUNCTION public.blocklist_norm(_type text, _raw text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
DECLARE v text := btrim(coalesce(_raw,'')); loc text; dom text;
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  IF _type = 'phone' THEN
    v := regexp_replace(v, '\D', '', 'g');
    IF length(v) = 11 AND left(v,1) = '1' THEN v := right(v,10); END IF;
    RETURN CASE WHEN length(v) BETWEEN 7 AND 15 THEN v END;
  ELSIF _type = 'email' THEN
    v := lower(v);
    IF v = 'customer@cellpay.us' THEN RETURN NULL; END IF;      -- wallet/Cash App placeholder, never a key
    IF position('@' in v) = 0 THEN RETURN v; END IF;
    loc := regexp_replace(v, '@[^@]*$', '');
    dom := substring(v from '@([^@]*)$');
    loc := split_part(loc, '+', 1);
    IF dom IN ('gmail.com','googlemail.com') THEN loc := replace(loc, '.', ''); dom := 'gmail.com'; END IF;
    RETURN NULLIF(loc,'') || '@' || dom;
  ELSIF _type = 'card_hash' THEN
    v := lower(v); RETURN CASE WHEN v ~ '^[0-9a-f]{64}$' THEN v END;
  ELSIF _type IN ('visitor','session') THEN
    RETURN left(v, 200);
  ELSIF _type = 'device' THEN
    v := lower(v); RETURN CASE WHEN v ~ '^[0-9a-z:_-]{8,80}$' THEN v END;
  ELSIF _type = 'card' THEN
    RETURN CASE WHEN v ~ '^[0-9]{6}:[0-9]{4}(:[0-9]{4})?$' THEN v END;
  ELSIF _type = 'address' THEN
    RETURN CASE WHEN v ~ '\|[0-9]{5}$' THEN v END;
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.checkout_blocklist_check_mf(_devices text[], _card text, _card_exp text, _address text)
RETURNS TABLE(blocked boolean, key_type text, reason text, value_norm text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE hit public.checkout_blocklist%ROWTYPE; c text := public.blocklist_norm('card', _card);
BEGIN
  SELECT b.* INTO hit FROM public.checkout_blocklist b
   WHERE b.active AND (b.expires_at IS NULL OR b.expires_at > now())
     AND ((b.key_type = 'device' AND b.value_norm = ANY (SELECT public.blocklist_norm('device', d) FROM unnest(coalesce(_devices, '{}')) d))
       OR (b.key_type = 'card' AND c IS NOT NULL AND (b.value_norm = c OR (_card_exp ~ '^[0-9]{4}$' AND b.value_norm = c || ':' || _card_exp)))
       OR (b.key_type = 'address' AND b.value_norm = public.blocklist_norm('address', _address)))
   ORDER BY b.created_at LIMIT 1;
  IF hit.id IS NULL THEN RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text; RETURN; END IF;
  UPDATE public.checkout_blocklist SET hit_count = hit_count + 1, last_hit_at = now() WHERE id = hit.id;
  RETURN QUERY SELECT true, hit.key_type, hit.reason, hit.value_norm;
END $$;
REVOKE ALL ON FUNCTION public.checkout_blocklist_check_mf(text[], text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_blocklist_check_mf(text[], text, text, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.fraud_link_log (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), source_id uuid,
  source_type text, source_value text, linked_type text, linked_value text, action text NOT NULL, via_tx uuid, distinct_ids int, mode text);
GRANT ALL ON public.fraud_link_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fraud_link_log_id_seq TO service_role;
ALTER TABLE public.fraud_link_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fraud_tx_identifiers(_since interval DEFAULT interval '90 days')
RETURNS TABLE(tx uuid, kt text, kv text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, x.kt, x.kv FROM public.transaction_logs t
  CROSS JOIN LATERAL (VALUES
    ('phone',   public.blocklist_norm('phone', t.phone_number)),
    ('email',   public.blocklist_norm('email', t.email)),
    ('device',  public.blocklist_norm('device', t.metadata->>'mf_device')),
    ('device',  public.blocklist_norm('device', t.metadata->>'mf_did')),
    ('card',    public.blocklist_norm('card', t.metadata->>'mf_card')),
    ('card',    (SELECT public.blocklist_norm('card', f.card_bin || ':' || f.card_last4) FROM public.transaction_card_facts f
                  WHERE f.transaction_log_id = t.id AND f.card_bin IS NOT NULL LIMIT 1)),
    ('address', public.blocklist_norm('address', t.metadata->>'mf_addr'))) x(kt, kv)
  WHERE t.created_at > now() - _since AND x.kv IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.fraud_tx_identifiers(interval) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fraud_link_candidates(_block_id uuid)
RETURNS TABLE(linked_type text, linked_value text, via_tx uuid, distinct_ids int, action text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH b AS (SELECT key_type, value_norm FROM public.checkout_blocklist WHERE id = _block_id AND reason = 'manual' AND active),
  ids AS (SELECT * FROM public.fraud_tx_identifiers()),
  txs AS (SELECT DISTINCT i.tx FROM ids i JOIN b ON b.key_type = i.kt AND b.value_norm = i.kv),
  cand AS (SELECT DISTINCT ON (i.kt, i.kv) i.kt, i.kv, i.tx FROM ids i JOIN txs USING (tx)
            WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.key_type = i.kt AND b.value_norm = i.kv)),
  spread AS (SELECT c.kt, c.kv, (SELECT count(DISTINCT j.kt || j.kv) FROM ids j WHERE j.kt IN ('phone','email')
               AND j.tx IN (SELECT k.tx FROM ids k WHERE k.kt = c.kt AND k.kv = c.kv))::int n FROM cand c)
  SELECT c.kt, c.kv, c.tx, s.n,
    CASE WHEN EXISTS (SELECT 1 FROM public.fraud_watch_lists w WHERE w.list IN ('not_block','dnb_legacy') AND lower(w.value) = c.kv) THEN 'skip_not_block'
         WHEN EXISTS (SELECT 1 FROM public.checkout_blocklist x WHERE x.key_type = c.kt AND x.value_norm = c.kv AND x.active) THEN 'already_blocked'
         WHEN c.kt NOT IN ('phone','email') AND s.n > 3 THEN 'review'
         ELSE 'block' END
  FROM cand c JOIN spread s USING (kt, kv);
$$;
REVOKE ALL ON FUNCTION public.fraud_link_candidates(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fraud_link_apply(_block_id uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m text := coalesce((SELECT value FROM public.checkout_guard_controls WHERE key = 'mflink'), 'dryrun'); r record; n int := 0;
  src public.checkout_blocklist%ROWTYPE;
BEGIN
  SELECT * INTO src FROM public.checkout_blocklist WHERE id = _block_id;
  IF src.id IS NULL OR src.reason <> 'manual' OR coalesce(src.added_by,'') = 'MF-LINK' THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM public.fraud_link_candidates(_block_id) LOOP
    INSERT INTO public.fraud_link_log(source_id, source_type, source_value, linked_type, linked_value, action, via_tx, distinct_ids, mode)
      VALUES (src.id, src.key_type, src.value_norm, r.linked_type, r.linked_value, r.action, r.via_tx, r.distinct_ids, m);
    IF m = 'on' AND r.action = 'block' THEN
      INSERT INTO public.checkout_blocklist(key_type, value_norm, reason, source, added_by, active, note)
        VALUES (r.linked_type, r.linked_value, 'manual', 'mf_link', 'MF-LINK', true, 'linked from ' || src.key_type || ' ' || src.id);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fraud_link_apply(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_fraud_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reason = 'manual' AND NEW.active AND coalesce(NEW.added_by,'') <> 'MF-LINK'
     AND coalesce((SELECT value FROM public.checkout_guard_controls WHERE key = 'mflink'), 'dryrun') <> 'off' THEN
    BEGIN PERFORM public.fraud_link_apply(NEW.id); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'fraud_link failed: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER checkout_blocklist_fraud_link AFTER INSERT ON public.checkout_blocklist FOR EACH ROW EXECUTE FUNCTION public.trg_fraud_link();

CREATE OR REPLACE VIEW public.fraud_ip_risk WITH (security_invoker = true) AS
  SELECT t.id AS tx, t.created_at, t.source_ip,
         CASE WHEN nullif(btrim(t.source_ip),'') IS NULL THEN 'none' WHEN public.fraud_is_cgnat(t.source_ip) THEN 'carrier' ELSE 'other' END AS ip_class
  FROM public.transaction_logs t WHERE t.created_at > now() - interval '90 days';
REVOKE ALL ON public.fraud_ip_risk FROM anon, authenticated;

-- ===== 5a) pre-payment risk engine (shadow) =====
CREATE TABLE public.risk_rules (key text PRIMARY KEY, weight numeric NOT NULL, cap numeric, note text, updated_at timestamptz DEFAULT now());
GRANT ALL ON public.risk_rules TO service_role;
CREATE TABLE public.risk_decisions (id bigserial PRIMARY KEY, created_at timestamptz DEFAULT now(), checkout_session_id text,
  transaction_log_id uuid, phone_last4 text, payment_method text, amount numeric, score numeric, action text, mode text,
  reasons jsonb, linked_block jsonb, ip_asn int, ip_country text, ip_datacenter boolean, latency_ms int);
GRANT ALL ON public.risk_decisions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.risk_decisions_id_seq TO service_role;
ALTER TABLE public.carrier_check_log ADD COLUMN phone text, ADD COLUMN checkout_session_id text;
CREATE INDEX ON public.carrier_check_log(phone, created_at);
CREATE TABLE public.ip_asn_ranges (range_start inet NOT NULL, range_end inet NOT NULL, asn int, country text, as_name text);
GRANT ALL ON public.ip_asn_ranges TO service_role;
CREATE INDEX ON public.ip_asn_ranges(range_start);
CREATE TABLE public.ip_hosting_asns (asn int PRIMARY KEY, name text);
GRANT ALL ON public.ip_hosting_asns TO service_role;
CREATE OR REPLACE FUNCTION public.ip_enrich(_ip text) RETURNS TABLE(asn int, country text, datacenter boolean, cgnat boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.asn, r.country, EXISTS (SELECT 1 FROM public.ip_hosting_asns h WHERE h.asn = r.asn), public.fraud_is_cgnat(_ip)
  FROM (SELECT 1) one LEFT JOIN LATERAL (SELECT * FROM public.ip_asn_ranges x WHERE x.range_start <= _ip::inet
        ORDER BY x.range_start DESC LIMIT 1) r ON r.range_end >= _ip::inet;
$$;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY; ALTER TABLE public.risk_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_asn_ranges ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ip_hosting_asns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.ip_enrich(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ip_enrich(text) TO service_role;

-- Raw feature values for the risk score (prior rows only: called before the current attempt is logged).
CREATE OR REPLACE FUNCTION public.risk_score_features(_phone text, _email text, _ip text, _device text, _amount numeric, _method text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ph text := public.blocklist_norm('phone', _phone);
  em text := public.blocklist_norm('email', _email);
  dv text := public.blocklist_norm('device', _device);
  ip text := nullif(btrim(coalesce(_ip,'')), '');
  m text := lower(coalesce(_method,''));
  dom text := lower(substring(coalesce(_email,'') from '@([^@]*)$'));
  loc text := lower(regexp_replace(coalesce(_email,''), '@[^@]*$', ''));
  att1h int := 0; dec24 int := 0; em24 int := 0; ip24 int := 0; dv24 int := 0; stolen boolean := false; paid boolean := false;
  hr int := extract(hour FROM now() AT TIME ZONE 'America/Chicago')::int;
BEGIN
  IF ph IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE t.created_at > now() - interval '1 hour'),
           count(*) FILTER (WHERE t.created_at > now() - interval '24 hours' AND t.status = 'failed'),
           coalesce(bool_or(t.status = 'failed' AND t.error_message ~* '(stolen|lost|pick ?up|restricted)'), false),
           coalesce(bool_or(t.status = 'success'), false)
      INTO att1h, dec24, stolen, paid
      FROM public.transaction_logs t
     WHERE public.blocklist_norm('phone', t.phone_number) = ph;
  END IF;
  IF em IS NOT NULL THEN
    SELECT count(*) INTO em24 FROM public.transaction_logs t
     WHERE t.created_at > now() - interval '24 hours' AND public.blocklist_norm('email', t.email) = em;
  END IF;
  IF ip IS NOT NULL THEN
    SELECT count(*) INTO ip24 FROM public.transaction_logs t WHERE t.created_at > now() - interval '24 hours' AND t.source_ip = ip;
  END IF;
  IF dv IS NOT NULL THEN
    SELECT count(*) INTO dv24 FROM public.transaction_logs t
     WHERE t.created_at > now() - interval '24 hours' AND (lower(t.metadata->>'mf_device') = dv OR lower(t.metadata->>'mf_did') = dv);
  END IF;
  RETURN jsonb_build_object(
    'phone_attempts_1h', att1h,
    'phone_declines_24h', dec24,
    'email_uses_24h_gt2', CASE WHEN em24 > 2 THEN 1 ELSE 0 END,
    'ip_uses_24h_gt3', CASE WHEN ip24 > 3 THEN 1 ELSE 0 END,
    'device_uses_24h_gt2', CASE WHEN dv24 > 2 THEN 1 ELSE 0 END,
    'prior_stolen_decline', CASE WHEN stolen THEN 1 ELSE 0 END,
    'email_4digits', CASE WHEN loc ~ '[0-9]{4}' THEN 1 ELSE 0 END,
    'email_offbeat_domain', CASE WHEN dom IS NOT NULL AND dom <> '' AND dom NOT IN ('gmail.com','googlemail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','live.com','msn.com','me.com','att.net','comcast.net','verizon.net','sbcglobal.net','ymail.com','protonmail.com') AND lower(coalesce(_email,'')) <> 'customer@cellpay.us' THEN 1 ELSE 0 END,
    'first_order', CASE WHEN NOT paid THEN 1 ELSE 0 END,
    'prior_paid', CASE WHEN paid THEN 1 ELSE 0 END,
    'first_order_ge60', CASE WHEN NOT paid AND coalesce(_amount,0) >= 60 THEN 1 ELSE 0 END,
    'night_0_5_ct', CASE WHEN hr BETWEEN 0 AND 4 THEN 1 ELSE 0 END,
    'round_dollar', CASE WHEN _amount IS NOT NULL AND _amount > 0 AND _amount = trunc(_amount) THEN 1 ELSE 0 END,
    'wallet_method', CASE WHEN m IN ('applepay','googlepay','paypal') THEN 1 ELSE 0 END
  );
END $$;
REVOKE ALL ON FUNCTION public.risk_score_features(text, text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.risk_score_features(text, text, text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_blocklist_check(text, text, text, text, text) TO service_role;