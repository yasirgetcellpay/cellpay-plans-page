-- OURSIDE-RETRY-1012: atomic merge of a small jsonb patch into one transaction_logs.metadata (service role only).
CREATE OR REPLACE FUNCTION public.tx_log_meta_merge(_id uuid, _patch jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.transaction_logs SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_patch, '{}'::jsonb)
  WHERE id = _id AND jsonb_typeof(_patch) = 'object';
$$;
REVOKE ALL ON FUNCTION public.tx_log_meta_merge(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tx_log_meta_merge(uuid, jsonb) TO service_role;