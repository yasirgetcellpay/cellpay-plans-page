-- ULTRA-SMART-PREVENT-1024: new private state only; existing order data is never updated.
CREATE TABLE public.ultra_breaker_state (
 id smallint PRIMARY KEY DEFAULT 1,
 tier text NOT NULL DEFAULT 'off',
 measured_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 failures integer NOT NULL DEFAULT 0,
 pause_until timestamptz,
 probe_started timestamptz
);
GRANT ALL ON public.ultra_breaker_state TO service_role;
ALTER TABLE public.ultra_breaker_state ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.ultra_breaker_check(_mode text DEFAULT 'pause', _claim boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 s public.ultra_breaker_state%ROWTYPE;
 old_tier text;
 n integer; f integer; target text;
 probe_status text;
 t timestamptz := clock_timestamp();
BEGIN
 IF _mode NOT IN ('warn','pause') THEN RETURN jsonb_build_object('tier','off','allowed',true); END IF;
 PERFORM pg_advisory_xact_lock(1024, 8279);
 INSERT INTO public.ultra_breaker_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO s FROM public.ultra_breaker_state WHERE id=1 FOR UPDATE;
 old_tier := s.tier;
 IF s.probe_started IS NOT NULL THEN
   SELECT status INTO probe_status FROM public.transaction_logs
    WHERE carrier_slug='ultra-mobile' AND created_at>=s.probe_started
      AND status IN ('success','failed')
      AND coalesce(error_message,'') !~* 'blocked|duplicate|already being processed|retry cap|retry wait'
    ORDER BY created_at LIMIT 1;
   IF probe_status='success' THEN
     s.tier:='off'; s.pause_until:=NULL; s.probe_started:=NULL; s.measured_at:=t;
   ELSIF probe_status='failed' OR t>s.probe_started+interval '2 minutes' THEN
     s.tier:='pause'; s.pause_until:=t+interval '20 minutes'; s.probe_started:=NULL; s.measured_at:=t;
   END IF;
 END IF;
 IF s.measured_at IS NULL OR (t>=s.measured_at+interval '60 seconds' AND s.pause_until IS NULL AND s.probe_started IS NULL) THEN
   WITH eligible AS (
     SELECT created_at,status,coalesce(load_text,'') AS lt,coalesce(error_message,'') AS msg,coalesce(raw_response::text,'') AS raw,
       row_number() OVER (ORDER BY created_at DESC) AS rn
     FROM public.transaction_logs
     WHERE carrier_slug='ultra-mobile' AND status IN ('success','failed')
       AND coalesce(error_message,'') !~* 'blocked|duplicate|already being processed|retry cap|retry wait'
       AND coalesce(load_text,'') !~* 'subscriber not found|already refilled|refill was completed on this line recently'
       AND coalesce(raw_response::text,'') !~* 'subscriber not found|"(blocked|duplicate)"\s*:\s*true'
   )
   SELECT count(*)::integer,count(*) FILTER (WHERE status='failed' AND (
     lt ~* '1065|invalid amount|error during refill' OR msg ~* '1065|invalid amount|error during refill' OR raw ~* '1065|invalid amount|error during refill'
     OR (raw IN ('','{}','null') AND msg='')
     OR raw ~* '"(provider|provider_response)"\s*:\s*(null|""|\{\})'
   ))::integer INTO n,f FROM eligible WHERE created_at>=t-interval '60 minutes' OR rn<=10;
   s.attempts:=n; s.failures:=f; s.measured_at:=t;
   target := CASE WHEN _mode='pause' AND n>=6 AND f::numeric/nullif(n,0)>=0.70 THEN 'pause'
                  WHEN n>=5 AND f::numeric/nullif(n,0)>=0.40 THEN 'warn' ELSE 'off' END;
   s.tier:=target;
   IF target='pause' THEN s.pause_until:=t+interval '20 minutes'; END IF;
 END IF;
 IF _mode='warn' AND s.tier='pause' THEN s.tier:='warn'; s.pause_until:=NULL; s.probe_started:=NULL; END IF;
 IF _mode='pause' AND s.tier='pause' AND s.pause_until<=t AND s.probe_started IS NULL AND _claim THEN
   s.probe_started:=t;
 END IF;
 UPDATE public.ultra_breaker_state SET tier=s.tier, measured_at=s.measured_at, attempts=s.attempts, failures=s.failures,
   pause_until=s.pause_until, probe_started=s.probe_started WHERE id=1;
 IF old_tier IS DISTINCT FROM s.tier THEN
   BEGIN
     INSERT INTO public.proxy_guard_events(id,guard_version,code,method,endpoint_shape)
       VALUES(gen_random_uuid(),'ultra-smart-1024','ultra_breaker:'||old_tier||':'||s.tier,'POST','checkout/transaction');
   EXCEPTION WHEN OTHERS THEN NULL; END;
 END IF;
 RETURN jsonb_build_object('tier',s.tier,'attempts',s.attempts,'failure_rate',coalesce(s.failures::numeric/nullif(s.attempts,0),0),
   'retry_after',CASE WHEN s.pause_until>t THEN ceil(extract(epoch FROM s.pause_until-t))::integer ELSE 0 END,
   'probe_available',s.tier='pause' AND s.pause_until<=t AND s.probe_started IS NULL,
   'allowed',s.tier<>'pause' OR (_claim AND s.probe_started=t));
END;
$$;
REVOKE ALL ON FUNCTION public.ultra_breaker_check(text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ultra_breaker_check(text,boolean) TO service_role;