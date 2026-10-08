-- ADS-FOLLOWUPS-1008 Batch 2: Google Ads click IDs on the sales log (IDs only; nullable; no other data).
-- Written by cellpay-proxy through log_transaction_attempt(_data) on every checkout/transaction row; read by Reports.
-- A value is stored only when it is 1-512 characters of A-Z a-z 0-9 _ . ~ - (anything else is stored as NULL).
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.transaction_logs
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text;

COMMENT ON COLUMN public.transaction_logs.gclid IS 'Google Ads gclid from the landing URL (last click, kept 90 days in the browser). ID only. ADS-FOLLOWUPS-1008';
COMMENT ON COLUMN public.transaction_logs.gbraid IS 'Google Ads gbraid from the landing URL (last click, kept 90 days in the browser). ID only. ADS-FOLLOWUPS-1008';
COMMENT ON COLUMN public.transaction_logs.wbraid IS 'Google Ads wbraid from the landing URL (last click, kept 90 days in the browser). ID only. ADS-FOLLOWUPS-1008';

CREATE OR REPLACE FUNCTION public.log_transaction_attempt(_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.transaction_logs (
    carrier_name, carrier_slug, carrier_id, plan_id, phone_number, email,
    first_name, last_name, amount, total, payment_method, card_type,
    status, source_ip, user_agent, metadata,
    gclid, gbraid, wbraid
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
    COALESCE(_data->'metadata', '{}'::jsonb),
    CASE WHEN _data->>'gclid' ~ '^[A-Za-z0-9_.~-]{1,512}$' THEN _data->>'gclid' END,
    CASE WHEN _data->>'gbraid' ~ '^[A-Za-z0-9_.~-]{1,512}$' THEN _data->>'gbraid' END,
    CASE WHEN _data->>'wbraid' ~ '^[A-Za-z0-9_.~-]{1,512}$' THEN _data->>'wbraid' END
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;