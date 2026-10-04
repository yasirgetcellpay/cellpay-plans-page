-- OPTION B, part 1 (Lovable migration together with the edge function, message M-OPT-B): key check RPC. New object only.
CREATE OR REPLACE FUNCTION public.ops_alarm_push_key_ok(_k text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT length(_k) = length(decrypted_secret)
                          AND md5(_k) = md5(decrypted_secret)   -- compare digests, not the raw strings
                     FROM vault.decrypted_secrets WHERE name = 'ops_alarm_push_key' LIMIT 1), false) $$;
REVOKE ALL ON FUNCTION public.ops_alarm_push_key_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_alarm_push_key_ok(text) TO service_role;