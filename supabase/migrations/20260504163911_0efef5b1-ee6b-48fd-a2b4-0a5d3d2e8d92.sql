GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT INSERT, UPDATE ON public.page_visitors TO anon, authenticated;
GRANT SELECT ON public.page_visitors TO authenticated;

GRANT INSERT, UPDATE ON public.transaction_logs TO anon, authenticated;
GRANT SELECT ON public.transaction_logs TO authenticated;