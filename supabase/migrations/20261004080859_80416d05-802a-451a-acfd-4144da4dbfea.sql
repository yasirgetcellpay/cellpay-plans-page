-- Fix B v2 (Sunday cut, "v2c" = CONCURRENTLY rework, Lead 19:51 CT), M1b: B-1 tables/functions. PREPARED, NOT SENT.
-- Changes vs v2s: (1) the three transaction_logs indexes are NOT built here: they are built beforehand, one per migration, with
-- CREATE INDEX CONCURRENTLY (M1a-1..3, see RUNBOOK §4) and this migration REFUSES to run unless all three exist and are valid
-- (pg_index.indisvalid AND indisready); replay guard for small tables only, see the DO block. (2) pockyt_settlement_checks.log_id has NO foreign key to transaction_logs: adding an FK
-- takes a SHARE ROW EXCLUSIVE lock on transaction_logs (blocks checkout inserts). Nothing in this migration locks transaction_logs.
-- (3) every transaction_logs read in the sweep functions is index-driven AND bounded on created_at (txn-reuse 30 d, promotion 48 h,
-- settled-elsewhere 49 h, expire 48 h..7 d); enqueue is one static INSERT per mode; Fix B's own tables are pruned to 30 days.
-- EXPLAIN evidence: test/sweep_plans.out.txt.
-- New objects only. finalize_transaction_log, log_transaction_attempt, their grants and transaction_logs columns are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';          -- fail fast instead of queueing; nothing here locks transaction_logs
SET LOCAL statement_timeout = '60s';      -- no table scans in here; new empty tables only

