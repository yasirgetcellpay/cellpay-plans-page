# Project architecture rules
- Keep Verizon prepaid history gating in a pure shared edge-function helper with injected lookup/audit dependencies so fail-open behavior is unit-testable.
- Keep Verizon customer wording in a frontend-only shared module using relative imports from prerendered content so runtime and static notes match.
- Keep Klarna analytics dimensions and per-offer dedupe isolated from existing funnel events, with separate edge inserts, so logging failures cannot affect legacy analytics or payments.
- Keep outage tracking retries and phone/amount locks in browser helpers, and logging races and isolate dedupe in pure edge helpers, so outage behavior is testable without modifying payment requests.
- Keep carrier refund retry policy and browser-only context in a pure frontend helper, and retry analytics in an independent edge batch, so retries cannot bypass payment guards or disrupt legacy logging. // REFUND-RETRY-1018
- Keep carrier email token handling in one once-ready hook with a current callback ref so carrier pages share resolution and cleanup without overwriting typed input. // ST-PREFILL-1018
