-- REFUNDED-STATE-1017 (+ LOADTEXT-REASON-1017): additive only; existing rows untouched.
ALTER TABLE public.transaction_logs
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_source text CHECK (refund_source IN ('reply','admin_receipt','receipt_after_error')),
  ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS load_text text;

CREATE INDEX IF NOT EXISTS transaction_logs_refunded_at_idx ON public.transaction_logs (refunded_at) WHERE refunded_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_order_refunded(_id uuid, _source text, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF _source IS NULL OR _source NOT IN ('reply','admin_receipt','receipt_after_error') THEN
    RAISE EXCEPTION 'invalid refund source';
  END IF;
  UPDATE public.transaction_logs SET
    refunded_at = coalesce(refunded_at, now()),
    refund_source = coalesce(refund_source, _source),
    refund_amount = coalesce(refund_amount, total, amount),
    refund_reason = coalesce(refund_reason, left(_reason, 120))
  WHERE id = _id AND status = 'failed' AND created_at > now() - interval '2 days';
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.mark_order_refunded(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_refunded(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_tx_load_text(_id uuid, _text text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.transaction_logs SET load_text = left(_text, 500)
  WHERE id = _id AND created_at > now() - interval '2 days' AND nullif(btrim(coalesce(_text,'')), '') IS NOT NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.set_tx_load_text(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_tx_load_text(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.order_refund_state(_hashid text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record;
BEGIN
  IF _hashid IS NULL OR _hashid !~ '^[A-Za-z0-9_-]{4,64}$' THEN RETURN NULL; END IF;
  SELECT t.refund_amount, t.total, t.carrier_slug INTO r FROM public.transaction_logs t
  WHERE t.hashid = _hashid AND t.refunded_at IS NOT NULL AND t.created_at > now() - interval '120 days'
  ORDER BY t.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('refunded', true, 'total', coalesce(r.refund_amount, r.total), 'carrier_slug', r.carrier_slug);
END $$;
REVOKE ALL ON FUNCTION public.order_refund_state(text) FROM public;
GRANT EXECUTE ON FUNCTION public.order_refund_state(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.order_refund_states(_hashids text[])
RETURNS TABLE(hashid text, total numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ins AS (
    SELECT DISTINCT h FROM unnest((coalesce(_hashids, ARRAY[]::text[]))[1:50]) AS h
    WHERE h ~ '^[A-Za-z0-9_-]{4,64}$'
  )
  SELECT DISTINCT ON (t.hashid) t.hashid, coalesce(t.refund_amount, t.total)
  FROM public.transaction_logs t JOIN ins ON ins.h = t.hashid
  WHERE t.refunded_at IS NOT NULL AND t.created_at > now() - interval '120 days'
  ORDER BY t.hashid, t.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.order_refund_states(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.order_refund_states(text[]) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.order_outcomes WITH (security_invoker = on) AS
SELECT id, created_at, (created_at AT TIME ZONE 'America/Chicago')::date AS day_ct, carrier_slug, plan_id, payment_method, total, amount,
  hashid, status, refunded_at, refund_source, refund_amount, refund_reason, refund_confirmed_at, load_text,
  (metadata->>'autopay') = 'true' AS autopay_ticked, metadata->>'caller_host' AS host,
  CASE WHEN refunded_at IS NOT NULL THEN 'refunded'
       WHEN status = 'success' THEN 'success'
       WHEN status IN ('pending','abandoned') THEN status
       WHEN status = 'failed' AND coalesce(error_message,'') ~* '(declin|insufficient|stolen|lost card|pick ?up|do not honou?r|invalid card|invalid account|expired|no such issuer|cvv|cvc|cvn|avs)'
            AND coalesce(error_message,'') !~* '(transaction rejected|^blocked:)' THEN 'declined'
       ELSE 'failed' END AS order_state
FROM public.transaction_logs
WHERE coalesce(payment_method,'') <> 'test' AND coalesce(transaction_id,'') NOT LIKE 'GATE\_%';

CREATE OR REPLACE VIEW public.refunds_by_carrier_plan_daily WITH (security_invoker = on) AS
SELECT day_ct, carrier_slug, plan_id, refund_source,
  count(*) AS refunded_orders, sum(refund_amount) AS refunded_usd, sum(amount) AS refunded_face_usd,
  count(*) FILTER (WHERE autopay_ticked) AS autopay_ticked,
  count(*) FILTER (WHERE refund_confirmed_at IS NOT NULL OR refund_source <> 'reply') AS confirmed
FROM public.order_outcomes WHERE order_state = 'refunded'
GROUP BY day_ct, carrier_slug, plan_id, refund_source;

REVOKE ALL ON public.order_outcomes FROM anon, authenticated;
REVOKE ALL ON public.refunds_by_carrier_plan_daily FROM anon, authenticated;
GRANT SELECT ON public.order_outcomes TO service_role;
GRANT SELECT ON public.refunds_by_carrier_plan_daily TO service_role;