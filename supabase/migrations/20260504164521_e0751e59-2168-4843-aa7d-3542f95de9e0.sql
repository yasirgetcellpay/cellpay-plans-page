DROP POLICY IF EXISTS "Visitors can record presence" ON public.page_visitors;
DROP POLICY IF EXISTS "Visitors can refresh presence" ON public.page_visitors;

REVOKE INSERT, UPDATE ON public.page_visitors FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_presence(_session_id text, _path text, _user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 100 THEN
    RETURN;
  END IF;
  INSERT INTO public.page_visitors (session_id, path, user_agent, last_seen)
  VALUES (
    _session_id,
    COALESCE(left(_path, 2048), '/'),
    NULLIF(left(_user_agent, 1000), ''),
    now()
  )
  ON CONFLICT (session_id) DO UPDATE
    SET path = EXCLUDED.path,
        user_agent = EXCLUDED.user_agent,
        last_seen = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_presence(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_presence(text, text, text) TO anon, authenticated;