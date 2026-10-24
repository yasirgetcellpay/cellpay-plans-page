-- REFILL-PREVENT-1024: additive table; read only by the dead-amounts edge function (service role).
CREATE TABLE IF NOT EXISTS public.dead_amounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  carrier_slug text NOT NULL,
  plan_id text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL DEFAULT '',
  hidden_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
GRANT ALL ON public.dead_amounts TO service_role;
ALTER TABLE public.dead_amounts ENABLE ROW LEVEL SECURITY;
INSERT INTO public.dead_amounts (carrier_slug, plan_id, amount, reason)
SELECT 'lyca', '94000495', 21, 'Product not sold, 7 fails / 0 successes in 7 days'
WHERE NOT EXISTS (SELECT 1 FROM public.dead_amounts WHERE carrier_slug = 'lyca' AND plan_id = '94000495' AND amount = 21);