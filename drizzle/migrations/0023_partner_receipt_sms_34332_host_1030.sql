CREATE TABLE public.partner_receipt_sms_log ( -- // CM-PZ-34332-HOST-1030
  id bigserial PRIMARY KEY, -- // CM-PZ-34332-HOST-1030
  brand text NOT NULL, -- // CM-PZ-34332-HOST-1030
  order_id text, -- // CM-PZ-34332-HOST-1030
  to_last4 text, -- // CM-PZ-34332-HOST-1030
  sid text, -- // CM-PZ-34332-HOST-1030
  status text, -- // CM-PZ-34332-HOST-1030
  error_code text, -- // CM-PZ-34332-HOST-1030
  created_at timestamptz DEFAULT now(), -- // CM-PZ-34332-HOST-1030
  UNIQUE (brand, order_id) -- // CM-PZ-34332-HOST-1030
); -- // CM-PZ-34332-HOST-1030
GRANT ALL ON public.partner_receipt_sms_log TO service_role; -- // CM-PZ-34332-HOST-1030
GRANT USAGE, SELECT ON SEQUENCE public.partner_receipt_sms_log_id_seq TO service_role; -- // CM-PZ-34332-HOST-1030
ALTER TABLE public.partner_receipt_sms_log ENABLE ROW LEVEL SECURITY; -- // CM-PZ-34332-HOST-1030
REVOKE ALL ON public.partner_receipt_sms_log FROM anon, authenticated; -- // CM-PZ-34332-HOST-1030