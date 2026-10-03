-- Deploy 1a.1: refusal counter for the cellpay-proxy guard (PII-free, service role only).
-- New table only. It does not touch log_transaction_attempt, finalize_transaction_log,
-- transaction_logs or any existing grant, so it cannot collide with CellPay Fraud's S2 migration.
create table if not exists public.proxy_guard_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  guard_version text not null,
  code text not null,
  method text,
  endpoint_shape text,
  origin_host text,
  has_origin boolean not null default false,
  dropped_before integer not null default 0
);

create index if not exists proxy_guard_events_created_at_idx
  on public.proxy_guard_events (created_at desc);

alter table public.proxy_guard_events enable row level security;
-- No policies on purpose: only the service role (the edge function) can read or write.
revoke all on table public.proxy_guard_events from anon, authenticated;
grant select, insert on table public.proxy_guard_events to service_role;

comment on table public.proxy_guard_events is
  'cellpay-proxy guard refusals (Deploy 1a/1b). No IPs, phones, emails, ids or payloads: endpoint_shape keeps literal words only.';