-- Plaid v2 (Pay by Bank) M1: short-lived server-side binding of CellPay's plaid_ref to the order (CellPay Fraud, Oct 4 2026).
-- cellpay-proxy writes one row per approved exchange (step 2) and claims it once at checkout (step 3). Only HMACs are stored:
-- ref_h = HMAC(plaid_ref), bind_h = HMAC(plaid_ref + carrierId + plan_id + phone + amount + email + slug). No PII, no ref, no token.
-- Service role only (RLS on, no policies, functions executable by service_role only), same pattern as refill_cooldown.
CREATE TABLE IF NOT EXISTS public.plaid_v2_refs (
  ref_h      text PRIMARY KEY CHECK (ref_h ~ '^[0-9a-f]{64}$'),
  bind_h     text NOT NULL CHECK (bind_h ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS plaid_v2_refs_expires_idx ON public.plaid_v2_refs (expires_at);
ALTER TABLE public.plaid_v2_refs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.plaid_v2_refs FROM PUBLIC, anon, authenticated;

-- Step 2: bind (TTL clamped to 60..3600 s). Re-binding the same ref replaces the old row.
CREATE OR REPLACE FUNCTION public.plaid_v2_bind(_ref_h text, _bind_h text, _ttl_s integer DEFAULT 3600)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  w integer := least(greatest(coalesce(_ttl_s, 3600), 60), 3600);
BEGIN
  IF _ref_h IS NULL OR _ref_h !~ '^[0-9a-f]{64}$' OR _bind_h IS NULL OR _bind_h !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('bound', false);
  END IF;
  INSERT INTO public.plaid_v2_refs AS r (ref_h, bind_h, expires_at)
  VALUES (_ref_h, _bind_h, clock_timestamp() + make_interval(secs => w))
  ON CONFLICT (ref_h) DO UPDATE SET bind_h = EXCLUDED.bind_h, created_at = clock_timestamp(), expires_at = EXCLUDED.expires_at;
  DELETE FROM public.plaid_v2_refs WHERE ref_h IN (      -- opportunistic, bounded cleanup (expires_at index)
    SELECT ref_h FROM public.plaid_v2_refs WHERE expires_at < clock_timestamp() - interval '1 hour' ORDER BY expires_at LIMIT 500);
  RETURN jsonb_build_object('bound', true);
END $function$;

-- Step 3: claim exactly once. The row is deleted whatever the outcome, so a ref can never be tried twice.
-- result: ok | mismatch (other order values) | expired | missing (never bound, already used, or bad input)
CREATE OR REPLACE FUNCTION public.plaid_v2_claim(_ref_h text, _bind_h text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  b text; e timestamptz;
BEGIN
  IF _ref_h IS NULL OR _ref_h !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('result', 'missing'); END IF;
  DELETE FROM public.plaid_v2_refs WHERE ref_h = _ref_h RETURNING bind_h, expires_at INTO b, e;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'missing'); END IF;
  IF e < clock_timestamp() THEN RETURN jsonb_build_object('result', 'expired'); END IF;
  IF _bind_h IS NULL OR b <> _bind_h THEN RETURN jsonb_build_object('result', 'mismatch'); END IF;
  RETURN jsonb_build_object('result', 'ok');
END $function$;

REVOKE ALL ON FUNCTION public.plaid_v2_bind(text, text, integer), public.plaid_v2_claim(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plaid_v2_bind(text, text, integer), public.plaid_v2_claim(text, text) TO service_role;
