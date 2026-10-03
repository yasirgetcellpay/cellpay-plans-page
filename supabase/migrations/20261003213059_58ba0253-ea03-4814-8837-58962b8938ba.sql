-- FIX F migration: refill-error cooldown for cellpay-proxy (CellPay US). STAGED, NOT SENT. CellPay Fraud, Oct 3 2026 ~12:40 CT.
-- New objects only. Each row holds ONE keyed hash (HMAC-SHA256 of "refill|<10-digit phone>|<plan id>", 64 hex) plus timestamps.
-- No phone, plan id, email or card is stored. Rows expire after 10 min and are pruned 1 h after expiry (inside the mark RPC; no cron).
-- Kill switch (the proxy then fails open, tested): fixF_killswitch.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.refill_cooldown (
  key         text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),   -- time of the last mark
  marks       integer NOT NULL DEFAULT 1,
  hits        integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz
);
CREATE INDEX IF NOT EXISTS refill_cooldown_expires_idx ON public.refill_cooldown (expires_at);
ALTER TABLE public.refill_cooldown ENABLE ROW LEVEL SECURITY;   -- no policies on purpose
REVOKE ALL ON TABLE public.refill_cooldown FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.refill_cooldown TO service_role;
COMMENT ON TABLE public.refill_cooldown IS
  'cellpay-proxy refill-error cooldown (Fix F, service role only). Keyed hash of phone+plan only. 10-min rows, pruned 1 h after expiry.';

-- Called by the proxy right after CellPay returns its refill-error result for checkout/transaction.
-- The upsert is atomic, so concurrent marks of one key leave one row. Returns {"marked": true|false}.
CREATE OR REPLACE FUNCTION public.refill_cooldown_mark(_key text, _seconds integer DEFAULT 600)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w integer := least(greatest(coalesce(_seconds, 600), 60), 3600);
BEGIN
  IF _key IS NULL OR _key !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('marked', false); END IF;
  INSERT INTO public.refill_cooldown AS rc (key, expires_at)
  VALUES (_key, clock_timestamp() + make_interval(secs => w))
  ON CONFLICT (key) DO UPDATE
    SET expires_at = greatest(rc.expires_at, EXCLUDED.expires_at), created_at = clock_timestamp(), marks = rc.marks + 1;
  DELETE FROM public.refill_cooldown WHERE key IN (      -- opportunistic, bounded cleanup
    SELECT key FROM public.refill_cooldown WHERE expires_at < clock_timestamp() - interval '1 hour'
    ORDER BY expires_at LIMIT 500);
  RETURN jsonb_build_object('marked', true);
END $$;

-- Called by the proxy before CellPay. Returns {"cooldown": true, "retry_after": <secs>} or {"cooldown": false}.
CREATE OR REPLACE FUNCTION public.refill_cooldown_check(_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  exp timestamptz;
BEGIN
  IF _key IS NULL OR _key !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('cooldown', false); END IF;
  UPDATE public.refill_cooldown SET hits = hits + 1, last_hit_at = clock_timestamp()
   WHERE key = _key AND expires_at > clock_timestamp()
   RETURNING expires_at INTO exp;
  IF exp IS NULL THEN RETURN jsonb_build_object('cooldown', false); END IF;
  RETURN jsonb_build_object('cooldown', true,
    'retry_after', greatest(1, ceil(extract(epoch FROM exp - clock_timestamp())))::int);
END $$;

REVOKE ALL ON FUNCTION public.refill_cooldown_mark(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refill_cooldown_check(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refill_cooldown_mark(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refill_cooldown_check(text) TO service_role;

DO $$
BEGIN
  IF has_table_privilege('anon','public.refill_cooldown','SELECT') OR has_table_privilege('authenticated','public.refill_cooldown','SELECT')
     OR has_function_privilege('anon','public.refill_cooldown_mark(text,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.refill_cooldown_mark(text,integer)','EXECUTE')
     OR has_function_privilege('anon','public.refill_cooldown_check(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.refill_cooldown_check(text)','EXECUTE') THEN
    RAISE EXCEPTION 'refill_cooldown is reachable by anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role','public.refill_cooldown_check(text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.refill_cooldown_mark(text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute the refill_cooldown functions';
  END IF;
END $$;

COMMIT;