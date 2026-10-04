// Payment method switches (one place). PL-0, Oct 3 2026: Pay by Bank (Plaid) was hidden because every Plaid payment failed
// (invalid_access_token). Plaid v2, Oct 4 2026: shown again on CellPay's Pay by Bank flow. Server-side kill switch:
// fraud_controls.plaid_exchange_mode = 'off' (cellpay-proxy then refuses it and the page hides it for the visit).
export const PLAID_ENABLED = true;
