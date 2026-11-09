-- STOLEN-CARD-DEFENSES-1109 (items 1 + 2). Both flags start OFF, so applying this changes nothing for customers.
-- Kill switches (instant, no deploy): checkout_guard_controls 'stolen_seed' and 'cardvel' = off | shadow | on.
ALTER TABLE public.checkout_guard_controls DROP CONSTRAINT IF EXISTS checkout_guard_controls_check;
ALTER TABLE public.checkout_guard_controls ADD CONSTRAINT checkout_guard_controls_check CHECK (
  (((key = ANY (ARRAY['dupcharge'::text, 'spread'::text, 'vel1'::text])) AND (value = ANY (ARRAY['on'::text, 'shadow'::text, 'off'::text])) AND (NOT ((key = 'spread'::text) AND (value = 'shadow'::text))))
  OR ((key = 'server_fallback'::text) AND (value = ANY (ARRAY['off'::text, 'shadow'::text, 'live'::text])))
  OR (key = 'server_fallback_csv_sha256'::text)
  OR ((key = 'mfblock'::text) AND (value = ANY (ARRAY['on'::text, 'shadow'::text, 'off'::text])))
  OR ((key = 'mflink'::text) AND (value = ANY (ARRAY['on'::text, 'dryrun'::text, 'off'::text])))
  OR ((key = 'riskengine'::text) AND (value = ANY (ARRAY['off'::text, 'shadow'::text, 'enforce'::text])))
  OR ((key = 'ourside_retry'::text) AND (value = ANY (ARRAY['on'::text, 'off'::text])))
  OR ((key = ANY (ARRAY['stolen_seed'::text, 'cardvel'::text])) AND (value = ANY (ARRAY['on'::text, 'shadow'::text, 'off'::text]))))
);

