-- SERVER-FALLBACK-1012: loosen checkout_guard_controls only for the two new keys
ALTER TABLE public.checkout_guard_controls DROP CONSTRAINT checkout_guard_controls_check;
ALTER TABLE public.checkout_guard_controls DROP CONSTRAINT checkout_guard_controls_key_check;
ALTER TABLE public.checkout_guard_controls ADD CONSTRAINT checkout_guard_controls_check CHECK (
  (key = ANY (ARRAY['dupcharge'::text, 'spread'::text, 'vel1'::text])
     AND value = ANY (ARRAY['on'::text, 'shadow'::text, 'off'::text])
     AND NOT (key = 'spread' AND value = 'shadow'))
  OR (key = 'server_fallback' AND value = ANY (ARRAY['off'::text, 'shadow'::text, 'live'::text]))
  OR (key = 'server_fallback_csv_sha256')
);

CREATE TABLE public.purchase_fallback_items (
  carrier_slug text NOT NULL, plan_id text NOT NULL, item_name text NOT NULL, margin numeric NOT NULL,
  PRIMARY KEY (carrier_slug, plan_id)
);
GRANT ALL ON public.purchase_fallback_items TO service_role;
ALTER TABLE public.purchase_fallback_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_fallback_excluded (transaction_id text PRIMARY KEY);
GRANT ALL ON public.purchase_fallback_excluded TO service_role;
ALTER TABLE public.purchase_fallback_excluded ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchase_fallback_queue (
  transaction_id text PRIMARY KEY,
  gclid text,
  conv_time timestamptz NOT NULL,
  total numeric NOT NULL,
  amount numeric NOT NULL,
  item_name text NOT NULL,
  ads_value numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('shadow','queued','skipped')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_served_at timestamptz
);
GRANT ALL ON public.purchase_fallback_queue TO service_role;
ALTER TABLE public.purchase_fallback_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.purchase_fallback_sweep()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  mode text;
  c record;
  ins text;
