/**
 * Vehicle registration number and document expiry utilities.
 */

/** Strips spaces and hyphens, uppercases. DL-3C-AB-1234 → DL3CAB1234 */
export function normalizeRegNumber(raw: string): string {
  return raw
    .replace(/[\s-]+/g, "")
    .toUpperCase()
    .trim();
}

export type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NOT_SET";

/**
 * Returns expiry status relative to today.
 * EXPIRING_SOON = expires within 30 days.
 */
export function getExpiryStatus(date: Date | null | undefined): ExpiryStatus {
  if (!date) return "NOT_SET";
  const now = new Date();
  // Use UTC date-only values to avoid timezone drift on boundary comparisons
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const soonUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30);
  const dateUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (dateUTC < todayUTC) return "EXPIRED";
  if (dateUTC <= soonUTC) return "EXPIRING_SOON";
  return "VALID";
}
