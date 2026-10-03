-- AP-1.1: Auto Pay cancel guard + retry queue (service role only). New objects only; touches no existing table, grant or function.
-- 1) Rate-limit buckets. Bucket keys are HMAC-SHA256 hex ("ap1:ip:<hex>", "ap1:ph:<hex>"): no phone or IP stored.
create table if not exists public.ap1_rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.ap1_rate_limits enable row level security;
-- No policies on purpose: only the service role (cellpay-proxy) reads or writes.
revoke all on table public.ap1_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.ap1_rate_limits to service_role;

-- Returns true when this hit is within the limit. Fixed window; prunes day-old buckets now and then.
create or replace function public.ap1_rate_limit_hit(_bucket text, _limit integer, _window_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  h integer;
begin
  insert into public.ap1_rate_limits as r (bucket, window_start, hits)
  values (_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case when r.window_start < now() - make_interval(secs => _window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => _window_seconds) then now() else r.window_start end
  returning hits into h;
  if random() < 0.02 then
    delete from public.ap1_rate_limits where window_start < now() - interval '1 day';
  end if;
  return h <= _limit;
end;
$$;

-- 2) Ownership: returns the id of the newest successful transaction_logs row for this phone whose checkout email
--    matches, or whose Order ID (hashid or transaction_id) ends with the given 4 characters; NULL otherwise.
--    Only a uuid leaves the DB (no phone, email or order data).
create or replace function public.ap1_owner_match(_phone text, _email text, _last4 text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select t.id
  from public.transaction_logs t
  where t.phone_number = _phone
    and t.status = 'success'
    and (
      (_email is not null and lower(btrim(t.email)) = lower(btrim(_email)))
      or (_last4 is not null and length(_last4) = 4
          and (right(lower(t.hashid), 4) = lower(_last4) or right(lower(t.transaction_id), 4) = lower(_last4)))
    )
  order by t.created_at desc
  limit 1;
$$;

-- 3) Matched cancels whose CellPay call failed: never lost. A reference to the matched transaction_logs row
--    (which already holds the phone) plus the failure kind and HTTP status. No phone, email, token or upstream body.
--    Plain reference, no foreign key, so transaction_logs gets no new trigger or lock.
create table if not exists public.autopay_cancel_retry (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  transaction_log_id uuid not null,
  cellpay_domain text not null check (cellpay_domain in ('cellpay.us', 'www.cellpay.us', 'refill.cellpay.us')),
  failure_kind text not null check (failure_kind in ('http_5xx', 'timeout', 'network', 'non_json', 'error_body')),
  upstream_status integer check (upstream_status between 100 and 599),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  status text not null default 'needs_attention' check (status in ('needs_attention', 'retried', 'done')),
  last_attempt_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- At most one open row per matched order; a repeat failure bumps it instead of adding rows.
create unique index if not exists autopay_cancel_retry_open_uidx
  on public.autopay_cancel_retry (transaction_log_id) where status in ('needs_attention', 'retried');
create index if not exists autopay_cancel_retry_status_idx on public.autopay_cancel_retry (status, created_at desc);
alter table public.autopay_cancel_retry enable row level security;
-- No policies on purpose: only the service role (cellpay-proxy, and our own retry script) reads or writes.
revoke all on table public.autopay_cancel_retry from anon, authenticated;
grant select, insert, update on table public.autopay_cancel_retry to service_role;

-- Records one failure. Returns the row id, or NULL if the referenced log row doesn't exist.
create or replace function public.ap1_retry_record(_log_id uuid, _kind text, _status integer, _domain text)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  rid bigint;
begin
  if not exists (select 1 from public.transaction_logs where id = _log_id) then
    return null;
  end if;
  insert into public.autopay_cancel_retry as r (transaction_log_id, cellpay_domain, failure_kind, upstream_status)
  values (_log_id, _domain, _kind, _status)
  on conflict (transaction_log_id) where status in ('needs_attention', 'retried') do update set
    attempt_count = r.attempt_count + 1,
    failure_kind = excluded.failure_kind,
    upstream_status = excluded.upstream_status,
    cellpay_domain = excluded.cellpay_domain,
    status = 'needs_attention',
    last_attempt_at = now()
  returning id into rid;
  return rid;
end;
$$;

revoke all on function public.ap1_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.ap1_owner_match(text, text, text) from public, anon, authenticated;
revoke all on function public.ap1_retry_record(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.ap1_rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.ap1_owner_match(text, text, text) to service_role;
grant execute on function public.ap1_retry_record(uuid, text, integer, text) to service_role;

comment on table public.ap1_rate_limits is 'AP-1 Auto Pay cancel rate limits (cellpay-proxy). HMAC bucket keys only; no phone, email or IP.';
comment on table public.autopay_cancel_retry is 'AP-1: matched Auto Pay cancels whose CellPay call failed. Reference to transaction_logs only; no phone, email or upstream body.';