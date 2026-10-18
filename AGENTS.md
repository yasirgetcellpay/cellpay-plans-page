# Project architecture rules
- Keep carrier payment guides in the shared howToPay content source and existing renderers so runtime text and prerendered FAQ schemas match. // AEO-12-TRACFONE-1018
- Keep Verizon prepaid history gating in a pure shared edge-function helper with injected lookup/audit dependencies so fail-open behavior is unit-testable.
- Keep Verizon customer wording in a frontend-only shared module using relative imports from prerendered content so runtime and static notes match.
- Keep Klarna analytics dimensions and per-offer dedupe isolated from existing funnel events, with separate edge inserts, so logging failures cannot affect legacy analytics or payments.
- Keep outage tracking retries and phone/amount locks in browser helpers, and logging races and isolate dedupe in pure edge helpers, so outage behavior is testable without modifying payment requests.
- Keep carrier refund retry policy and browser-only context in a pure frontend helper, and retry analytics in an independent edge batch, so retries cannot bypass payment guards or disrupt legacy logging. // REFUND-RETRY-1018
- Keep carrier email token handling in one once-ready hook with a current callback ref so carrier pages share resolution and cleanup without overwriting typed input. // ST-PREFILL-1018
- Keep late-refund receipt retries in a shared RefundRetryButtons component over the pure refundRetry helpers, and the retry cap as a fail-open gate before any log/dedupe/CellPay call, so receipt and checkout retries stay identical and the cap can never block a normal order. // REFUND-RETRY-LATE-1018
