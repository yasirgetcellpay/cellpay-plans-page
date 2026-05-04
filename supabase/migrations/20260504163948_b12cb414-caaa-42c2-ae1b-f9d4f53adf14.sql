DROP POLICY IF EXISTS "Anyone can record presence" ON public.page_visitors;
DROP POLICY IF EXISTS "Anyone can update their own presence" ON public.page_visitors;

CREATE POLICY "Anyone can record valid presence"
ON public.page_visitors
FOR INSERT
TO anon, authenticated
WITH CHECK (
  session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND path LIKE '/%'
  AND length(path) <= 2048
  AND (user_agent IS NULL OR length(user_agent) <= 1000)
  AND last_seen >= (now() - interval '1 day')
  AND last_seen <= (now() + interval '5 minutes')
);

CREATE POLICY "Anyone can refresh valid presence"
ON public.page_visitors
FOR UPDATE
TO anon, authenticated
USING (
  session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
WITH CHECK (
  session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND path LIKE '/%'
  AND length(path) <= 2048
  AND (user_agent IS NULL OR length(user_agent) <= 1000)
  AND last_seen >= (now() - interval '1 day')
  AND last_seen <= (now() + interval '5 minutes')
);