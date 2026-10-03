BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.user_roles FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.page_visitors FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text; r text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.user_roles','public.page_visitors'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF NOT has_table_privilege(r, t, 'SELECT') THEN
        RAISE EXCEPTION '% lost SELECT on %: admin check / dashboard / RLS policies would break', r, t;
      END IF;
      FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF has_table_privilege(r, t, p) THEN
          RAISE EXCEPTION 'revoke failed: % still has % on %', r, p, t;
        END IF;
      END LOOP;
    END LOOP;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT has_table_privilege('service_role', t, p) THEN
        RAISE EXCEPTION 'service_role lost % on %', p, t;
      END IF;
    END LOOP;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t::regclass) THEN
      RAISE EXCEPTION 'RLS is off on %', t;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('anon', 'public.record_presence(text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.record_presence(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'record_presence lost EXECUTE for anon/authenticated: visitor tracking would break';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.record_presence(text,text,text)'::regprocedure) THEN
    RAISE EXCEPTION 'record_presence is not SECURITY DEFINER: callers would need table INSERT/UPDATE';
  END IF;
  IF NOT has_table_privilege((SELECT proowner FROM pg_proc WHERE oid = 'public.record_presence(text,text,text)'::regprocedure), 'public.page_visitors'::regclass, 'INSERT')
     OR NOT has_table_privilege((SELECT proowner FROM pg_proc WHERE oid = 'public.record_presence(text,text,text)'::regprocedure), 'public.page_visitors'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'record_presence owner cannot INSERT/UPDATE page_visitors';
  END IF;
END $$;

COMMIT;