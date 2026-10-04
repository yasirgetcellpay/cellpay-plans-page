-- Add-on seeds (CellPay Fraud, queued 2026-10-03 20:44 CT, inserted in the AD-1 slot after its clean +15; standing rule: clear testers go straight onto the blocklist). Rows only; no schema/grant changes.
-- Card tester 20:17-20:30 CT: 5 declines, 0 ok, 3 names, Mastercard + Visa, one phone + one email. Phones and emails only, no IPs (lock 5; 216.106.184.124 is residential).
-- reason is CHECK-constrained, so reason = 'card_testing' (as at 13:49 and 16:33) and the description goes in source.
BEGIN;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, expires_at, note)
SELECT 'phone', public.blocklist_norm('phone', v.p), 'card_testing', 'card tester 2026-10-03 20:17-20:30 CT, 5 declines, 3 names', 'CellPay Fraud (standing rule, queued Oct 3 2026 20:44 CT)', now() + interval '180 days', NULL
FROM (VALUES ('6026171224')) v(p)
ON CONFLICT DO NOTHING;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, note)
SELECT 'email', public.blocklist_norm('email', v.e), 'card_testing', 'card tester 2026-10-03 20:17-20:30 CT, 5 declines, 3 names', 'CellPay Fraud (standing rule, queued Oct 3 2026 20:44 CT)', NULL
FROM (VALUES ('connieozuna7@gmail.com')) v(e)
ON CONFLICT DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.checkout_blocklist WHERE active AND reason <> 'qa_smoke') <> 64 THEN
    RAISE EXCEPTION 'expected 64 seeded rows (62 + 1 phone + 1 email)';
  END IF;
END $$;
COMMIT;