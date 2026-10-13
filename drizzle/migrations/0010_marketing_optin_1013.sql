-- MARKETING-OPTIN-1013
alter table public.transaction_logs add column if not exists marketing_opt_in boolean null, add column if not exists marketing_opt_in_at timestamptz null;
create or replace function public.record_marketing_opt_in(p_hashid text, p_opt_in boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_hashid is null or p_hashid !~ '^[A-Za-z0-9_-]{4,64}$' or p_opt_in is null then return; end if;
  update public.transaction_logs set marketing_opt_in = p_opt_in, marketing_opt_in_at = now()
   where hashid = p_hashid and created_at > now() - interval '6 hours' and marketing_opt_in is null;
end $$;
revoke all on function public.record_marketing_opt_in(text, boolean) from public;
grant execute on function public.record_marketing_opt_in(text, boolean) to anon, authenticated;