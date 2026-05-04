
DROP POLICY IF EXISTS "Anyone can update transaction logs by id" ON public.transaction_logs;

CREATE POLICY "Anyone can finalize pending transaction logs"
  ON public.transaction_logs FOR UPDATE
  TO anon, authenticated
  USING (status = 'pending')
  WITH CHECK (status IN ('pending','success','failed'));

CREATE POLICY "Admins can update any transaction log"
  ON public.transaction_logs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
