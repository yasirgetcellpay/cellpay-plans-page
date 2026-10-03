-- BL-1 migration: proxy blocklist for cellpay-proxy (CellPay US). PREPARED, NOT SENT. CellPay Fraud, Oct 3 2026 10:10 CT.
-- New objects only. It doesn't touch transaction_logs, log_transaction_attempt, finalize_transaction_log, proxy_guard_events
-- or any existing grant. No IP key type (Yasir hard lock 5: never block carrier CGNAT; IPs stay WAF/ASN decisions).
BEGIN;

CREATE TABLE IF NOT EXISTS public.checkout_blocklist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type    text NOT NULL CHECK (key_type IN ('phone','email','card_hash','visitor','session')),
  value_norm  text NOT NULL,       -- phone: digits (US 11-digit with leading 1 -> 10); email: lowercased, +tag cut, gmail dots folded;
                                   -- card_hash: 64-hex HMAC (same key as S3 card_h), NEVER a PAN; visitor/session: trimmed id
  reason      text NOT NULL CHECK (reason IN ('card_testing','stolen_card_ring','multi_identity','cross_site_attacker',
                                              'chargeback_link','manual','qa_smoke')),
  source      text NOT NULL,       -- evidence pointer, e.g. 'decline-spike-2026-10-03 §6 #1'
  added_by    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,         -- NULL = no expiry
  active      boolean NOT NULL DEFAULT true,
  hit_count   integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  note        text,
  CONSTRAINT cb_card_hash_is_hex CHECK (key_type <> 'card_hash' OR value_norm ~ '^[0-9a-f]{64}$'),
  CONSTRAINT cb_phone_is_digits  CHECK (key_type <> 'phone' OR value_norm ~ '^[0-9]{7,15}$'),
  CONSTRAINT cb_no_pan_like      CHECK (key_type IN ('phone','card_hash') OR value_norm !~ '^[0-9 -]{13,23}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS cb_active_key_uniq ON public.checkout_blocklist (key_type, value_norm) WHERE active;
ALTER TABLE public.checkout_blocklist ENABLE ROW LEVEL SECURITY;   -- no policies on purpose
REVOKE ALL ON TABLE public.checkout_blocklist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_blocklist TO service_role;
COMMENT ON TABLE public.checkout_blocklist IS
  'cellpay-proxy fraud blocklist (service role only). Normalized phone/email, HMAC card hash only (never a PAN), visitor/session ids. No IPs (CGNAT hard lock).';

CREATE OR REPLACE FUNCTION public.blocklist_norm(_type text, _raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text := btrim(coalesce(_raw,'')); loc text; dom text;
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  IF _type = 'phone' THEN
    v := regexp_replace(v, '\D', '', 'g');
    IF length(v) = 11 AND left(v,1) = '1' THEN v := right(v,10); END IF;
    RETURN CASE WHEN length(v) BETWEEN 7 AND 15 THEN v END;
  ELSIF _type = 'email' THEN
    v := lower(v);
    IF v = 'customer@cellpay.us' THEN RETURN NULL; END IF;      -- wallet/Cash App placeholder, never a key
    IF position('@' in v) = 0 THEN RETURN v; END IF;
    loc := regexp_replace(v, '@[^@]*$', '');
    dom := substring(v from '@([^@]*)$');
    loc := split_part(loc, '+', 1);
    IF dom IN ('gmail.com','googlemail.com') THEN loc := replace(loc, '.', ''); dom := 'gmail.com'; END IF;
    RETURN NULLIF(loc,'') || '@' || dom;
  ELSIF _type = 'card_hash' THEN
    v := lower(v); RETURN CASE WHEN v ~ '^[0-9a-f]{64}$' THEN v END;
  ELSIF _type IN ('visitor','session') THEN
    RETURN left(v, 200);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_blocklist_check(_phone text, _email text, _card_h text, _visitor text, _session text)
RETURNS TABLE (blocked boolean, key_type text, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hit public.checkout_blocklist%ROWTYPE;
BEGIN
  SELECT b.* INTO hit FROM public.checkout_blocklist b
  JOIN (VALUES (1,'card_hash', public.blocklist_norm('card_hash',_card_h)),
               (2,'phone',     public.blocklist_norm('phone',_phone)),
               (3,'email',     public.blocklist_norm('email',_email)),
               (4,'visitor',   public.blocklist_norm('visitor',_visitor)),
               (5,'session',   public.blocklist_norm('session',_session))) k(prio, kt, kv)
    ON b.key_type = k.kt AND b.value_norm = k.kv
  WHERE b.active AND (b.expires_at IS NULL OR b.expires_at > now()) AND k.kv IS NOT NULL
  ORDER BY k.prio LIMIT 1;
  IF hit.id IS NULL THEN RETURN QUERY SELECT false, NULL::text, NULL::text; RETURN; END IF;
  UPDATE public.checkout_blocklist SET hit_count = hit_count + 1, last_hit_at = now() WHERE id = hit.id;
  RETURN QUERY SELECT true, hit.key_type, hit.reason;
END $$;

-- New public functions get EXECUTE for anon/authenticated by default on Supabase: revoke explicitly (same rule as Fix A).
REVOKE ALL ON FUNCTION public.blocklist_norm(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_blocklist_check(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocklist_norm(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_blocklist_check(text, text, text, text, text) TO service_role;

-- ---------------- Seeds (Lead order Oct 3 2026 ~10:00 CT; evidence fraud/decline-spike-2026-10-03.md §6) ----------------
-- Phones: 14 = the §6 list of 15 minus the 4 medium-confidence entries left out (6513913389, 4703988281, 3468466280, 4793734344),
--   + 3 LARGE_ATTACK tester phones (add-on Oct 3 10:28 CT). Never 5049301877 (real household); no IPs, never 172.58.x CGNAT.
-- Phones expire after 180 days (numbers get recycled). Emails don't expire.
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, expires_at, note)
SELECT 'phone', public.blocklist_norm('phone', v.p), v.r, v.s, 'CellPay Fraud (CellPay Lead approved Oct 3 2026)', now() + interval '180 days', v.n
FROM (VALUES
  ('4802774315','card_testing',       'decline-spike-2026-10-03 §6 #1', '10 $10 declines + 12 rapid Validation failed, 6 emails, 0 success'),
  ('5083040076','stolen_card_ring',   'decline-spike-2026-10-03 §6 #2', 'Google Pay stolen-card ring (VPN/hosting IPs)'),
  ('9174596095','stolen_card_ring',   'decline-spike-2026-10-03 §6 #2', 'ring; 92 failed / 0 success / 9 emails in 30 d'),
  ('4847359332','stolen_card_ring',   'decline-spike-2026-10-03 §6 #2', 'ring; 8 declines incl. stolen/lost'),
  ('2487275818','multi_identity',     'decline-spike-2026-10-03 §6 #3', '4 cardholder names, 0 success'),
  ('5135409807','multi_identity',     'decline-spike-2026-10-03 §6 #4', '3 unrelated names, 0 success'),
  ('7549710730','card_testing',       'decline-spike-2026-10-03 §6 #5', '24 real declines, 3 names, MC+VI, 8 sessions, 0 success'),
  ('7282206608','multi_identity',     'decline-spike-2026-10-03 §6 #7', '2 unrelated names, 6 sessions, 0 success'),
  ('2723151657','card_testing',       'decline-spike-2026-10-03 §6 #8', '5 declines in 90 s incl. stolen/lost, 02:45 attack window'),
  ('5616467357','card_testing',       'decline-spike-2026-10-03 §6 #12','stolen/lost; name does not match email'),
  ('3045938681','cross_site_attacker','decline-spike-2026-10-03 §6 #13','Callingmart-flagged attacker Oct 1 (7 declines, 5 names, stolen card)'),
  -- Add-on Oct 3 10:28 CT (CellPay Lead approved): 10:24 CT LARGE_ATTACK testers. One actor: same iPhone OS 18_7 UA, identities fired in lockstep (10:03:19/10:03:21, 10:06:22/10:06:28).
  ('3869918189','card_testing',       'LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)', 'Trevawn Morrison; Apple Pay; emails trevawn.m@/trevawn.n@yahoo.com; lockstep with 7743600190; 0 success'),
  ('7743600190','card_testing',       'LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)', 'Jose Tirado; card; emails tirado89.ft@/tirafo89.ft@gmail.com; Cloudflare relay IP; lockstep with 3869918189; 0 success'),
  ('9545156782','card_testing',       'LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)', 'Elise Lubin name on petermoss83@gmail.com; MC then VI within 3 min; 0 success (CGNAT IP not blocked, phone only)')
) v(p, r, s, n);

-- Emails (33): the §6 emails of the seeded phones + lucianoleslie201 (cross-site) + 2 linked chargeback identities
--   + 5 alanwinn74 ring emails + 5 LARGE_ATTACK tester emails (add-on Oct 3 10:28 CT) + 2 Straight Talk Oct 2 testers (10:30 CT).
INSERT INTO public.checkout_blocklist (key_type, value_norm, reason, source, added_by, note)
SELECT 'email', public.blocklist_norm('email', v.e), v.r, v.s, 'CellPay Fraud (CellPay Lead approved Oct 3 2026)', v.n
FROM (VALUES
  ('luna83linda@gmail.com','card_testing','decline-spike-2026-10-03 §6 #1',NULL),
  ('luna86linda@gmail.com','card_testing','decline-spike-2026-10-03 §6 #1',NULL),
  ('luna86linda@gmail@gmail.com','card_testing','decline-spike-2026-10-03 §6 #1','malformed as typed by the tester'),
  ('luna86linda@gmail@gmaim.com','card_testing','decline-spike-2026-10-03 §6 #1','malformed as typed by the tester'),
  ('luna86linda@gnail.com','card_testing','decline-spike-2026-10-03 §6 #1',NULL),
  ('nehemiahboehme257@gmail.com','card_testing','decline-spike-2026-10-03 §6 #1',NULL),
  ('anah24407@gmail.com','stolen_card_ring','decline-spike-2026-10-03 §6 #2; re-reviewed 2026-10-03 10:21 CT','all-time 75 attempts / 9 phones / 6 carriers; placeholder names Customer Herrera|User; 11-s retry bursts (Invalid account, Stolen or lost); VPN-registered IPs (VPN Consumer NJ/Secaucus/Mumbai, NSQ, LogicWeb); 5 successes Sep 6-15 = chargeback-watch.md'),
  ('dalvinjose8383@gmail.com','stolen_card_ring','decline-spike-2026-10-03 §6 #2',NULL),
  ('mddulaluddin089@gmail.com','stolen_card_ring','decline-spike-2026-10-03 §6 #2',NULL),
  ('robertcoates950@gmail.com','stolen_card_ring','decline-spike-2026-10-03 §6 #2',NULL),
  ('sarochadipratna@gmail.com','chargeback_link','decline-spike-2026-10-03 §6 #2 (linked success)','ring email; $55.99 Metro PCS Google Pay success Oct 2 12:08 CT on 4014146044 via M247 VPN'),
  ('andraewalker913@gmail.com','multi_identity','decline-spike-2026-10-03 §6 #3',NULL),
  ('frankmacario762@gmail.com','multi_identity','decline-spike-2026-10-03 §6 #4',NULL),
  ('delsteven7@gmail.com','card_testing','decline-spike-2026-10-03 §6 #5',NULL),
  ('rilandeclerbrun@gmail.com','card_testing','decline-spike-2026-10-03 §6 #5',NULL),
  ('schneiderlouisguervil@gmail.com','multi_identity','decline-spike-2026-10-03 §6 #7',NULL),
  ('schneiderlouisguervil@gmai.com','multi_identity','decline-spike-2026-10-03 §6 #7','typo variant used by the same actor'),
  ('alanwinn74@gmail.com','card_testing','decline-spike-2026-10-03 §6 #8; re-reviewed 2026-10-03 10:21 CT','11 attempts / 4 phones; Oct 2 02:45 5 declines in 88 s incl Stolen or lost; phones shared with throwaway ring (crafael30034xx, jeremylarax22 variants, cpimentel200373) on same IP 70.44.123.2; 2 successes Sep 13 = chargeback-watch.md'),
  ('charlesguetdy96@gmail.com','card_testing','decline-spike-2026-10-03 §6 #12',NULL),
  ('lucianoleslie201@gmail.com','cross_site_attacker','decline-spike-2026-10-03 §6 #13','with 3045938681 (Callingmart attacker)'),
  ('pamrod765@gmail.com','chargeback_link','CellPay Lead order Oct 3 (linked chargeback identity)','used with 4089915362: 1 card success Oct 2 02:36 then 7 declines; phone NOT blocked (phones can be shared)'),
  -- Add-on Oct 3 10:28 CT (CellPay Lead approved): alanwinn74@ ring emails.
  ('crafael3003430@gmail.com','stolen_card_ring','alanwinn74 ring (Lead approved add-on Oct 3)','Customer User; 10 attempts on 2723156539 Sep 11 incl IP 70.44.123.2; only success = unconfirmed Cash App session'),
  ('crafael3003730@gmail.com','stolen_card_ring','alanwinn74 ring (Lead approved add-on Oct 3)','Customer User; 6 attempts on 2723156539 Sep 11 from 70.44.123.2; 0 success'),
  ('jeremylarax22@gmail.com','stolen_card_ring','alanwinn74 ring (Lead approved add-on Oct 3)','also covers jeremylara.x22@ (gmail fold); 115 attempts, 10 phones, 3 names, 42 stolen/lost declines; 23 Google Pay successes Jul 5-Sep 2 ($1,125.77) = chargeback exposure'),
  ('jeremylara99@gmail.com','stolen_card_ring','alanwinn74 ring (Lead approved add-on Oct 3)','same 35.33.192.x IPs and phone 2726001588 as jeremylarax22; 1 success Sep 17 ($55.99) = chargeback exposure'),
  ('cpimentel200373@gmail.com','stolen_card_ring','alanwinn74 ring (Lead approved add-on Oct 3)','Customer User; 3 attempts on 2723156539 Sep 11; jeremylarax22 also used name Cristopher Pimentel; 0 success'),
  -- Add-on Oct 3 10:28 CT (CellPay Lead approved): 10:24 CT LARGE_ATTACK tester emails (yahoo: dots are NOT folded, so both variants listed).
  ('trevawn.m@yahoo.com','card_testing','LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)','with 3869918189 / 3069918189; 0 success'),
  ('trevawn.n@yahoo.com','card_testing','LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)','with 3869918189; 0 success'),
  ('tirado89.ft@gmail.com','card_testing','LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)','with 7743600190; 0 success'),
  ('tirafo89.ft@gmail.com','card_testing','LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)','with 7743600190; 0 success'),
  ('petermoss83@gmail.com','card_testing','LARGE_ATTACK 2026-10-03 10:24 CT (Lead approved add-on)','with 9545156782, cardholder name Elise Lubin; 0 success'),
  -- Add-on Oct 3 10:30 CT (Lead approved): Straight Talk Oct 2 card testing (fraud/straight-talk-failures-2026-10-02.md section 4). Phones NOT seeded.
  ('kiyannasmith69@gmail.com','card_testing','Straight Talk Oct 2 card testing (3 cards/2 names in 43 min; Visa then MC, 2 names)','3347090822; MC+VI+Apple Pay, Kiyanna Smith -> Lakyra Gibson, 13 fails 02:36-03:19 CT; Apple Pay success QWwl1Z = chargeback-watch.md; typo variants kiyannsmith69@gmail.com / kiyannasmith69@gmal.com not seeded'),
  ('alexsandberg85@gmail.com','card_testing','Straight Talk Oct 2 card testing (3 cards/2 names in 43 min; Visa then MC, 2 names)','9594446343; Visa (stop-recurring) then MC, Alexander Sandberg -> Kristy palardy, 6 fails 01:00-01:15 CT; 0 card success')
) v(e, r, s, n)
ON CONFLICT DO NOTHING;
-- Deliberately NOT seeded: phones 4014146044 and 4089915362 (linked chargeback phones; phones can be shared, Lead decision),
-- the 4 medium phones above, any IPs (WAF/ASN decision; CGNAT never), sessions (single-use ids, low value), card hashes
-- (none yet; logs hold no card data; added once S3 card_h hashing is live).

DO $$
BEGIN
  IF has_table_privilege('anon','public.checkout_blocklist','SELECT') OR has_table_privilege('authenticated','public.checkout_blocklist','SELECT')
     OR has_function_privilege('anon','public.checkout_blocklist_check(text,text,text,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.checkout_blocklist_check(text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'blocklist is reachable by anon/authenticated';
  END IF;
  IF (SELECT count(*) FROM public.checkout_blocklist WHERE active) <> 47 THEN
    RAISE EXCEPTION 'expected 47 seeded rows (14 phones + 33 emails)';
  END IF;
END $$;

COMMIT;