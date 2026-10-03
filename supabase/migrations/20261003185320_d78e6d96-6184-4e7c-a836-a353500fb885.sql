-- Add-on seeds (CellPay Fraud decision Oct 3 2026 13:49 CT; standing rule: clear testers go straight onto the blocklist). Rows only; no schema/grant changes.
-- From the 13:48 CT watch. Phones and emails only, no IPs (lock 5). Held back: 9162773374 / ffunkygirl68@ (REVIEW), ***4419, ***9057, ***2780, ***8695, ***0605.
BEGIN;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, expires_at, note)
SELECT 'phone', public.blocklist_norm('phone', v.p), 'card_testing', 'card-testing 2026-10-03 watch 13:48', 'CellPay Fraud (standing rule, decision Oct 3 2026 13:49 CT)', now() + interval '180 days', NULL
FROM (VALUES ('3072264731'), ('5406093974'), ('9283580604')) v(p)
ON CONFLICT DO NOTHING;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, note)
SELECT 'email', public.blocklist_norm('email', v.e), 'card_testing', 'card-testing 2026-10-03 watch 13:48', 'CellPay Fraud (standing rule, decision Oct 3 2026 13:49 CT)', NULL
FROM (VALUES ('turnkeytulip891@gmail.com'), ('cafegrie@gmail.com'), ('philipecalix@yahoo.com'), ('reddeerthompson24241989@gmail.com')) v(e)
ON CONFLICT DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.checkout_blocklist WHERE active AND reason <> 'qa_smoke') <> 60 THEN
    RAISE EXCEPTION 'expected 60 seeded rows (19 phones + 41 emails)';
  END IF;
END $$;
COMMIT;