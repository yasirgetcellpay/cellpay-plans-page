CREATE TABLE public.checkout_funnel_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('checkout_view','total_shown','payment_started','submitted','left_at_total')),
  carrier text, amount numeric, fee numeric, total numeric, session_id text, lang text, host text, client_ts timestamptz
);
GRANT ALL ON public.checkout_funnel_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.checkout_funnel_events_id_seq TO service_role;
ALTER TABLE public.checkout_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX checkout_funnel_events_created_idx ON public.checkout_funnel_events (created_at);
CREATE INDEX checkout_funnel_events_carrier_event_idx ON public.checkout_funnel_events (carrier, event);