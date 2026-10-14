-- CONSENT-TERMS-1014
drop function if exists public.record_marketing_opt_in(text, boolean);
create or replace function public.record_marketing_opt_in(p_hashid text, p_opt_in boolean, p_lang text default null, p_browser_language text default null) returns void language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if p_hashid is null or p_hashid !~ '^[A-Za-z0-9_-]{4,64}$' or p_opt_in is null then return; end if;
  m := jsonb_build_object('marketing_consent', 'terms_v2026-10-14', 'marketing_consent_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if p_lang in ('en','es') then m := m || jsonb_build_object('lang', p_lang); end if;
  if p_browser_language is not null and left(p_browser_language, 35) ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$' then m := m || jsonb_build_object('browser_language', left(p_browser_language, 35)); end if;
  update public.transaction_logs
     set marketing_opt_in = true,
         marketing_opt_in_at = coalesce(marketing_opt_in_at, now()),
         metadata = coalesce(metadata, '{}'::jsonb) || m
   where hashid = p_hashid and created_at > now() - interval '6 hours';
end $$;
revoke all on function public.record_marketing_opt_in(text, boolean, text, text) from public;
grant execute on function public.record_marketing_opt_in(text, boolean, text, text) to anon, authenticated;