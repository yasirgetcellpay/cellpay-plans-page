CREATE TABLE public.cellpay_raw_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  transaction_log_id uuid NULL,
  endpoint text,
  http_status int,
  payment_method text,
  body jsonb,
  raw_text text
);
REVOKE ALL ON public.cellpay_raw_replies FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cellpay_raw_replies TO service_role;
ALTER TABLE public.cellpay_raw_replies ENABLE ROW LEVEL SECURITY;
CREATE INDEX cellpay_raw_replies_transaction_log_id_idx ON public.cellpay_raw_replies (transaction_log_id);
CREATE INDEX cellpay_raw_replies_created_at_idx ON public.cellpay_raw_replies (created_at);