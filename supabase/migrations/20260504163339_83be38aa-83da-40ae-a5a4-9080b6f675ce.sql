CREATE TABLE IF NOT EXISTS public.page_visitors (
  session_id text PRIMARY KEY,
  path text NOT NULL DEFAULT '/',
  user_agent text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_visitors_last_seen ON public.page_visitors (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_page_visitors_path ON public.page_visitors (path);

ALTER TABLE public.page_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record presence"
  ON public.page_visitors FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update their own presence"
  ON public.page_visitors FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view presence"
  ON public.page_visitors FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role)
  );

ALTER TABLE public.page_visitors REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_visitors;