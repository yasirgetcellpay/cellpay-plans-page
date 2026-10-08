-- ADS-FOLLOWUPS-1008 Batch 2b (forward fix of Batch 2): Postgres regex repetition counts max out at 255, so '{1,512}' raised
-- "invalid repetition count(s)" whenever a click ID was present. Same function, same columns; the 1-512 length check is now length().
-- Function only. No table, column, policy or other function changes.
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
    CASE WHEN length(_data->>'gclid') BETWEEN 1 AND 512 AND _data->>'gclid' ~ '^[A-Za-z0-9_.~-]+$' THEN _data->>'gclid' END,
    CASE WHEN length(_data->>'gbraid') BETWEEN 1 AND 512 AND _data->>'gbraid' ~ '^[A-Za-z0-9_.~-]+$' THEN _data->>'gbraid' END,
    CASE WHEN length(_data->>'wbraid') BETWEEN 1 AND 512 AND _data->>'wbraid' ~ '^[A-Za-z0-9_.~-]+$' THEN _data->>'wbraid' END
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;