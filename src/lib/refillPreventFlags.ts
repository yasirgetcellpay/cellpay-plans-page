// REFILL-PREVENT-1024: one switch per item. Rollback = set the item to false.
export const RP_P1_FORMAT = true; // phone format check + confirm field (A/B by cp_rp)
export const RP_P2_RETRY_BLOCK = true; // 30-min same number/carrier/plan block after plan-mismatch refunds (A/B by cp_rp)
export const RP_P2_GUIDANCE = true; // Ultra plan list + T-Mobile amount help text
export const RP_P4_DEAD_AMOUNTS = true; // disabled "Temporarily unavailable" amounts
export const RP_P6_ST_PASTDUE = true; // Straight Talk past-due refund card text
export const RP_P2c_DISC_24H = true; // 24-h same number + plan block after discontinued / product-not-found load errors. // LYCA-SKU-FIX-1024
export const TMO_LAST_PLAN = true; // REFILL-PREVENT-TMO-1026: last successful T-Mobile plan lookup + preselect/badge
export const TMO_SOFT_CONFIRM = true; // REFILL-PREVENT-TMO-1026: one-time inline confirm when amount differs from last plan
export const TMO_RETRY_BLOCK_ALWAYS = true; // REFILL-PREVENT-TMO-1026: T-Mobile gets the 30-min retry block regardless of cp_rp
/** After this time no new A/B assignment is made; unassigned visitors get control (today's behavior). */
export const RP_AB_END = "2026-10-27T18:00:00Z";
