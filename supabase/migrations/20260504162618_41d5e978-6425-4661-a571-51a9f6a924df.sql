DROP POLICY IF EXISTS "Anyone can insert transaction logs" ON public.transaction_logs;

CREATE POLICY "Checkout can create pending transaction logs"
  ON public.transaction_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND raw_response IS NULL
    AND error_message IS NULL
    AND transaction_id IS NULL
  );