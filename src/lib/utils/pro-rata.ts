/**
 * Pro-rata calculation for plan switches.
 * Used when a society switches plans mid-billing-cycle.
 */

export interface ProRataResult {
  daysInPeriod: number;
  daysRemaining: number;
  credit: number; // refund from unused old plan days
  charge: number; // charge for new plan days
  netAmount: number; // charge - credit (positive = society owes, negative = credit owed)
}

/**
 * Calculate pro-rata amounts when switching plans.
 *
 * @param oldPrice - Current total price for the billing period (flat or monthly equivalent)
 * @param newPrice - New total price for the billing period
 * @param currentPeriodStart - Start of current billing period
 * @param currentPeriodEnd - End of current billing period
 * @param switchDate - Date of the switch (defaults to now)
 */
export function calculateProRata(
  oldPrice: number,
  newPrice: number,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  switchDate: Date = new Date(),
): ProRataResult {
  const msPerDay = 24 * 60 * 60 * 1000;

  const daysInPeriod = Math.round(
    (currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / msPerDay,
  );

  const daysRemaining = Math.max(
    0,
    Math.round((currentPeriodEnd.getTime() - switchDate.getTime()) / msPerDay),
  );

  const dailyOld = oldPrice / daysInPeriod;
  const dailyNew = newPrice / daysInPeriod;

  const credit = Math.round(dailyOld * daysRemaining * 100) / 100;
  const charge = Math.round(dailyNew * daysRemaining * 100) / 100;
  const netAmount = Math.round((charge - credit) * 100) / 100;

  return { daysInPeriod, daysRemaining, credit, charge, netAmount };
}

/**
 * Format a pro-rata result into a human-readable summary.
 */
export function formatProRata(result: ProRataResult): string {
  if (result.netAmount > 0) {
    return `₹${result.netAmount.toLocaleString("en-IN")} due today (${result.daysRemaining} days remaining)`;
  } else if (result.netAmount < 0) {
    return `₹${Math.abs(result.netAmount).toLocaleString("en-IN")} credit applied`;
  }
  return "No charge for this switch";
}
