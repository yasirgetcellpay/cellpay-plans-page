-- SERVER-FALLBACK-1012: lets the CSV function tell a wrong token (404) from an empty list (200). Service role only.
CREATE OR REPLACE FUNCTION public.purchase_fallback_csv_token_ok(_token text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN coalesce(encode(extensions.digest(coalesce(_token, ''), 'sha256'), 'hex')
    = (SELECT c.value FROM public.checkout_guard_controls c WHERE c.key = 'server_fallback_csv_sha256'), false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_fallback_csv_token_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_fallback_csv_token_ok(text) TO service_role;