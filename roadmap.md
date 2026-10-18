# VZ-PREPAID-GUARD-1017
<!-- DB-OUTAGE-TRACK-1017 -->
- [x] Add browser tracking retry queue and app/success-path wiring.
- [x] Add background order logging and pure in-memory duplicate guard; preserve CellPay requests.
- [x] Add phone/amount locks and bilingual maybe-paid state across submission callers.
- [x] Verify new outage regressions and intercepted-payment preview; provide full diff without deployment, publishing or database changes.

- [x] Add pure guard and shared bilingual wording; carrier number focus.
- [x] Apply prepared migration `vz_prepaid_guard_1017` (authorized by the owner).
- [x] Integrate transaction and PayPal pre-create guard; dedicated checkout dialog and notes.
- [x] Run full suite: 101 passed, 28 existing SEO failures; 29 Verizon tests passed.
- [x] Verify intercepted-payment preview flow, preserved card input, number-change focus and Spanish mobile notice; build OK.
- [x] Deploy only cellpay-proxy after migration is applied. Do not publish.

# LPX-1017
- [x] Update only shared lander copy, GoLander display strings and static-shell text/meta.
- [x] All 19 copy tests passed; all 29 Verizon regression tests passed; five lander previews and Spanish mobile view verified, build OK. No publish or backend changes.

# AEO-11-ULTRA-1017 <!-- // AEO-11-ULTRA-1017 -->
- [x] Add Ultra Mobile EN/ES guides and requested routes, shells, inbound links, sitemap and AI index entries. <!-- // AEO-11-ULTRA-1017 -->
- [x] Verified both guides, shared static FAQ data, canonical/CTA links and Spanish mobile view; build OK. Existing SEO tests retain 28 failures; 20 checks passed. Not published. <!-- // AEO-11-ULTRA-1017 -->

# KLARNA-FUNNEL-1017
- [x] Preserve existing funnel records and apply additive analytics migration.
- [x] Add isolated Klarna events, mirrored flags, and retry metadata without UI/payment changes.
- [x] 59 regression tests passed; preview offer/click events read back from analytics, with no payment calls or runtime errors. Deploy only funnel-event and cellpay-proxy; not published. Real Klarna authorization was not exercised.

# REFUND-RETRY-1018 // REFUND-RETRY-1018
- [x] Add browser-local carrier reasons, retry choices, history limits and one-shot context. // REFUND-RETRY-1018
- [x] Wire refund choices, safe prefill and carrier phone selection; intercepted Boost and T-Mobile-to-Metro flows verified without extra payment, preserving requests and guards. // REFUND-RETRY-1018
- [x] Add isolated retry analytics/log metadata; 255 tests passed, 36 existing failures; preview build OK; redeploy cellpay-proxy and funnel-event only, no database changes or frontend publish. // REFUND-RETRY-1018