-- QA / not_block exemptions shared by both items.
CREATE OR REPLACE FUNCTION public.scd_is_qa(_ph text, _em text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT coalesce(_ph ~ '^555', false)
      OR coalesce(substr(_ph, 4, 3) = '555' AND substr(_ph, 7, 2) = '01', false)
      OR coalesce(_em ~ '(@example\.com|\.test)$' OR position('blocklist-test' in _em) > 0, false)
      OR EXISTS (SELECT 1 FROM public.fraud_watch_lists w WHERE w.list = 'not_block'
                 AND ((_ph IS NOT NULL AND (w.value = _ph OR w.value = '1' || _ph)) OR (_em IS NOT NULL AND lower(btrim(w.value)) = _em)))
      OR EXISTS (SELECT 1 FROM public.checkout_blocklist b WHERE b.reason = 'qa_smoke'
                 AND ((b.key_type = 'phone' AND b.value_norm = _ph) OR (b.key_type = 'email' AND b.value_norm = _em)))
$fn$;

-- Item 1: on a stolen / lost / pick-up bank decline, put every key of that try on checkout_blocklist (reason manual, permanent).
-- fp1 fingerprints collide across real customers, so fp1 is only logged (stolen_auto_seed_shadow:device_fp1), never seeded.
-- Never raises: any error is swallowed so the transaction_logs write always succeeds.
CREATE OR REPLACE FUNCTION public.stolen_autoseed_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE mode text; ph text; em text; did text; fp1 text; card text; addr text; k record; pfx text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'failed' OR NEW.error_message IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.error_message IS NOT DISTINCT FROM NEW.error_message THEN RETURN NEW; END IF;
  IF NOT (public.vel1_is_bank_decline(NEW.error_message) AND NEW.error_message ~* '(stolen|\mlost\M|pick[ -]?up)') THEN RETURN NEW; END IF;
  SELECT g.value INTO mode FROM public.checkout_guard_controls g WHERE g.key = 'stolen_seed';
  mode := coalesce(mode, 'off');
  IF mode NOT IN ('on', 'shadow') THEN RETURN NEW; END IF;
  ph := public.blocklist_norm('phone', NEW.phone_number);
  em := public.blocklist_norm('email', NEW.email);
  IF public.scd_is_qa(ph, em) THEN
    INSERT INTO public.proxy_guard_events(guard_version, code, method, endpoint_shape, has_origin, dropped_before)
      VALUES ('scd1109', 'stolen_seed_exempt:qa', 'POST', 'checkout/transaction', true, 0);
    RETURN NEW;
  END IF;
  did := public.blocklist_norm('device', NEW.metadata->>'mf_did');
  fp1 := public.blocklist_norm('device', NEW.metadata->>'mf_device');
  card := public.blocklist_norm('card', NEW.metadata->>'mf_card');
  addr := public.blocklist_norm('address', NEW.metadata->>'mf_addr');
  pfx := CASE WHEN mode = 'on' THEN 'stolen_auto_seed:' ELSE 'stolen_auto_seed_shadow:' END;
  FOR k IN SELECT v.kt, v.val FROM (VALUES ('phone', ph), ('email', em), ('device', did), ('card', card), ('address', addr)) AS v(kt, val) WHERE v.val IS NOT NULL LOOP
    IF mode = 'on' THEN
      INSERT INTO public.checkout_blocklist(key_type, value_norm, reason, source, added_by, expires_at, active, note)
        VALUES (k.kt, k.val, 'manual', 'proxy:stolen-auto', 'cellpay-proxy', NULL, true, 'STOLEN-CARD-DEFENSES-1109 auto seed, tx ' || NEW.id)
        ON CONFLICT (key_type, value_norm) WHERE active DO NOTHING;
    END IF;
    INSERT INTO public.proxy_guard_events(guard_version, code, method, endpoint_shape, has_origin, dropped_before)
      VALUES ('scd1109', pfx || k.kt, 'POST', 'checkout/transaction', true, 0);
  END LOOP;
  IF fp1 IS NOT NULL AND fp1 IS DISTINCT FROM did THEN
    INSERT INTO public.proxy_guard_events(guard_version, code, method, endpoint_shape, has_origin, dropped_before)
      VALUES ('scd1109', 'stolen_auto_seed_shadow:device_fp1', 'POST', 'checkout/transaction', true, 0);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.proxy_guard_events(guard_version, code, method, endpoint_shape, has_origin, dropped_before)
      VALUES ('scd1109', 'stolen_seed_error', 'POST', left(SQLERRM, 120), true, 0);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS stolen_autoseed_after_fail ON public.transaction_logs;
CREATE TRIGGER stolen_autoseed_after_fail AFTER INSERT OR UPDATE OF status, error_message ON public.transaction_logs
  FOR EACH ROW WHEN (NEW.status = 'failed' AND NEW.error_message IS NOT NULL) EXECUTE FUNCTION public.stolen_autoseed_trg();

-- Item 2: distinct-card velocity. The current card counts, so the 3rd distinct BIN6:last4 in 24h on the same phone, email
-- or mf_did is refused (mode on). fp1 is never used. QA / not_block exempt. Never raises (any error = refuse false).
CREATE OR REPLACE FUNCTION public.cardvel_check(_phone text, _email text, _did text, _card text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '700ms' AS $fn$
DECLARE mode text; ph text := public.blocklist_norm('phone', _phone);
  em text := nullif(lower(btrim(coalesce(_email, ''))), '');
  did text := nullif(btrim(coalesce(_did, '')), '');
  c text := CASE WHEN _card ~ '^[0-9]{6}:[0-9]{4}$' THEN _card END;
  np int := 0; ne int := 0; nd int := 0; hit text; ex boolean := false; code text;
BEGIN
  SELECT g.value INTO mode FROM public.checkout_guard_controls g WHERE g.key = 'cardvel';
  mode := coalesce(mode, 'off');
  IF mode NOT IN ('on', 'shadow') OR c IS NULL THEN RETURN jsonb_build_object('mode', mode, 'refuse', false); END IF;
  IF em = 'customer@cellpay.us' THEN em := NULL; END IF;
  IF ph IS NOT NULL THEN
    SELECT count(DISTINCT u.x) INTO np FROM (
      SELECT t.metadata->>'mf_card' AS x FROM public.transaction_logs t
       WHERE t.phone_number IN (ph, '1' || ph) AND t.created_at > now() - interval '24 hours' AND (t.metadata ? 'mf_card')
      UNION SELECT c) u WHERE u.x ~ '^[0-9]{6}:[0-9]{4}$';
  END IF;
  IF em IS NOT NULL THEN
    SELECT count(DISTINCT u.x) INTO ne FROM (
      SELECT t.metadata->>'mf_card' AS x FROM public.transaction_logs t
       WHERE lower(btrim(t.email)) = em AND t.created_at > now() - interval '24 hours' AND (t.metadata ? 'mf_card')
      UNION SELECT c) u WHERE u.x ~ '^[0-9]{6}:[0-9]{4}$';
  END IF;
  IF did IS NOT NULL THEN
    SELECT count(DISTINCT u.x) INTO nd FROM (
      SELECT t.metadata->>'mf_card' AS x FROM public.transaction_logs t
       WHERE (t.metadata ? 'mf_did') AND t.metadata->>'mf_did' = did AND t.created_at > now() - interval '24 hours' AND (t.metadata ? 'mf_card')
      UNION SELECT c) u WHERE u.x ~ '^[0-9]{6}:[0-9]{4}$';
  END IF;
  hit := CASE WHEN np >= 3 THEN 'phone' WHEN ne >= 3 THEN 'email' WHEN nd >= 3 THEN 'device' END;
  IF hit IS NULL THEN RETURN jsonb_build_object('mode', mode, 'refuse', false, 'np', np, 'ne', ne, 'nd', nd); END IF;
  ex := public.scd_is_qa(ph, public.blocklist_norm('email', em));
  code := CASE WHEN ex THEN 'cardvel_exempt:' WHEN mode = 'on' THEN 'cardvel_refuse:' ELSE 'cardvel_shadow:' END || hit;
  INSERT INTO public.proxy_guard_events(guard_version, code, method, endpoint_shape, has_origin, dropped_before)
    VALUES ('scd1109', code, 'POST', 'checkout/transaction', true, 0);
  RETURN jsonb_build_object('mode', mode, 'refuse', mode = 'on' AND NOT ex, 'rule', hit, 'np', np, 'ne', ne, 'nd', nd);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('mode', 'error', 'refuse', false);
END $fn$;

REVOKE ALL ON FUNCTION public.scd_is_qa(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cardvel_check(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stolen_autoseed_trg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scd_is_qa(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cardvel_check(text, text, text, text) TO service_role;