BEGIN
  SELECT value INTO mode FROM public.checkout_guard_controls WHERE key = 'server_fallback';
  IF mode IS NULL OR mode = 'off' THEN RETURN; END IF;

  FOR c IN
    SELECT t.hashid, t.gclid, t.created_at, t.total, t.amount, i.item_name,
           round(t.amount * i.margin + (t.total - t.amount), 2) AS ads_value
    FROM public.transaction_logs t
    JOIN public.purchase_fallback_items i ON i.carrier_slug = t.carrier_slug AND i.plan_id = t.plan_id
    WHERE t.status = 'success' AND t.hashid IS NOT NULL
      AND t.created_at >= timestamptz '2026-10-12 08:00:00-05'
      AND t.created_at < now() - interval '10 minutes'
      AND t.created_at > now() - interval '3 days'
      AND t.amount > 0 AND t.total >= t.amount AND t.total < 5000
      AND NOT EXISTS (SELECT 1 FROM public.purchase_tag_fires f WHERE f.transaction_id = t.hashid)
      AND NOT EXISTS (SELECT 1 FROM public.purchase_fallback_queue q WHERE q.transaction_id = t.hashid)
      AND NOT EXISTS (SELECT 1 FROM public.purchase_fallback_excluded x WHERE x.transaction_id = t.hashid)
  LOOP
    IF mode = 'shadow' THEN
      INSERT INTO public.purchase_fallback_queue (transaction_id, gclid, conv_time, total, amount, item_name, ads_value, status)
      VALUES (c.hashid, c.gclid, c.created_at, c.total, c.amount, c.item_name, c.ads_value, 'shadow')
      ON CONFLICT (transaction_id) DO NOTHING;
    ELSIF mode = 'live' THEN
      ins := NULL;
      INSERT INTO public.purchase_tag_fires (transaction_id, hashid, value, source)
      VALUES (c.hashid, c.hashid, round(c.total, 2), 'server_fallback')
      ON CONFLICT (transaction_id) DO NOTHING
      RETURNING transaction_id INTO ins;
      IF ins IS NOT NULL THEN
        INSERT INTO public.purchase_fallback_queue (transaction_id, gclid, conv_time, total, amount, item_name, ads_value, status, note)
        VALUES (c.hashid, c.gclid, c.created_at, c.total, c.amount, c.item_name, c.ads_value,
                CASE WHEN c.gclid IS NOT NULL THEN 'queued' ELSE 'skipped' END,
                CASE WHEN c.gclid IS NULL THEN 'no gclid' END)
        ON CONFLICT (transaction_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_fallback_sweep() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_fallback_claimed(_transaction_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.purchase_fallback_queue q WHERE q.transaction_id = _transaction_id AND q.status = 'queued');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_fallback_claimed(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_fallback_csv(_token text)
RETURNS TABLE(gclid text, order_id text, conv_time text, value numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET timezone = 'America/Chicago' AS $$
#variable_conflict use_column
DECLARE
  want text;
BEGIN
  SELECT c.value INTO want FROM public.checkout_guard_controls c WHERE c.key = 'server_fallback_csv_sha256';
  IF want IS NULL OR encode(extensions.digest(coalesce(_token, ''), 'sha256'), 'hex') <> want THEN
    RETURN;
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS _pf_rows (tid text) ON COMMIT DROP;
  TRUNCATE _pf_rows;
  INSERT INTO _pf_rows (tid)
  SELECT q.transaction_id FROM public.purchase_fallback_queue q
  WHERE q.status = 'queued' AND q.gclid IS NOT NULL
    AND q.conv_time > now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.purchase_tag_fires f WHERE f.transaction_id = q.transaction_id AND f.source <> 'server_fallback')
    AND NOT EXISTS (SELECT 1 FROM public.purchase_fallback_excluded x WHERE x.transaction_id = q.transaction_id);
  UPDATE public.purchase_fallback_queue q SET first_served_at = now()
  WHERE q.first_served_at IS NULL AND q.transaction_id IN (SELECT tid FROM _pf_rows);
  RETURN QUERY
  SELECT q.gclid, q.transaction_id, to_char(q.conv_time, 'YYYY-MM-DD HH24:MI:SSTZH:TZM'), q.ads_value
  FROM public.purchase_fallback_queue q
  WHERE q.transaction_id IN (SELECT tid FROM _pf_rows)
  ORDER BY q.conv_time;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purchase_fallback_csv(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_fallback_csv(text) TO service_role;

-- Part 1.9: cliff sweep ignores server_fallback rows (only change: one extra filter)
CREATE OR REPLACE FUNCTION public.purchase_tag_cliff_sweep()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  enabled text;
  min_hub int;
  min_ratio numeric;
  floor_ts timestamptz;
  hour_start timestamptz;
  hour_end timestamptz;
  hour_label text;
  hub_ok int;
  tag_ok int;
  ratio numeric;
  aid bigint;
BEGIN
  SELECT value INTO enabled FROM public.purchase_tag_guard_config WHERE key = 'enabled';
  IF coalesce(enabled, 'off') <> 'on' THEN
    RETURN 0;
  END IF;

  SELECT coalesce((SELECT value::int FROM public.purchase_tag_guard_config WHERE key = 'min_hub_ok'), 20)
    INTO min_hub;
  SELECT coalesce((SELECT value::numeric FROM public.purchase_tag_guard_config WHERE key = 'min_ratio'), 0.5)
    INTO min_ratio;

  hour_start := (date_trunc('hour', now() AT TIME ZONE 'America/Chicago') - interval '1 hour')
                AT TIME ZONE 'America/Chicago';
  hour_end   := date_trunc('hour', now() AT TIME ZONE 'America/Chicago')
                AT TIME ZONE 'America/Chicago';
  hour_label := to_char(hour_start AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD HH24:MI');

  BEGIN
    SELECT value::timestamptz INTO floor_ts FROM public.purchase_tag_guard_config WHERE key = 'floor_ts';
  EXCEPTION WHEN OTHERS THEN
    floor_ts := NULL;
  END;
  IF floor_ts IS NOT NULL AND hour_start < floor_ts THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO hub_ok
  FROM public.transaction_logs t
  WHERE t.created_at >= hour_start AND t.created_at < hour_end
    AND t.status = 'success'
    AND coalesce(t.email, '') NOT ILIKE '%@example.com'
    AND coalesce(t.carrier_slug, '') <> 'blocklist-test';

  SELECT count(*) INTO tag_ok
  FROM public.purchase_tag_fires f
  WHERE f.created_at >= hour_start AND f.created_at < hour_end
    AND f.transaction_id NOT LIKE 'GATE\_%'
    AND f.source <> 'server_fallback';   -- SERVER-FALLBACK-1012

  IF hub_ok < min_hub THEN
    RETURN 0;
  END IF;

  ratio := CASE WHEN hub_ok > 0 THEN tag_ok::numeric / hub_ok::numeric ELSE 1 END;
  IF ratio >= min_ratio THEN
    RETURN 0;
  END IF;

  INSERT INTO public.ops_alarms (source, kind, ref, severity, detail, notify_note)
  VALUES (
    'seo-tracking',
    'purchase_tag_cliff',
    'hour:' || hour_label,
    'alarm',
    jsonb_build_object(
      'text', format(
        'CellPay SEO [purchase tag cliff]: CT hour %s hub_ok=%s tag_fires=%s ratio=%s (< %s). Check OrderConfirmation / GTM REFILL Updated.',
        hour_label, hub_ok, tag_ok, round(ratio, 3), min_ratio),
      'hour_ct', hour_label,
      'hub_ok', hub_ok,
      'tag_ok', tag_ok,
      'ratio', round(ratio, 3),
      'min_ratio', min_ratio
    ),
    'pull only (seo-tracking; no Telegram)'
  )
  ON CONFLICT (source, kind, ref) DO NOTHING
  RETURNING id INTO aid;

  RETURN coalesce(aid, 0);
END;
$function$;