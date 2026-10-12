-- lovable-cron-fallback-reviewed: owner-specified 5-min queue drain for fraud linking; worker returns immediately when mflink=off or queue empty
DROP TRIGGER IF EXISTS checkout_blocklist_fraud_link ON public.checkout_blocklist;
CREATE TABLE IF NOT EXISTS public.fraud_link_queue (block_id uuid PRIMARY KEY, enqueued_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz, linked int, err text);
GRANT ALL ON public.fraud_link_queue TO service_role;
ALTER TABLE public.fraud_link_queue ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.trg_fraud_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reason = 'manual' AND NEW.active AND coalesce(NEW.added_by,'') <> 'MF-LINK' THEN
    BEGIN INSERT INTO public.fraud_link_queue(block_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'fraud_link enqueue failed: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER checkout_blocklist_fraud_link_enqueue AFTER INSERT ON public.checkout_blocklist FOR EACH ROW EXECUTE FUNCTION public.trg_fraud_link();

CREATE INDEX IF NOT EXISTS tl_mf_device_idx ON public.transaction_logs ((metadata->>'mf_device')) WHERE metadata ? 'mf_device';
CREATE INDEX IF NOT EXISTS tl_mf_did_idx    ON public.transaction_logs ((metadata->>'mf_did'))    WHERE metadata ? 'mf_did';
CREATE INDEX IF NOT EXISTS tl_mf_card_idx   ON public.transaction_logs ((metadata->>'mf_card'))   WHERE metadata ? 'mf_card';
CREATE INDEX IF NOT EXISTS tl_mf_addr_idx   ON public.transaction_logs ((metadata->>'mf_addr'))   WHERE metadata ? 'mf_addr';

CREATE OR REPLACE FUNCTION public.fraud_txs_for(_kt text, _kv text) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id FROM public.transaction_logs t WHERE _kt = 'phone' AND t.phone_number = _kv AND t.created_at > now() - interval '90 days'
  UNION SELECT t.id FROM public.transaction_logs t WHERE _kt = 'email' AND lower(btrim(t.email)) = _kv AND t.created_at > now() - interval '90 days'
  UNION SELECT t.id FROM public.transaction_logs t WHERE _kt = 'device' AND (t.metadata ? 'mf_device') AND t.metadata->>'mf_device' = _kv AND t.created_at > now() - interval '90 days'
  UNION SELECT t.id FROM public.transaction_logs t WHERE _kt = 'device' AND (t.metadata ? 'mf_did') AND t.metadata->>'mf_did' = _kv AND t.created_at > now() - interval '90 days'
  UNION SELECT t.id FROM public.transaction_logs t WHERE _kt = 'card' AND (t.metadata ? 'mf_card') AND t.metadata->>'mf_card' = _kv AND t.created_at > now() - interval '90 days'
  UNION SELECT f.transaction_log_id FROM public.transaction_card_facts f JOIN public.transaction_logs t ON t.id = f.transaction_log_id
        WHERE _kt = 'card' AND f.card_bin = split_part(_kv, ':', 1) AND f.card_last4 = split_part(_kv, ':', 2) AND t.created_at > now() - interval '90 days'
  UNION SELECT t.id FROM public.transaction_logs t WHERE _kt = 'address' AND (t.metadata ? 'mf_addr') AND t.metadata->>'mf_addr' = _kv AND t.created_at > now() - interval '90 days'
  LIMIT 500;
$$;
CREATE OR REPLACE FUNCTION public.fraud_ids_of(_txs uuid[]) RETURNS TABLE(tx uuid, kt text, kv text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, x.kt, x.kv FROM public.transaction_logs t
  LEFT JOIN public.transaction_card_facts f ON f.transaction_log_id = t.id
  CROSS JOIN LATERAL (VALUES ('phone', nullif(btrim(t.phone_number),'')), ('email', nullif(lower(btrim(t.email)),'')),
     ('device', t.metadata->>'mf_device'), ('device', t.metadata->>'mf_did'), ('card', t.metadata->>'mf_card'),
     ('card', CASE WHEN f.card_bin IS NOT NULL AND f.card_last4 IS NOT NULL THEN f.card_bin || ':' || f.card_last4 END),
     ('address', t.metadata->>'mf_addr')) x(kt, kv)
  WHERE t.id = ANY(_txs) AND x.kv IS NOT NULL AND x.kv <> 'customer@cellpay.us';
$$;
CREATE OR REPLACE FUNCTION public.fraud_link_candidates(_block_id uuid)
RETURNS TABLE(linked_type text, linked_value text, via_tx uuid, distinct_ids int, action text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b record; txs uuid[]; r record; n int;
BEGIN
  SELECT key_type, value_norm INTO b FROM public.checkout_blocklist WHERE id = _block_id AND reason = 'manual' AND active;
  IF b IS NULL THEN RETURN; END IF;
  txs := ARRAY(SELECT public.fraud_txs_for(b.key_type, b.value_norm));
  IF coalesce(array_length(txs,1),0) = 0 THEN RETURN; END IF;
  FOR r IN SELECT DISTINCT ON (i.kt, i.kv) i.kt, i.kv, i.tx FROM public.fraud_ids_of(txs) i
           WHERE NOT (i.kt = b.key_type AND i.kv = b.value_norm) LOOP
    n := CASE WHEN r.kt IN ('phone','email') THEN 1 ELSE
           (SELECT count(DISTINCT j.kt || j.kv) FROM public.fraud_ids_of(ARRAY(SELECT public.fraud_txs_for(r.kt, r.kv))) j WHERE j.kt IN ('phone','email'))::int END;
    linked_type := r.kt; linked_value := r.kv; via_tx := r.tx; distinct_ids := n;
    action := CASE
      WHEN EXISTS (SELECT 1 FROM public.fraud_watch_lists w WHERE w.list IN ('not_block','dnb_legacy') AND lower(w.value) = r.kv) THEN 'skip_not_block'
      WHEN EXISTS (SELECT 1 FROM public.checkout_blocklist x WHERE x.key_type = r.kt AND x.value_norm = r.kv AND x.active) THEN 'already_blocked'
      WHEN r.kt NOT IN ('phone','email') AND n > 3 THEN 'review'
      ELSE 'block' END;
    RETURN NEXT;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.fraud_link_worker(_max int DEFAULT 5) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '20s' AS $$
DECLARE q record; k int := 0; c int;
BEGIN
  IF coalesce((SELECT value FROM public.checkout_guard_controls WHERE key = 'mflink'), 'off') = 'off' THEN RETURN 0; END IF;
  FOR q IN SELECT block_id FROM public.fraud_link_queue WHERE done_at IS NULL ORDER BY enqueued_at LIMIT _max FOR UPDATE SKIP LOCKED LOOP
    BEGIN c := public.fraud_link_apply(q.block_id);
      UPDATE public.fraud_link_queue SET done_at = now(), linked = c, err = NULL WHERE block_id = q.block_id;
    EXCEPTION WHEN OTHERS THEN UPDATE public.fraud_link_queue SET done_at = now(), err = left(SQLERRM, 300) WHERE block_id = q.block_id; END;
    k := k + 1;
  END LOOP;
  RETURN k;
END $$;
REVOKE ALL ON FUNCTION public.fraud_link_worker(int), public.fraud_txs_for(text,text), public.fraud_ids_of(uuid[]), public.fraud_link_candidates(uuid) FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('fraud-link-worker', '*/5 * * * *', $$SELECT public.fraud_link_worker(5)$$);