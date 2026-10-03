-- CellPay help chat (#9): rate-limit buckets, support requests, PII-free usage events, runtime on/off switch.
-- Locked down: RLS on everywhere. help_rate_limits, support_requests and help_events have NO policies and no
-- anon/authenticated grants (only the order-status / support-contact edge functions, as service_role, touch them).
-- help_settings: one read-only policy so the widget can read three booleans (and filter on id); only service_role and the
-- Lovable query-tool role (the approved ON / OFF scripts) can write it, and only the flags.
-- Existing tables (transaction_logs, page_visitors, user_roles, proxy_guard_events, ...) are NOT touched.

-- 1) Rate-limit buckets (fixed windows). Buckets are HMAC hashes, never raw IPs, phones or emails.
CREATE TABLE IF NOT EXISTS public.help_rate_limits (
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
ALTER TABLE public.help_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.help_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_rate_limits TO service_role;

-- 2) Support requests from the help chat contact form.
CREATE TABLE IF NOT EXISTS public.support_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  lang        text        NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'es')),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  contact     text        NOT NULL CHECK (char_length(contact) BETWEEN 3 AND 254),
  message     text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  order_last4 text        NULL CHECK (order_last4 IS NULL OR order_last4 ~ '^[A-Za-z0-9]{4}$'),
  page_path   text        NULL CHECK (page_path IS NULL OR char_length(page_path) <= 200),
  category    text        NULL CHECK (category IS NULL OR category IN ('order', 'payment', 'site_problem', 'other')),
  status      text        NOT NULL DEFAULT 'new',
  sent_at     timestamptz NULL,
  CONSTRAINT support_requests_status_check CHECK (status IN ('new', 'sent'))
);
CREATE INDEX IF NOT EXISTS support_requests_status_created_idx ON public.support_requests (status, created_at);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_requests TO service_role;

-- 3) Usage events for the watch. No PII and no hashes: function, outcome, language, time.
CREATE TABLE IF NOT EXISTS public.help_events (
  id         bigserial   PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  fn         text        NOT NULL CHECK (fn IN ('order-status', 'support-contact')),
  outcome    text        NOT NULL CHECK (outcome IN ('success', 'failed', 'pending', 'unconfirmed', 'not_found',
                                                     'rate_limited', 'invalid', 'unavailable', 'sent', 'honeypot')),
  lang       text        NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'es'))
);
CREATE INDEX IF NOT EXISTS help_events_created_idx ON public.help_events (created_at);
ALTER TABLE public.help_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.help_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.help_events_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.help_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.help_events_id_seq TO service_role;

-- 4) Runtime on/off switch (one row, id = 1). Ships OFF; it is switched on at publish time by an approved UPDATE.
CREATE TABLE IF NOT EXISTS public.help_settings (
  id              smallint    PRIMARY KEY CHECK (id = 1),
  chat_enabled    boolean     NOT NULL DEFAULT false,
  status_enabled  boolean     NOT NULL DEFAULT true,
  contact_enabled boolean     NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.help_settings (id, chat_enabled, status_enabled, contact_enabled)
VALUES (1, false, true, true)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.help_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.help_settings FROM PUBLIC, anon, authenticated;
-- Browser read: exactly the 3 booleans plus id (helpSettings.ts filters .eq("id", 1); Postgres needs SELECT on a column used
-- in WHERE, so without id the read is "permission denied" and the widget stays OFF). No other column, no write.
GRANT SELECT (id, chat_enabled, status_enabled, contact_enabled) ON public.help_settings TO anon, authenticated;
GRANT SELECT, UPDATE ON public.help_settings TO service_role;
CREATE POLICY help_settings_public_read ON public.help_settings FOR SELECT TO anon, authenticated USING (id = 1);
-- The ON flip at publish and the OFF revert step run through Lovable's query tool, whose role (sandbox_exec) gets no UPDATE
-- on new tables. Give it exactly the switch: SELECT/UPDATE of the flags on row 1. Skipped if that role does not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT SELECT (id, chat_enabled, status_enabled, contact_enabled, updated_at), '
         || 'UPDATE (chat_enabled, status_enabled, contact_enabled, updated_at) ON public.help_settings TO sandbox_exec';
    EXECUTE 'CREATE POLICY help_settings_switch_read ON public.help_settings FOR SELECT TO sandbox_exec USING (id = 1)';
    EXECUTE 'CREATE POLICY help_settings_switch_update ON public.help_settings FOR UPDATE TO sandbox_exec USING (id = 1) WITH CHECK (id = 1)';
  END IF;
END $$;

-- 5) Atomic hit counter. Returns true while the bucket is within _max hits for the current window.
--    With 2% probability it also prunes: rate-limit rows older than 1 day, and support_requests / help_events
--    older than 24 months (Lead retention decision).
CREATE OR REPLACE FUNCTION public.help_rate_limit_hit(_bucket text, _max integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws timestamptz;
  _hits integer;
BEGIN
  IF _bucket IS NULL OR length(_bucket) > 200 OR _window_seconds IS NULL OR _window_seconds < 1 OR _max IS NULL OR _max < 0 THEN
    RETURN false;
  END IF;
  _ws := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.help_rate_limits AS r (bucket, window_start, hits)
  VALUES (_bucket, _ws, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO _hits;
  IF random() < 0.02 THEN
    DELETE FROM public.help_rate_limits WHERE window_start < now() - interval '1 day';
    DELETE FROM public.support_requests WHERE created_at < now() - interval '24 months';
    DELETE FROM public.help_events WHERE created_at < now() - interval '24 months';
  END IF;
  RETURN _hits <= _max;
END;
$$;
REVOKE ALL ON FUNCTION public.help_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.help_rate_limit_hit(text, integer, integer) TO service_role;

COMMENT ON TABLE public.support_requests IS 'Help chat contact messages. Locked (RLS, no policies). Retention 24 months.';
COMMENT ON TABLE public.help_events IS 'Help chat usage outcomes, no PII. Locked (RLS, no policies). Retention 24 months.';
COMMENT ON TABLE public.help_settings IS 'Help chat runtime switch (single row id=1). Public read of 3 booleans; service_role writes only.';