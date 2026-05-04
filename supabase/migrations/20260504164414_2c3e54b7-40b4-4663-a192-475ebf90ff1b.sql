DROP POLICY IF EXISTS "Anyone can record valid presence" ON public.page_visitors;
DROP POLICY IF EXISTS "Anyone can refresh valid presence" ON public.page_visitors;

CREATE POLICY "Visitors can record presence"
ON public.page_visitors
FOR INSERT
TO anon, authenticated
WITH CHECK (length(session_id) BETWEEN 8 AND 100);

CREATE POLICY "Visitors can refresh presence"
ON public.page_visitors
FOR UPDATE
TO anon, authenticated
USING (length(session_id) BETWEEN 8 AND 100)
WITH CHECK (length(session_id) BETWEEN 8 AND 100);