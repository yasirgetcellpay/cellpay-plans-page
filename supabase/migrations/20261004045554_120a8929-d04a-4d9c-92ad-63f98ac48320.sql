-- lovable-cron-fallback-reviewed: one-time bounded backfill (~52 runs) that unschedules itself when drained; nightly job is 12 runs/day in a 1-hour window.
-- AD-1 M1: admin dashboard speed + page_visitors retention (CellPay US). CellPay Fraud, Oct 3 2026. Lead-approved; ships AFTER 23:00 CT in its own slot gap.
-- Database-only. No front-end publish needed for this migration. Touches only public.page_visitors (publication membership + replica identity),
-- one NEW archive table, one NEW function, the pg_cron extension and two cron jobs. Does NOT touch record_presence, page_visitors grants/RLS/policies,
-- transaction_logs, checkout, proxy or any payment object.
-- Facts (catalog only, 19:38 CT, HEAD 30c86bc2): page_visitors(session_id text PK, path, user_agent, last_seen timestamptz, created_at timestamptz),
--   reltuples 896,018, 965 MB total (heap 302 MB, idx last_seen 380 MB, idx path 216 MB, pkey 66 MB); 9.44M updates (2,274 HOT) from record_presence
--   every 20 s per open tab; in supabase_realtime; REPLICA IDENTITY FULL; nothing in the app subscribes to it (only transaction_logs has a postgres_changes
--   channel: AdminDashboard.tsx:162-184 and the live bundle). Data starts 2026-05-04. Planner: ~260k rows have last_seen older than 90 days.
-- Retention column = last_seen (activity time, indexed by idx_page_visitors_last_seen). NOT created_at: session_id lives in localStorage, so a
--   returning visitor keeps an old created_at while still active; created_at is also unindexed.
-- Supporting index for the admin live/period queries and for pruning = existing idx_page_visitors_last_seen (btree last_seen DESC). No new index,
--   so no CREATE INDEX CONCURRENTLY is needed (it cannot run inside a migration transaction anyway).
BEGIN;
SET LOCAL lock_timeout = '5s';          -- ALTER PUBLICATION / REPLICA IDENTITY need a brief table lock; fail fast instead of queueing record_presence calls
SET LOCAL statement_timeout = '120s';

-- (a) take page_visitors out of the realtime live-updates feed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'page_visitors') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.page_visitors;
  END IF;
END $$;
-- FULL was only useful for the realtime feed; DEFAULT (primary key) stops logging the whole old row on every 20 s heartbeat update.
ALTER TABLE public.page_visitors REPLICA IDENTITY DEFAULT;

