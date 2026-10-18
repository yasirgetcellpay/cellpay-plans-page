# Project architecture rules
- Keep Verizon prepaid history gating in a pure shared edge-function helper with injected lookup/audit dependencies so fail-open behavior is unit-testable.
- Keep Verizon customer wording in a frontend-only shared module using relative imports from prerendered content so runtime and static notes match.
- Keep Klarna analytics dimensions and per-offer dedupe isolated from existing funnel events, with separate edge inserts, so logging failures cannot affect legacy analytics or payments.
- Keep outage tracking retries and phone/amount locks in browser helpers, and logging races and isolate dedupe in pure edge helpers, so outage behavior is testable without modifying payment requests.