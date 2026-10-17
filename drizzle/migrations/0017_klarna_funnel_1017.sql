-- KLARNA-FUNNEL-1017: nullable logging dimensions; existing records and permissions remain unchanged.
ALTER TABLE public.checkout_funnel_events
  ADD COLUMN IF NOT EXISTS screen text,
  ADD COLUMN IF NOT EXISTS decline_ab text,
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS klarna_result text,
  ADD COLUMN IF NOT EXISTS shown boolean,
  ADD COLUMN IF NOT EXISTS cap boolean;
ALTER TABLE public.checkout_funnel_events DROP CONSTRAINT IF EXISTS checkout_funnel_events_event_check;
ALTER TABLE public.checkout_funnel_events ADD CONSTRAINT checkout_funnel_events_event_check CHECK (event = ANY (ARRAY['checkout_view','total_shown','payment_started','submitted','left_at_total','prefill_used','autopay_postpurchase_offer_shown','autopay_postpurchase_offer_accepted','recovery_prompt_shown','recovery_retry','recovery_success','klarna_offer_shown','klarna_clicked','klarna_session_created','klarna_auth_result']::text[]));
CREATE INDEX IF NOT EXISTS checkout_funnel_events_cs_idx ON public.checkout_funnel_events (checkout_session_id) WHERE checkout_session_id IS NOT NULL;