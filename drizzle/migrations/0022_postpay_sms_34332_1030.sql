CREATE FUNCTION public.claim_postpay_sms(_id uuid) -- // POSTPAY-SMS-34332-1030
RETURNS TABLE (phone_number text, amount numeric, carrier_name text, lang text) -- // POSTPAY-SMS-34332-1030
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET lock_timeout = '2s' SET statement_timeout = '4s' AS $$ -- // POSTPAY-SMS-34332-1030
DECLARE r public.transaction_logs%ROWTYPE; lg text; -- // POSTPAY-SMS-34332-1030
BEGIN -- // POSTPAY-SMS-34332-1030
  PERFORM pg_advisory_xact_lock(34332, 1030); -- // POSTPAY-SMS-34332-1030: serialize identity claims across duplicate log rows.
  SELECT t.* INTO r FROM public.transaction_logs t WHERE t.id = _id AND t.status = 'success' AND NOT (coalesce(t.metadata, '{}'::jsonb) ? 'postpay_sms') FOR UPDATE; -- // POSTPAY-SMS-34332-1030
  IF NOT FOUND OR (nullif(btrim(r.hashid), '') IS NULL AND nullif(btrim(r.transaction_id), '') IS NULL) THEN RETURN; END IF; -- // POSTPAY-SMS-34332-1030
  IF EXISTS (SELECT 1 FROM public.transaction_logs t WHERE t.id <> r.id AND coalesce(t.metadata, '{}'::jsonb) ? 'postpay_sms' AND ((nullif(btrim(r.hashid), '') IS NOT NULL AND btrim(t.hashid) = btrim(r.hashid)) OR (nullif(btrim(r.transaction_id), '') IS NOT NULL AND btrim(t.transaction_id) = btrim(r.transaction_id)))) THEN RETURN; END IF; -- // POSTPAY-SMS-34332-1030
  lg := CASE WHEN r.metadata->>'uiLang' = 'es' THEN 'es' ELSE 'en' END; -- // POSTPAY-SMS-34332-1030
  UPDATE public.transaction_logs t SET metadata = coalesce(t.metadata, '{}'::jsonb) || jsonb_build_object('postpay_sms', jsonb_build_object('status', 'claimed', 'sid', NULL, 'error_code', NULL, 'at', now(), 'lang', lg)) WHERE t.id = r.id; -- // POSTPAY-SMS-34332-1030
  RETURN QUERY SELECT r.phone_number, r.amount, r.carrier_name, lg; -- // POSTPAY-SMS-34332-1030
END; -- // POSTPAY-SMS-34332-1030
$$; -- // POSTPAY-SMS-34332-1030
REVOKE ALL ON FUNCTION public.claim_postpay_sms(uuid) FROM PUBLIC, anon, authenticated; -- // POSTPAY-SMS-34332-1030
GRANT EXECUTE ON FUNCTION public.claim_postpay_sms(uuid) TO service_role; -- // POSTPAY-SMS-34332-1030