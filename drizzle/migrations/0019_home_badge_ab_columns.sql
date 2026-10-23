-- HOME-INSTANT-BADGE-1023: additive, nullable columns for homepage badge A/B exposures.
ALTER TABLE public.checkout_funnel_events ADD COLUMN IF NOT EXISTS hb_group text;
ALTER TABLE public.checkout_funnel_events ADD COLUMN IF NOT EXISTS hb_vid text;