-- Refuse to run on production unless M1a built all three indexes CONCURRENTLY and they are valid (an aborted CONCURRENTLY
-- build leaves an INVALID index). Replay guard: on a SMALL transaction_logs (< 50 MB heap: a fresh project, a branch or a
-- remix replaying migrations) the indexes are created here so the migration history stays complete. Production's heap is
-- ~180+ MB, so production always takes the assert path and never runs a plain CREATE INDEX on transaction_logs.
DO $$
DECLARE n integer; small boolean := pg_relation_size('public.transaction_logs') < 50 * 1024 * 1024;
BEGIN
  IF small THEN
    CREATE INDEX IF NOT EXISTS idx_tx_logs_pockyt_session ON public.transaction_logs ((raw_response #>> '{data,pockyt_session_id}')) WHERE payment_method = 'pockyt';
    CREATE INDEX IF NOT EXISTS idx_tx_logs_pockyt_open ON public.transaction_logs (created_at) WHERE payment_method = 'pockyt' AND status IN ('pending', 'success') AND transaction_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_tx_logs_pockyt_txn ON public.transaction_logs (transaction_id) WHERE payment_method = 'pockyt' AND transaction_id IS NOT NULL;
  END IF;
  SELECT count(*) INTO n FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
   WHERE i.indrelid = 'public.transaction_logs'::regclass AND i.indisvalid AND i.indisready
     AND c.relname IN ('idx_tx_logs_pockyt_session', 'idx_tx_logs_pockyt_open', 'idx_tx_logs_pockyt_txn');
  IF n <> 3 THEN
    RAISE EXCEPTION 'Fix B M1b: % of 3 transaction_logs indexes valid; run M1a-1..3 and sql/m1a_check_indexes.sql first', n;
  END IF;
END $$;

-- Mode rows. Every reader treats a missing row or a failed read as its SAFE value (sweep: off).
CREATE TABLE IF NOT EXISTS public.fraud_controls (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fraud_controls_valid CHECK (
       (key = 'cashapp_sweep_mode'  AND value IN ('off', 'shadow', 'enforce'))
    OR (key = 'cashapp_repeat_mode' AND value IN ('off', 'shadow', 'on'))
    OR (key = 'plaid_exchange_mode' AND value IN ('off', 'on')))
);
INSERT INTO public.fraud_controls (key, value) VALUES ('cashapp_sweep_mode', 'shadow') ON CONFLICT (key) DO NOTHING;

-- One row per Cash App log the sweep looks at. mode: shadow = record only, never touch transaction_logs; enforce = settle.
CREATE TABLE IF NOT EXISTS public.pockyt_settlement_checks (
  log_id             uuid PRIMARY KEY,                    -- no FK on purpose (an FK would lock transaction_logs)
  session_id         text NOT NULL,
  caller_host        text,
  log_created_at     timestamptz NOT NULL,
  mode               text NOT NULL CHECK (mode IN ('shadow', 'enforce')),
  check_count        integer NOT NULL DEFAULT 0,
  ok_check_count     integer NOT NULL DEFAULT 0,          -- HTTP 200 with a readable status
  first_checked_at   timestamptz,
  last_checked_at    timestamptz,
  last_ok_checked_at timestamptz,
  next_check_at      timestamptz NOT NULL DEFAULT now(),  -- also the lease: claim pushes it +5 min
  last_http          integer,
  last_upstream      text,                                -- internal_status||status as CellPay sent it (<=40 chars)
  last_error         text,
  outcome            text CHECK (outcome IN ('paid', 'failed', 'expired_unconfirmed', 'settled_elsewhere')),
  outcome_at         timestamptz,
  applied            boolean NOT NULL DEFAULT false       -- true = this sweep changed transaction_logs
);
CREATE INDEX IF NOT EXISTS idx_pockyt_checks_due ON public.pockyt_settlement_checks (next_check_at) WHERE outcome IS NULL;
CREATE INDEX IF NOT EXISTS idx_pockyt_checks_log_created ON public.pockyt_settlement_checks (log_created_at);   -- v2c: bounded reads + 30 d prune

CREATE TABLE IF NOT EXISTS public.pockyt_sweep_runs (
  id           bigserial PRIMARY KEY,
  started_at   timestamptz NOT NULL,
  finished_at  timestamptz NOT NULL DEFAULT now(),
  mode         text NOT NULL,
  claimed      integer NOT NULL DEFAULT 0,
  paid         integer NOT NULL DEFAULT 0,
  failed       integer NOT NULL DEFAULT 0,
  still_pending integer NOT NULL DEFAULT 0,
  http_errors  integer NOT NULL DEFAULT 0,
  auth_errors  integer NOT NULL DEFAULT 0,
  expired      integer NOT NULL DEFAULT 0,
  note         text
);
CREATE INDEX IF NOT EXISTS idx_pockyt_sweep_runs_finished ON public.pockyt_sweep_runs (finished_at);
ALTER TABLE public.fraud_controls ENABLE ROW LEVEL SECURITY;            -- no policies: service_role only
ALTER TABLE public.pockyt_settlement_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockyt_sweep_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fraud_controls, public.pockyt_settlement_checks, public.pockyt_sweep_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.pockyt_sweep_runs_id_seq FROM PUBLIC, anon, authenticated;

-- Read one mode row (NULL if absent). Callers map NULL / errors to their safe value.
CREATE OR REPLACE FUNCTION public.fraud_control_get(_key text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM public.fraud_controls WHERE key = _key;
$$;

-- Settle one Cash App row from CellPay's status answer for ITS session. Callers: the proxy status branch (session id
-- from the endpoint path; browser pending_log_id only as an ownership check) and pockyt_sweep_record (own log id).
CREATE OR REPLACE FUNCTION public.finalize_pockyt_log(
  _session_id text, _pending_log_id uuid, _status text, _txn text, _msg text, _raw jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF _status NOT IN ('success','failed') OR coalesce(btrim(_session_id),'') = '' THEN RETURN false; END IF;
  IF _status = 'success' AND coalesce(btrim(_txn),'') = '' THEN RETURN false; END IF;          -- paid needs a txn id
  SELECT id INTO rid FROM public.transaction_logs
   WHERE payment_method = 'pockyt'
     AND raw_response #>> '{data,pockyt_session_id}' = _session_id
     AND status = 'pending'
     AND created_at > now() - interval '48 hours'
     AND (_pending_log_id IS NULL OR id = _pending_log_id)       -- a given id must own this session
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;
  IF rid IS NULL THEN RETURN false; END IF;
  IF _status = 'success' AND EXISTS (SELECT 1 FROM public.transaction_logs o
                                      WHERE o.payment_method = 'pockyt' AND o.transaction_id = _txn
                                        AND o.transaction_id IS NOT NULL AND o.created_at > now() - interval '30 days'
                                        AND o.id <> rid) THEN RETURN false; END IF;  -- txn reuse (idx_tx_logs_pockyt_txn, 30 d)
  UPDATE public.transaction_logs
     SET status = _status,
         hashid = CASE WHEN _status = 'success' THEN _txn ELSE hashid END,
         transaction_id = CASE WHEN _status = 'success' THEN _txn ELSE transaction_id END,
         error_message = CASE WHEN _status = 'failed' THEN left(coalesce(_msg, 'Cash App payment not completed'), 300) ELSE NULL END,
         raw_response = coalesce(raw_response, '{}'::jsonb)
                        || jsonb_build_object('pockyt_settlement', coalesce(_raw, '{}'::jsonb), 'pockyt_settled_at', now())
   WHERE id = rid AND status = 'pending';
  RETURN FOUND;
END $$;

-- Claim up to _limit due rows (lease 5 min, SKIP LOCKED so overlapping runs never take the same row).
CREATE OR REPLACE FUNCTION public.pockyt_sweep_claim(_limit integer, _mode text)
RETURNS TABLE (log_id uuid, session_id text, caller_host text, log_created_at timestamptz, check_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim integer := least(greatest(coalesce(_limit, 25), 1), 100);
BEGIN
  IF _mode NOT IN ('shadow','enforce') THEN RAISE EXCEPTION 'pockyt_sweep_claim: bad mode'; END IF;
  IF _mode = 'enforce' THEN
    -- v2s: shadow rows whose log is still pending (created after B-2) become enforce rows and are checked again now
    UPDATE public.pockyt_settlement_checks k
       SET mode = 'enforce', outcome = NULL, outcome_at = NULL, applied = false, next_check_at = now()
      FROM public.transaction_logs t
     WHERE t.id = k.log_id AND k.mode = 'shadow' AND t.status = 'pending'
       AND t.payment_method = 'pockyt' AND t.created_at > now() - interval '48 hours'
       AND k.log_created_at > now() - interval '48 hours';
    -- rows already settled by the browser poll are closed without a call
    UPDATE public.pockyt_settlement_checks k
       SET outcome = 'settled_elsewhere', outcome_at = now()
      FROM public.transaction_logs t
     WHERE t.id = k.log_id AND k.mode = 'enforce' AND k.outcome IS NULL AND t.status <> 'pending'
       AND t.created_at > now() - interval '49 hours' AND k.log_created_at > now() - interval '49 hours';
  END IF;
  -- enqueue eligible rows: 2 min to 48 h old, with a session id (idx_tx_logs_pockyt_open, bounded on created_at)
  -- v2c: one static statement per mode so the planner can always prove the partial-index predicate (no OR on _mode).
  IF _mode = 'enforce' THEN
    INSERT INTO public.pockyt_settlement_checks (log_id, session_id, caller_host, log_created_at, mode, next_check_at)
    SELECT t.id, t.raw_response #>> '{data,pockyt_session_id}', t.metadata ->> 'caller_host', t.created_at, 'enforce', now()
      FROM public.transaction_logs t
     WHERE t.payment_method = 'pockyt' AND t.status = 'pending' AND t.transaction_id IS NULL
       AND t.created_at < now() - interval '2 minutes' AND t.created_at > now() - interval '48 hours'
       AND coalesce(t.raw_response #>> '{data,pockyt_session_id}', '') <> ''
    ON CONFLICT ON CONSTRAINT pockyt_settlement_checks_pkey DO NOTHING;
  ELSE
    INSERT INTO public.pockyt_settlement_checks (log_id, session_id, caller_host, log_created_at, mode, next_check_at)
    SELECT t.id, t.raw_response #>> '{data,pockyt_session_id}', t.metadata ->> 'caller_host', t.created_at, 'shadow', now()
      FROM public.transaction_logs t
     WHERE t.payment_method = 'pockyt' AND t.status IN ('pending', 'success') AND t.transaction_id IS NULL  -- shadow: page-open "successes" too
       AND t.created_at < now() - interval '2 minutes' AND t.created_at > now() - interval '48 hours'
       AND coalesce(t.raw_response #>> '{data,pockyt_session_id}', '') <> ''
    ON CONFLICT ON CONSTRAINT pockyt_settlement_checks_pkey DO NOTHING;
  END IF;
  RETURN QUERY
  WITH due AS (
    SELECT k.log_id FROM public.pockyt_settlement_checks k
     WHERE k.outcome IS NULL AND k.mode = _mode
       AND k.next_check_at <= now()
       AND k.log_created_at > now() - interval '48 hours'
     ORDER BY k.next_check_at
     LIMIT lim
     FOR UPDATE SKIP LOCKED)
  UPDATE public.pockyt_settlement_checks k
     SET next_check_at = now() + interval '5 minutes'
    FROM due WHERE k.log_id = due.log_id
  RETURNING k.log_id, k.session_id, k.caller_host, k.log_created_at, k.check_count;
END $$;

-- Record one status answer. _verdict: paid | failed | pending (readable, not final) | error (timeout/5xx/unreadable) | auth (401/403).
-- Backoff: next check +3 min while the row is under 1 h old, then +15 min, until 48 h.
CREATE OR REPLACE FUNCTION public.pockyt_sweep_record(
  _log_id uuid, _session_id text, _http integer, _upstream text, _txn text, _msg text, _raw jsonb, _verdict text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.pockyt_settlement_checks%ROWTYPE; v text := _verdict; ok boolean; did boolean := false;
BEGIN
  IF v NOT IN ('paid','failed','pending','error','auth') THEN RAISE EXCEPTION 'pockyt_sweep_record: bad verdict'; END IF;
  SELECT * INTO k FROM public.pockyt_settlement_checks c WHERE c.log_id = _log_id AND c.session_id = _session_id FOR UPDATE;
  IF NOT FOUND OR k.outcome IS NOT NULL THEN RETURN 'noop'; END IF;
  IF v = 'paid' AND coalesce(btrim(_txn), '') = '' THEN v := 'pending'; END IF;          -- same rule as the proxy/frontend
  ok := v IN ('paid','failed','pending');
  IF k.mode = 'enforce' AND v IN ('paid','failed') THEN
    did := public.finalize_pockyt_log(_session_id, _log_id, CASE WHEN v = 'paid' THEN 'success' ELSE 'failed' END, _txn, _msg, _raw);
  END IF;
  UPDATE public.pockyt_settlement_checks c
     SET check_count = c.check_count + 1,
         ok_check_count = c.ok_check_count + CASE WHEN ok THEN 1 ELSE 0 END,
         first_checked_at = coalesce(c.first_checked_at, now()),
         last_checked_at = now(),
         last_ok_checked_at = CASE WHEN ok THEN now() ELSE c.last_ok_checked_at END,
         last_http = _http,
         last_upstream = left(_upstream, 40),
         last_error = CASE WHEN ok THEN NULL ELSE left(coalesce(_msg, v), 200) END,
         outcome = CASE WHEN v IN ('paid','failed') THEN v ELSE NULL END,
         outcome_at = CASE WHEN v IN ('paid','failed') THEN now() ELSE NULL END,
         applied = did,
         next_check_at = now() + CASE WHEN now() - c.log_created_at < interval '1 hour'
                                      THEN interval '3 minutes' ELSE interval '15 minutes' END
   WHERE c.log_id = _log_id;
  RETURN v || CASE WHEN did THEN ':applied' ELSE '' END;
END $$;

-- Enforce only. A Cash App row becomes failed only if it is past 48 h AND the sweep got a readable answer at least once
-- after the customer's session window (created_at + 30 min) AND no answer was ever final. Rows never readably checked
-- stay pending ("unverified") and show up in the watch. A paid answer that could not be applied (duplicate row for the
-- same session, txn already on the other row) is closed with its own message.
CREATE OR REPLACE FUNCTION public.pockyt_sweep_expire()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH x AS (
    UPDATE public.transaction_logs t
       SET status = 'failed',
           error_message = CASE WHEN k.outcome = 'paid'
                                THEN 'Duplicate Cash App row (payment recorded on another row for this session)'
                                ELSE 'Cash App not confirmed paid within 48 h (' || k.ok_check_count || ' server checks)' END
      FROM public.pockyt_settlement_checks k
     WHERE k.log_id = t.id AND k.mode = 'enforce'
       AND t.payment_method = 'pockyt' AND t.status = 'pending' AND t.transaction_id IS NULL
       AND t.created_at < now() - interval '48 hours' AND t.created_at > now() - interval '7 days'   -- idx_tx_logs_pockyt_open, bounded
       AND k.log_created_at < now() - interval '48 hours' AND k.log_created_at > now() - interval '7 days'
       AND k.last_ok_checked_at >= t.created_at + interval '30 minutes'
       AND (k.outcome IS NULL OR (k.outcome = 'paid' AND NOT k.applied))
    RETURNING t.id)
  UPDATE public.pockyt_settlement_checks k
     SET outcome = CASE WHEN k.outcome = 'paid' THEN k.outcome ELSE 'expired_unconfirmed' END,
         outcome_at = now(), applied = true
    FROM x WHERE k.log_id = x.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.pockyt_sweep_finish_run(
  _started_at timestamptz, _mode text, _claimed integer, _paid integer, _failed integer, _still_pending integer,
  _http_errors integer, _auth_errors integer, _expired integer, _note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.pockyt_sweep_runs (started_at, mode, claimed, paid, failed, still_pending, http_errors, auth_errors, expired, note)
  VALUES (_started_at, _mode, _claimed, _paid, _failed, _still_pending, _http_errors, _auth_errors, _expired, left(_note, 200));
  -- v2c: keep both Fix B tables small (30 days; index-bounded deletes on our own tables only, never transaction_logs)
  DELETE FROM public.pockyt_settlement_checks WHERE log_created_at < now() - interval '30 days' AND log_created_at > now() - interval '60 days';
  DELETE FROM public.pockyt_sweep_runs WHERE finished_at < now() - interval '30 days' AND finished_at > now() - interval '60 days';
$$;

-- The edge function proves the cron caller by comparing its x-sweep-secret header with a Vault secret, server-side.
-- The secret value never appears in code, logs or this file.
CREATE OR REPLACE FUNCTION public.pockyt_sweep_secret_ok(_s text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'cashapp_sweep_secret' LIMIT 1;
  RETURN v IS NOT NULL AND length(v) >= 32 AND _s IS NOT NULL AND _s = v;
END $$;

-- New public functions get EXECUTE for anon/authenticated by default on Supabase: revoke explicitly (Fix A rule).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.fraud_control_get(text)',
    'public.finalize_pockyt_log(text,uuid,text,text,text,jsonb)',
    'public.pockyt_sweep_claim(integer,text)',
    'public.pockyt_sweep_record(uuid,text,integer,text,text,text,jsonb,text)',
    'public.pockyt_sweep_expire()',
    'public.pockyt_sweep_finish_run(timestamptz,text,integer,integer,integer,integer,integer,integer,integer,text)',
    'public.pockyt_sweep_secret_ok(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'Fix B function reachable by anon/authenticated: %', f;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.pockyt_settlement_checks', 'SELECT')
     OR has_table_privilege('authenticated', 'public.pockyt_settlement_checks', 'SELECT')
     OR has_table_privilege('anon', 'public.pockyt_sweep_runs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.pockyt_sweep_runs', 'SELECT')
     OR has_table_privilege('anon', 'public.fraud_controls', 'SELECT')
     OR has_table_privilege('authenticated', 'public.fraud_controls', 'SELECT') THEN
    RAISE EXCEPTION 'Fix B tables readable by anon/authenticated';
  END IF;
END $$;
COMMIT;