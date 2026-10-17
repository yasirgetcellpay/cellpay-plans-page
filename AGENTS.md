# Project architecture rules
- Keep Verizon prepaid history gating in a pure shared edge-function helper with injected lookup/audit dependencies so fail-open behavior is unit-testable.
- Keep Verizon customer wording in a frontend-only shared module using relative imports from prerendered content so runtime and static notes match.