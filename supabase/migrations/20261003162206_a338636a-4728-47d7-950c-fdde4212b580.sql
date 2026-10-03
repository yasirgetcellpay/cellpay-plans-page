-- BL-QA + add-on seeds (CellPay Fraud, Oct 3 2026 ~11:20 CT). Runs after BL-1. Rows only; no schema/grant changes.
BEGIN;
-- QA test identities (blocklist-deploy.md section 7 step 1); auto-expire after 1 day.
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, expires_at)
VALUES ('phone', public.blocklist_norm('phone','5555550142'), 'qa_smoke', 'BL QA', 'CellPay QA', now() + interval '1 day'),
       ('email', public.blocklist_norm('email','someone.qa.cellpay@gmail.com'), 'qa_smoke', 'BL QA', 'CellPay QA', now() + interval '1 day')
ON CONFLICT DO NOTHING;
-- Add-on: 2 testers found by the 11:17 CT watch (standing rule: testers go straight onto the blocklist). No IPs (4435703970 is on Verizon CGNAT; lock 5).
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, expires_at, note)
SELECT 'phone', public.blocklist_norm('phone', v.p), 'card_testing', 'card-testing 2026-10-03 watch 11:17', 'CellPay Fraud (CellPay Lead approved Oct 3 2026)', now() + interval '180 days', NULL
FROM (VALUES ('7029693311'), ('4435703970')) v(p)
ON CONFLICT DO NOTHING;
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, note)
SELECT 'email', public.blocklist_norm('email', v.e), 'card_testing', 'card-testing 2026-10-03 watch 11:17', 'CellPay Fraud (CellPay Lead approved Oct 3 2026)', NULL
FROM (VALUES ('snsantana76@gmail.com'), ('ssnsantana76@gmail.com'), ('kendrajkelly7@gmail.com'), ('taniadennis33@gmail.com')) v(e)
ON CONFLICT DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.checkout_blocklist WHERE active AND reason <> 'qa_smoke') <> 53 THEN
    RAISE EXCEPTION 'expected 53 seeded rows (16 phones + 37 emails)';
  END IF;
END $$;
COMMIT;