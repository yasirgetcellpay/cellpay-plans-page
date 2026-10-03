-- BL-3 migration: server-side duplicate-charge guard for cellpay-proxy (CellPay US). PREPARED, NOT SENT. CellPay Fraud, Oct 3 2026 ~10:55 CT.
-- New objects only. Stores an HMAC key (64 hex; never a PAN or token), the normalized phone (same sensitivity as transaction_logs,
-- service role only) and the payment method. Claim rows live 1 h; rows that refused a duplicate live 7 d for the watch.
BEGIN;

CREATE TABLE IF NOT EXISTS public.checkout_dedupe (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_h          text NOT NULL CHECK (key_h ~ '^[0-9a-f]{64}$'),
  phone_norm     text CHECK (phone_norm IS NULL OR phone_norm ~ '^[0-9]{7,15}$'),
  payment_method text CHECK (payment_method IS NULL OR payment_method ~ '^[a-z_]{1,30}$'),
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  dup_count      integer NOT NULL DEFAULT 0,
  last_dup_at    timestamptz
);
CREATE INDEX IF NOT EXISTS cd_key_time_idx ON public.checkout_dedupe (key_h, created_at DESC);
CREATE INDEX IF NOT EXISTS cd_time_idx ON public.checkout_dedupe (created_at);
CREATE INDEX IF NOT EXISTS cd_dup_idx ON public.checkout_dedupe (last_dup_at) WHERE dup_count > 0;
ALTER TABLE public.checkout_dedupe ENABLE ROW LEVEL SECURITY;   -- no policies on purpose
REVOKE ALL ON TABLE public.checkout_dedupe FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_dedupe TO service_role;
COMMENT ON TABLE public.checkout_dedupe IS
  'cellpay-proxy duplicate-charge guard (BL-3, service role only). HMAC key only (never a PAN/token). Claims pruned after 1 h, duplicate rows after 7 d.';

-- Returns {"duplicate": true|false} (a scalar jsonb, so PostgREST answers with the bare object).
-- Atomic claim: the advisory xact lock serializes identical keys, so N concurrent identical requests give 1 claim and N-1 duplicates.
CREATE OR REPLACE FUNCTION public.checkout_dedupe_claim(_key text, _phone text, _method text, _window_s integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w integer := least(greatest(coalesce(_window_s, 10), 1), 60);
  prev bigint;
  ph text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  pm text := lower(btrim(coalesce(_method, '')));
BEGIN
  IF _key IS NULL OR _key !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('duplicate', false); END IF;
  IF length(ph) = 11 AND left(ph, 1) = '1' THEN ph := right(ph, 10); END IF;
  IF ph !~ '^[0-9]{7,15}$' THEN ph := NULL; END IF;
  IF pm !~ '^[a-z_]{1,30}$' THEN pm := NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_key, 0));
  SELECT id INTO prev FROM public.checkout_dedupe
   WHERE key_h = _key AND created_at > clock_timestamp() - make_interval(secs => w)
   ORDER BY created_at DESC LIMIT 1;
  IF prev IS NOT NULL THEN
    UPDATE public.checkout_dedupe SET dup_count = dup_count + 1, last_dup_at = clock_timestamp() WHERE id = prev;
    RETURN jsonb_build_object('duplicate', true);
  END IF;
  INSERT INTO public.checkout_dedupe (key_h, phone_norm, payment_method) VALUES (_key, ph, pm);
  DELETE FROM public.checkout_dedupe WHERE id IN (     -- bounded prune
    SELECT id FROM public.checkout_dedupe
     WHERE (dup_count = 0 AND created_at < now() - interval '1 hour') OR created_at < now() - interval '7 days'
     ORDER BY created_at LIMIT 500);
  RETURN jsonb_build_object('duplicate', false);
END $$;

REVOKE ALL ON FUNCTION public.checkout_dedupe_claim(text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_dedupe_claim(text, text, text, integer) TO service_role;

DO $$
BEGIN
  IF has_table_privilege('anon','public.checkout_dedupe','SELECT') OR has_table_privilege('authenticated','public.checkout_dedupe','SELECT')
     OR has_function_privilege('anon','public.checkout_dedupe_claim(text,text,text,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.checkout_dedupe_claim(text,text,text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'checkout_dedupe is reachable by anon/authenticated';
  END IF;
END $$;

COMMIT;