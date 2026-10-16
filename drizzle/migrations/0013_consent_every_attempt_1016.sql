-- CONSENT-EVERY-ATTEMPT-1016
create or replace function public.record_attempt_marketing_opt_in(_id uuid, _browser_language text default null) returns void language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if _id is null then return; end if;
  m := jsonb_build_object('marketing_consent', 'terms_v2026-10-14', 'marketing_consent_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'marketing_consent_src', 'attempt');
  if _browser_language is not null and left(_browser_language, 35) ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$' then m := m || jsonb_build_object('browser_language', left(_browser_language, 35)); end if;
  update public.transaction_logs
     set marketing_opt_in = true,
         marketing_opt_in_at = coalesce(marketing_opt_in_at, now()),
         metadata = coalesce(metadata, '{}'::jsonb) || m
   where id = _id and created_at > now() - interval '2 hours';
end $$;
revoke all on function public.record_attempt_marketing_opt_in(uuid, text) from public, anon, authenticated;
grant execute on function public.record_attempt_marketing_opt_in(uuid, text) to service_role;