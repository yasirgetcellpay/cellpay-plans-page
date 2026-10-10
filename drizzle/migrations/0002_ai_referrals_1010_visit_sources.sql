CREATE TABLE IF NOT EXISTS public.visit_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  day date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  session_id text NOT NULL,
  host text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  landing_path text NOT NULL DEFAULT '/'
);
CREATE UNIQUE INDEX IF NOT EXISTS visit_sources_session_day_uq ON public.visit_sources (session_id, day);
CREATE INDEX IF NOT EXISTS visit_sources_created_idx ON public.visit_sources (created_at);
ALTER TABLE public.visit_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visit_sources FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_visit_source(_session_id text, _referrer_host text, _utm_source text, _utm_medium text, _landing_path text, _host text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 100 THEN RETURN; END IF;
  INSERT INTO public.visit_sources (session_id, host, referrer_host, utm_source, utm_medium, landing_path)
  VALUES (_session_id, NULLIF(left(_host, 60), ''), NULLIF(left(_referrer_host, 100), ''), NULLIF(left(_utm_source, 60), ''), NULLIF(left(_utm_medium, 60), ''), COALESCE(NULLIF(left(split_part(_landing_path, '?', 1), 200), ''), '/'))
  ON CONFLICT (session_id, day) DO NOTHING;
END;
$fn$;
REVOKE ALL ON FUNCTION public.record_visit_source(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_visit_source(text, text, text, text, text, text) TO anon, authenticated;