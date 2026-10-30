# Ultra verified-plan payment safeguard

- Wait up to eight seconds for Ultra number-specific plans, showing the requested loading text and disabling Pay/Continue while waiting.
- Block failed, empty, or timed-out lookups with the requested bilingual message and a retry; never fall through to an Ultra catalog charge without a barcode.
- Replace silent amount swaps with the requested notice and explicit selection of verified fixed or wallet/range plans. Keep exact matches automatic, and preserve plan-purchase versus custom/wallet matching.
- Protect checkout transaction and alternative payment entry points when the Ultra selection lacks a matching barcode, directing customers to select verified Ultra plans.
- Preserve all existing fees, pricing, other carriers, consent, fraud checks, and proxy code. Do not publish or deploy.

## Technical details
- Keep changes in frontend Ultra selection/checkout code and focused Vitest tests; tag changed lines `// ULTRA-BPATH-FIX-1029`.
- Update the existing Ultra architecture rule in `AGENTS.md` and track completion in the roadmap.
- Test timeout blocking, unchanged amounts on mismatch, and explicit selection attaching the correct barcode and amount. Check English/Spanish mobile selection and checkout handoff without submitting a real payment.