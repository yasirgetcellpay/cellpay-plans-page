-- VZ-PREPAID-GUARD-1017: additive, read-only history lookup and report; no existing rows changed.
CREATE FUNCTION public.vz_prepaid_guard_check(_phone text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
SELECT jsonb_build_object(
  'refunded', EXISTS (
    SELECT 1 FROM public.transaction_logs
    WHERE phone_number = _phone
      AND carrier_slug IN ('verizon', 'verizon-wireless-flexi')
      AND created_at > now() - interval '30 days'
      AND coalesce(error_message, '') <> 'vz_prepaid_guard'
      AND (error_message ILIKE '%auto refund%' OR refunded_at IS NOT NULL OR refund_source IS NOT NULL
        OR coalesce(raw_response->>'message', raw_response#>>'{data,message}', '') ILIKE '%auto refund%')
  ),
  'success', EXISTS (
    SELECT 1 FROM public.transaction_logs
    WHERE phone_number = _phone
      AND carrier_slug IN ('verizon', 'verizon-wireless-flexi')
      AND status = 'success'
  )
);
$$;
REVOKE ALL ON FUNCTION public.vz_prepaid_guard_check(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vz_prepaid_guard_check(text) TO service_role;

CREATE VIEW public.vz_guard_daily WITH (security_invoker = true) AS
SELECT (created_at AT TIME ZONE 'America/Chicago')::date AS day,
  count(*) FILTER (WHERE error_message = 'vz_prepaid_guard') AS vz_guard_rows,
  count(*) FILTER (WHERE plan_id = '291945' AND carrier_slug = 'verizon' AND status = 'failed' AND error_message ILIKE '%auto refund%') AS vz291945_auto_refunds,
  count(*) FILTER (WHERE carrier_slug IN ('verizon', 'verizon-wireless-flexi') AND status = 'success') AS vz_successes
FROM public.transaction_logs
WHERE created_at >= now() - interval '14 days'
GROUP BY (created_at AT TIME ZONE 'America/Chicago')::date;
REVOKE ALL ON public.vz_guard_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vz_guard_daily TO service_role;