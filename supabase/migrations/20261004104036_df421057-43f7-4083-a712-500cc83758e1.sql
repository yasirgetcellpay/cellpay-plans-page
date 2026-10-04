-- lovable-cron-fallback-reviewed: operator requires alarms within minutes; queue rows are written by an edge function with no DB webhook hook, so a 2-min reconciliation sweep is the specified design.
-- AP1A-1: AP-1 Auto Pay cancel alarms. SQL only, NEW objects only: no change to autopay_cancel_retry, proxy_guard_events,
-- transaction_logs, the cellpay-proxy edge function or the front end. No PII is stored or sent (ids, kinds, HTTP status, host).
-- Needs pg_cron (1.6.4 live), pg_net (0.20.0, functions in schema net) and supabase_vault (0.3.1): all live since AD-1 / Fix B M3.
-- Push channel: OPTIONAL Vault secret 'ops_alarm_webhook_url' (set by a human in the Supabase SQL editor, never in a message or repo).
-- Without it, alarms are still written to public.ops_alarms (pull only).

-- 1. Alarm log (one row per alarm; unique per source/kind/ref so a sweep never repeats an alarm).
create table if not exists public.ops_alarms (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null,
  kind text not null,
  ref text not null,
  severity text not null default 'alarm' check (severity in ('alarm', 'info')),
  detail jsonb not null default '{}'::jsonb,
  notify_request_id bigint,
  notified_at timestamptz,
  notify_note text,
  acked_at timestamptz,
  acked_by text,
  unique (source, kind, ref)
);
create index if not exists ops_alarms_open_idx on public.ops_alarms (created_at desc) where acked_at is null;
alter table public.ops_alarms enable row level security;
-- No policies on purpose: only service_role (and the cron job, which runs as the owner) reads or writes.
revoke all on table public.ops_alarms from public, anon, authenticated;
grant select, insert, update on table public.ops_alarms to service_role;
comment on table public.ops_alarms is 'Ops alarms (AP1A). PII-free: ids, kinds, HTTP status, host. Ack: set acked_at/acked_by.';

