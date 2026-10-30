# Post-payment receipt SMS

- Add an isolated background sender after confirmed successful payment logging, including Cash App polling and settlement sweeps. Payment responses will never wait for SMS.
- Use a service-only atomic claim to deduplicate by paid transaction ID/hashid, preserving existing metadata and payment status.
- Send the exact English/Spanish receipt text through Twilio Messaging Service, with a five-second timeout, no 4xx retry, and at most one 5xx retry.
- Pass checkout language outside the CellPay payload and persist it in order metadata.
- Keep sending disabled by default. `POSTPAY_SMS_ENABLED` and all three requested Twilio secrets are absent; no secrets will be created or requested.
- Add focused tests, apply the additive RPC migration, and deploy only `cellpay-proxy` and `cashapp-settlement-sweep`. Do not publish the website.

## Technical details
- Claims and result writes merge only `metadata.postpay_sms`; no payment, fee, consent, tracking, or validation changes.
- A claim prevents repeated attempts after ambiguous network failures. Twilio acceptance cannot guarantee delivery; no automatic retry after timeout.
- Tag changed lines with `POSTPAY-SMS-34332-1030` (SQL uses valid SQL comments).