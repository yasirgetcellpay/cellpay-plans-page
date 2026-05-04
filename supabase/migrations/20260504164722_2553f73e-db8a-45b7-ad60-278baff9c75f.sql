DROP POLICY IF EXISTS "Anyone can finalize pending transaction logs" ON public.transaction_logs;
DROP POLICY IF EXISTS "Checkout can create pending transaction logs" ON public.transaction_logs;

REVOKE INSERT, UPDATE ON public.transaction_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_transaction_attempt(_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.transaction_logs (
    carrier_name, carrier_slug, carrier_id, plan_id, phone_number, email,
    first_name, last_name, amount, total, payment_method, card_type,
    status, source_ip, user_agent, metadata
  ) VALUES (
    NULLIF(_data->>'carrier_name',''),
    NULLIF(_data->>'carrier_slug',''),
    NULLIF(_data->>'carrier_id',''),
    NULLIF(_data->>'plan_id',''),
    NULLIF(_data->>'phone_number',''),
    NULLIF(_data->>'email',''),
    NULLIF(_data->>'first_name',''),
    NULLIF(_data->>'last_name',''),
    NULLIF(_data->>'amount','')::numeric,
    NULLIF(_data->>'total','')::numeric,
    NULLIF(_data->>'payment_method',''),
    NULLIF(_data->>'card_type',''),
    'pending',
    NULLIF(_data->>'source_ip',''),
    NULLIF(_data->>'user_agent',''),
    COALESCE(_data->'metadata', '{}'::jsonb)
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_transaction_log(
  _id uuid, _status text, _hashid text, _transaction_id text,
  _error_message text, _raw_response jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('success','failed','pending') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.transaction_logs
  SET status = _status,
      hashid = COALESCE(_hashid, hashid),
      transaction_id = COALESCE(_transaction_id, transaction_id),
      error_message = _error_message,
      raw_response = COALESCE(_raw_response, raw_response)
  WHERE id = _id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.log_transaction_attempt(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_transaction_log(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_transaction_attempt(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_transaction_log(uuid, text, text, text, text, jsonb) TO anon, authenticated;