-- 2. Raise one alarm (idempotent) and push it to the webhook if one is configured. Never raises: a notify failure is recorded.
create or replace function public.ops_alarm_raise(_source text, _kind text, _ref text, _severity text, _text text, _detail jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  aid bigint;
  url text;
  rid bigint;
begin
  insert into public.ops_alarms (source, kind, ref, severity, detail)
  values (_source, _kind, _ref, _severity, coalesce(_detail, '{}'::jsonb) || jsonb_build_object('text', _text))
  on conflict (source, kind, ref) do nothing
  returning id into aid;
  if aid is null or _severity <> 'alarm' then
    return aid;
  end if;
  begin
    select decrypted_secret into url from vault.decrypted_secrets where name = 'ops_alarm_webhook_url' limit 1;
    if url is null or btrim(url) = '' then
      update public.ops_alarms set notify_note = 'no webhook configured (pull only)' where id = aid;
    else
      -- {"text": ...} works for Slack / Teams / Google Chat incoming webhooks and Telegram sendMessage (chat_id in the URL);
      -- "content" is Discord's field. pg_net is async: this only queues the request.
      select net.http_post(
        url := url,
        body := jsonb_build_object('text', _text, 'content', _text),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
      ) into rid;
      update public.ops_alarms set notify_request_id = rid, notified_at = now(), notify_note = 'queued via pg_net' where id = aid;
    end if;
  exception when others then
    update public.ops_alarms set notify_note = left('notify failed: ' || sqlerrm, 200) where id = aid;
  end;
  return aid;
end;
$$;
revoke all on function public.ops_alarm_raise(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ops_alarm_raise(text, text, text, text, text, jsonb) to service_role;

-- 3. Separate, correct "was the queue row written?" flag per AP-1 upstream call (the proxy's ap1:retry_write_error event can be a
--    false alarm: its 400 ms RPC budget can expire after the row is committed, as on Oct 3 15:49:49 CT). Bounded: last 7 days.
create or replace view public.ap1_cancel_outcomes
with (security_invoker = true)
as
select e.id as event_id,
       e.created_at,
       e.code,
       e.origin_host,
       (select q.id from public.autopay_cancel_retry q
         where q.created_at <= e.created_at + interval '10 seconds'
           and q.last_attempt_at >= e.created_at - interval '5 seconds'
         order by q.id limit 1) as queue_row_id,
       e.code = 'ap1:sent_ok' as confirmed_by_cellpay
from public.proxy_guard_events e
where e.created_at >= now() - interval '7 days'
  and e.code like 'ap1:sent\_%';
revoke all on public.ap1_cancel_outcomes from public, anon, authenticated;
grant select on public.ap1_cancel_outcomes to service_role;

-- 4. The sweep (pg_cron every 2 min). Reads only the open queue rows and the last 6 h of ap1 events (created_at-bounded).
create or replace function public.ap1_alarm_sweep()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  n integer := 0;
  first_at timestamptz;
  k integer;
  txt text;
  has_row boolean;
  write_err boolean;
begin
  -- A. Every open queue row alarms at once (there is no automatic retry, so every row needs a person).
  --    error_body = CellPay answered and refused (data.status false / 4xx): NOT retryable as-is.
  for r in
    select id, created_at, failure_kind, upstream_status, attempt_count, cellpay_domain
    from public.autopay_cancel_retry
    where status in ('needs_attention', 'retried')
    order by id
  loop
    if r.failure_kind = 'error_body' then
      txt := format('CellPay AP-1 ALARM [cancel_rejected]: CellPay REFUSED a customer''s Auto Pay cancel (retry id %s, HTTP %s with status false, attempt %s, host %s, queued %s CT). Not retryable as-is; the customer was shown the neutral reply. Work it: help-chat/deploy-ap1/RETRY.md. Ack: update public.ops_alarms set acked_at=now(), acked_by=''<name>'' where source=''ap1'' and ref like ''retry:%s:%%'';',
        r.id, coalesce(r.upstream_status::text, 'none'), r.attempt_count, r.cellpay_domain,
        to_char(r.created_at at time zone 'America/Chicago', 'Mon DD HH24:MI'), r.id);
      if public.ops_alarm_raise('ap1', 'cancel_rejected', format('retry:%s:a%s', r.id, r.attempt_count), 'alarm', txt,
           jsonb_build_object('retry_id', r.id, 'failure_kind', r.failure_kind, 'upstream_status', r.upstream_status,
                              'attempt', r.attempt_count, 'host', r.cellpay_domain)) is not null then n := n + 1; end if;
    else
      txt := format('CellPay AP-1 ALARM [cancel_failed]: a customer''s Auto Pay cancel did not reach CellPay (retry id %s, %s %s, attempt %s, host %s, queued %s CT). Replay per help-chat/deploy-ap1/RETRY.md §2. Ack: update public.ops_alarms set acked_at=now(), acked_by=''<name>'' where source=''ap1'' and ref like ''retry:%s:%%'';',
        r.id, r.failure_kind, coalesce(r.upstream_status::text, ''), r.attempt_count, r.cellpay_domain,
        to_char(r.created_at at time zone 'America/Chicago', 'Mon DD HH24:MI'), r.id);
      if public.ops_alarm_raise('ap1', 'cancel_failed', format('retry:%s:a%s', r.id, r.attempt_count), 'alarm', txt,
           jsonb_build_object('retry_id', r.id, 'failure_kind', r.failure_kind, 'upstream_status', r.upstream_status,
                              'attempt', r.attempt_count, 'host', r.cellpay_domain)) is not null then n := n + 1; end if;
    end if;

    -- B. Still unconfirmed and nobody acked: reminder 15 min after the first alarm, then once per day.
    select min(a.created_at) into first_at from public.ops_alarms a
      where a.source = 'ap1' and a.ref like format('retry:%s:%%', r.id) and a.kind in ('cancel_rejected', 'cancel_failed');
    if first_at is not null and now() - first_at >= interval '15 minutes'
       and not exists (select 1 from public.ops_alarms a where a.source = 'ap1' and a.ref like format('retry:%s:%%', r.id) and a.acked_at is not null) then
      k := floor(extract(epoch from now() - first_at) / 86400)::integer;
      txt := format('CellPay AP-1 ALARM [cancel_unconfirmed]: Auto Pay cancel retry id %s is STILL not confirmed (%s, queued %s CT, first alarm %s CT, nobody acked). Work it: help-chat/deploy-ap1/RETRY.md. Ack: update public.ops_alarms set acked_at=now(), acked_by=''<name>'' where source=''ap1'' and ref like ''retry:%s:%%'';',
        r.id, r.failure_kind, to_char(r.created_at at time zone 'America/Chicago', 'Mon DD HH24:MI'),
        to_char(first_at at time zone 'America/Chicago', 'Mon DD HH24:MI'), r.id);
      if public.ops_alarm_raise('ap1', 'cancel_unconfirmed', format('retry:%s:r%s', r.id, k), 'alarm', txt,
           jsonb_build_object('retry_id', r.id, 'reminder', k)) is not null then n := n + 1; end if;
    end if;
  end loop;

  -- C. Every failed upstream call must have a queue row. Classify each ap1:sent_fail:* event (last 6 h, settled > 30 s):
  --    row present -> fine (and a retry_write_error next to it is recorded as an info "false alarm");
  --    row missing -> alarm cancel_lost (the proxy said it could not write) or cancel_unqueued (no write event at all).
  for r in
    select e.id, e.created_at, e.origin_host
    from public.proxy_guard_events e
    where e.created_at >= now() - interval '6 hours'
      and e.created_at < now() - interval '30 seconds'
      and e.code like 'ap1:sent\_fail:%'
    order by e.id
  loop
    select exists (select 1 from public.autopay_cancel_retry q
                    where q.created_at <= r.created_at + interval '10 seconds'
                      and q.last_attempt_at >= r.created_at - interval '5 seconds') into has_row;
    select exists (select 1 from public.proxy_guard_events w
                    where w.created_at >= r.created_at and w.created_at < r.created_at + interval '5 seconds'
                      and w.code = 'ap1:retry_write_error') into write_err;
    if has_row and write_err then
      perform public.ops_alarm_raise('ap1', 'write_error_false_alarm', format('event:%s', r.id), 'info',
        'AP-1 info: ap1:retry_write_error was logged but the queue row exists (RPC budget expired after commit).',
        jsonb_build_object('event_id', r.id));
    elsif not has_row then
      txt := format('CellPay AP-1 ALARM [%s]: a matched Auto Pay cancel FAILED at CellPay and has NO retry row (event id %s, %s CT, host %s). Find transaction_log_id in the cellpay-proxy edge log line "[autopay AP-1] retry row NOT written" and recreate it per help-chat/deploy-ap1/RETRY.md §4.',
        case when write_err then 'cancel_lost' else 'cancel_unqueued' end, r.id,
        to_char(r.created_at at time zone 'America/Chicago', 'Mon DD HH24:MI:SS'), r.origin_host);
      if public.ops_alarm_raise('ap1', case when write_err then 'cancel_lost' else 'cancel_unqueued' end,
           format('event:%s', r.id), 'alarm', txt, jsonb_build_object('event_id', r.id, 'host', r.origin_host)) is not null then n := n + 1; end if;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.ap1_alarm_sweep() from public, anon, authenticated;
grant execute on function public.ap1_alarm_sweep() to service_role;

-- 5. Schedule (idempotent). Kill switch: select cron.unschedule(jobid) from cron.job where jobname = 'ap1-alarm-sweep';
select cron.unschedule(jobid) from cron.job where jobname = 'ap1-alarm-sweep';
select cron.schedule('ap1-alarm-sweep', '*/2 * * * *', $cmd$select public.ap1_alarm_sweep()$cmd$);