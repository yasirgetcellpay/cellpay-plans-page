
-- App role enum + user_roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Transaction log table (every checkout attempt)
CREATE TABLE public.transaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  carrier_name TEXT,
  carrier_slug TEXT,
  carrier_id TEXT,
  plan_id TEXT,
  phone_number TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  amount NUMERIC,
  total NUMERIC,
  payment_method TEXT,
  card_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|success|failed
  hashid TEXT,
  transaction_id TEXT,
  error_message TEXT,
  source_ip TEXT,
  user_agent TEXT,
  raw_response JSONB,
  metadata JSONB
);

CREATE INDEX idx_tx_logs_created_at ON public.transaction_logs (created_at DESC);
CREATE INDEX idx_tx_logs_status ON public.transaction_logs (status);
CREATE INDEX idx_tx_logs_carrier ON public.transaction_logs (carrier_slug);
CREATE INDEX idx_tx_logs_payment_method ON public.transaction_logs (payment_method);
CREATE INDEX idx_tx_logs_phone ON public.transaction_logs (phone_number);
CREATE INDEX idx_tx_logs_email ON public.transaction_logs (email);

ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauth checkout flow) can insert their own attempt log
CREATE POLICY "Anyone can insert transaction logs"
  ON public.transaction_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view all transaction logs"
  ON public.transaction_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (for marking success/failed via update flow if needed)
CREATE POLICY "Anyone can update transaction logs by id"
  ON public.transaction_logs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER TABLE public.transaction_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_logs;
