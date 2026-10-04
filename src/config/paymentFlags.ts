// Payment method switches (one place). PL-0, Oct 3 2026: Pay by Bank (Plaid) is hidden on both hosts because every Plaid payment
// failed in the last 30 days (invalid_access_token). Fix C turns it back on by setting PLAID_ENABLED to true. Nothing else reads this yet.
export const PLAID_ENABLED = true;