-- (c) backup table for rows removed by the one-time 90-day prune (service role only)
CREATE TABLE IF NOT EXISTS public.page_visitors_archive_20261003 (
  session_id  text NOT NULL,
  path        text NOT NULL,
  user_agent  text,
  last_seen   timestamptz NOT NULL,
  created_at  timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.page_visitors_archive_20261003 ENABLE ROW LEVEL SECURITY;   -- no policies
REVOKE ALL ON TABLE public.page_visitors_archive_20261003 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.page_visitors_archive_20261003 TO service_role;
COMMENT ON TABLE public.page_visitors_archive_20261003 IS 'AD-1 (Oct 3 2026): page_visitors rows with last_seen older than 90 days, moved here by the one-time backfill prune (ad1-backfill-prune). Service role only. Restore: fraud/deploys/ad-1/sql/ad1_revert.sql. Drop after 30 days if unused.';

-- Prune function: one small batch per call (one transaction per cron run). Archive mode moves rows atomically (DELETE ... RETURNING -> INSERT),
-- so a row is never deleted without its backup. Plain mode (nightly) deletes only; it does nothing while the backfill job still exists.
CREATE OR REPLACE FUNCTION public.ad1_prune_page_visitors(_days integer DEFAULT 90, _batch integer DEFAULT 5000, _archive boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '30s'
SET lock_timeout = '2s'
AS $$
DECLARE
  n integer := 0;
  cutoff timestamptz;
BEGIN
  IF _days IS NULL OR _days < 90 THEN
    RAISE EXCEPTION 'AD-1: retention must be at least 90 days (got %)', _days;
  END IF;
  _batch := LEAST(GREATEST(coalesce(_batch, 5000), 1), 20000);
  cutoff := now() - make_interval(days => _days);
  IF NOT _archive AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ad1-backfill-prune') THEN
    RETURN 0;   -- the archived backfill owns the backlog until it unschedules itself
  END IF;
  IF _archive THEN
    WITH v AS (
      SELECT session_id FROM public.page_visitors
      WHERE last_seen < cutoff ORDER BY last_seen LIMIT _batch FOR UPDATE SKIP LOCKED),
    d AS (
      DELETE FROM public.page_visitors p USING v
      WHERE p.session_id = v.session_id AND p.last_seen < cutoff
      RETURNING p.session_id, p.path, p.user_agent, p.last_seen, p.created_at)
    INSERT INTO public.page_visitors_archive_20261003 (session_id, path, user_agent, last_seen, created_at)
    SELECT session_id, path, user_agent, last_seen, created_at FROM d;
  ELSE
    WITH v AS (
      SELECT session_id FROM public.page_visitors
      WHERE last_seen < cutoff ORDER BY last_seen LIMIT _batch FOR UPDATE SKIP LOCKED)
    DELETE FROM public.page_visitors p USING v
    WHERE p.session_id = v.session_id AND p.last_seen < cutoff;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.ad1_prune_page_visitors(integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad1_prune_page_visitors(integer, integer, boolean) TO service_role;
COMMENT ON FUNCTION public.ad1_prune_page_visitors(integer, integer, boolean) IS 'AD-1: deletes up to _batch page_visitors rows with last_seen older than _days (min 90); _archive=true copies them to page_visitors_archive_20261003 in the same statement. Called by pg_cron jobs ad1-backfill-prune and ad1-nightly-prune.';

-- pg_cron (available 1.6.4, not installed before AD-1). Times are UTC: 08:xx UTC = 03:xx CDT (02:xx CST after Nov 1).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
-- One-time backfill: 5,000 archived rows per minute between 04:00 and 11:59 UTC (23:00-06:59 CDT); unschedules itself the first time a batch finds nothing.
-- ~260k rows -> about 52 runs (~1 h).
SELECT cron.schedule('ad1-backfill-prune', '* 4-11 * * *',
  $c$SELECT CASE WHEN public.ad1_prune_page_visitors(90, 5000, true) = 0 THEN cron.unschedule('ad1-backfill-prune') END$c$);
-- Nightly retention: up to 12 x 5,000 rows, 03:00-03:55 CDT, delete only (no-op while the backfill job exists).
SELECT cron.schedule('ad1-nightly-prune', '*/5 8 * * *',
  $c$SELECT public.ad1_prune_page_visitors(90, 5000, false)$c$);
-- page_views (PV-1) is NOT included: PV-1 is not live (public.page_views does not exist at 30c86bc2). Its 90-day purge (LP-2b) gets its own job when PV-1 ships.

-- Self-check: abort everything if any of this is not true.
DO $$
DECLARE r text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'page_visitors') THEN
    RAISE EXCEPTION 'page_visitors is still in supabase_realtime'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transaction_logs') THEN
    RAISE EXCEPTION 'transaction_logs fell out of supabase_realtime (admin live feed would break)'; END IF;
  IF (SELECT relreplident FROM pg_class WHERE oid = 'public.page_visitors'::regclass) <> 'd' THEN
    RAISE EXCEPTION 'page_visitors replica identity is not DEFAULT'; END IF;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(r, 'public.page_visitors_archive_20261003', 'SELECT') OR has_table_privilege(r, 'public.page_visitors_archive_20261003', 'INSERT')
       OR has_table_privilege(r, 'public.page_visitors_archive_20261003', 'UPDATE') OR has_table_privilege(r, 'public.page_visitors_archive_20261003', 'DELETE') THEN
      RAISE EXCEPTION '% has privileges on the archive table', r; END IF;
    IF has_function_privilege(r, 'public.ad1_prune_page_visitors(integer,integer,boolean)', 'EXECUTE') THEN
      RAISE EXCEPTION '% can execute ad1_prune_page_visitors', r; END IF;
    -- visitor tracking + admin reads must be untouched
    IF NOT has_function_privilege(r, 'public.record_presence(text,text,text)', 'EXECUTE') THEN
      RAISE EXCEPTION '% lost EXECUTE on record_presence (visitor tracking would stop)', r; END IF;
    IF NOT has_table_privilege(r, 'public.page_visitors', 'SELECT') THEN
      RAISE EXCEPTION '% lost SELECT on page_visitors (admin dashboard would break)', r; END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.page_visitors_archive_20261003'::regclass) THEN
    RAISE EXCEPTION 'RLS is off on the archive table'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'page_visitors_archive_20261003') THEN
    RAISE EXCEPTION 'unexpected policy on the archive table'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'page_visitors' AND policyname = 'Admins can view presence') THEN
    RAISE EXCEPTION 'admin presence policy missing'; END IF;
  IF (SELECT count(*) FROM cron.job WHERE jobname IN ('ad1-backfill-prune', 'ad1-nightly-prune') AND active) <> 2 THEN
    RAISE EXCEPTION 'AD-1 cron jobs not scheduled'; END IF;
END $$;

COMMIT;