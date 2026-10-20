// KLARNA-OPEN-1019
export type KlarnaField = "first_name" | "last_name" | "phone" | "address" | "city" | "state" | "country" | "zip";

export function firstMissingKlarnaField(v: { firstName: string; lastName: string; phone: string; address: string; city: string; state: string; country: string; zip: string }): KlarnaField | null {
  if (!v.firstName.trim()) return "first_name";
  if (!v.lastName.trim()) return "last_name";
  if (v.phone.replace(/\D/g, "").length < 10) return "phone";
  if (!v.address.trim()) return "address";
  if (!v.city.trim()) return "city";
  if (!v.state.trim()) return "state";
  if (!v.country.trim()) return "country";
  if (v.zip.length < 5) return "zip";
  return null;
}