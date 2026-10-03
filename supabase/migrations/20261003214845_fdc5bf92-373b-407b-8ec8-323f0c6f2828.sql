-- Add-on seeds (CellPay Fraud, Lead add-on during the Fix F slot, Oct 3 2026 ~16:33 CT; standing rule: clear testers go straight onto the blocklist). Rows only; no schema/grant changes.
-- Card tester 16:21-16:26 CT: 5 declines (2 applepay, 3 card), 3 names, one phone + one email. Phones and emails only, no IPs (lock 5). Held back: 3184220831 (REVIEW).
-- reason is CHECK-constrained, so reason = 'card_testing' (as at 13:49) and the description goes in source.
BEGIN;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, expires_at, note)
SELECT 'phone', public.blocklist_norm('phone', v.p), 'card_testing', 'card tester 2026-10-03 16:21-16:26 CT, 5 declines, 3 names', 'CellPay Fraud (standing rule, Lead add-on Oct 3 2026 16:33 CT)', now() + interval '180 days', NULL
FROM (VALUES ('9203055252')) v(p)
ON CONFLICT DO NOTHING;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, note)
SELECT 'email', public.blocklist_norm('email', v.e), 'card_testing', 'card tester 2026-10-03 16:21-16:26 CT, 5 declines, 3 names', 'CellPay Fraud (standing rule, Lead add-on Oct 3 2026 16:33 CT)', NULL
FROM (VALUES ('garciaiveth727@gmail.com')) v(e)
ON CONFLICT DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.checkout_blocklist WHERE active AND reason <> 'qa_smoke') <> 62 THEN
    RAISE EXCEPTION 'expected 62 seeded rows (60 + 1 phone + 1 email)';
  END IF;
END $$;
COMMIT;