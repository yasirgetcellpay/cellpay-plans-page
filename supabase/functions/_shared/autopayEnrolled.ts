// AUTOPAY-RECEIPT-ENROLL-1102: receipt-only rule; never return stored profile identifiers.
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function hasAutoPayEnrollment(row: unknown): boolean {
  const log = record(row);
  const autopay = record(log.metadata).autopay;
  const data = record(record(log.raw_response).data);
  const hasProfile = [data.CustomerProfileId, data.customer_profile_id].some((id) =>
    (typeof id === "string" && id.trim().length > 0) || (typeof id === "number" && Number.isFinite(id) && id > 0));
  return log.status === "success" && (autopay === true || autopay === "true") && hasProfile;
}