BEGIN;

REVOKE EXECUTE ON FUNCTION public.log_transaction_attempt(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_transaction_log(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_transaction_attempt(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_transaction_log(uuid, text, text, text, text, jsonb) TO service_role;

REVOKE TRUNCATE, DELETE ON public.transaction_logs FROM PUBLIC, anon, authenticated;
REVOKE REFERENCES, TRIGGER, MAINTAIN ON public.transaction_logs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE ON public.transaction_logs FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r text; p text;
BEGIN
  IF has_function_privilege('anon', 'public.log_transaction_attempt(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.finalize_transaction_log(uuid,text,text,text,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.log_transaction_attempt(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finalize_transaction_log(uuid,text,text,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'revoke failed: anon/authenticated still have EXECUTE on a log RPC';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.log_transaction_attempt(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.finalize_transaction_log(uuid,text,text,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role lost EXECUTE: proxy logging would break';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege(r, 'public.transaction_logs', p) THEN
        RAISE EXCEPTION 'revoke failed: % still has % on public.transaction_logs', r, p;
      END IF;
    END LOOP;
    IF NOT has_table_privilege(r, 'public.transaction_logs', 'SELECT') THEN
      RAISE EXCEPTION '% lost SELECT on public.transaction_logs: admin dashboard would break', r;
    END IF;
  END LOOP;
  FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
    IF NOT has_table_privilege('service_role', 'public.transaction_logs', p) THEN
      RAISE EXCEPTION 'service_role lost % on public.transaction_logs', p;
    END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.transaction_logs'::regclass) THEN
    RAISE EXCEPTION 'RLS is off on public.transaction_logs';
  END IF;
END $$;

COMMIT;