import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const BILLING_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  ANNUAL: 12,
  TWO_YEAR: 24,
  THREE_YEAR: 36,
};

// GET /api/v1/super-admin/stats/revenue
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(now.getDate() + 30);

    const [activeSubscriptions, revenueAgg, overdueCount, expiring30d] = await Promise.all([
      // For MRR: fetch active subs with billing cycle
      prisma.societySubscription.findMany({
        where: { status: "ACTIVE", finalPrice: { not: null }, billingOptionId: { not: null } },
        select: {
          finalPrice: true,
          billingOption: { select: { billingCycle: true } },
        },
      }),
      // Total revenue this month
      prisma.subscriptionPayment.aggregate({
        where: { paymentDate: { gte: monthStart }, isReversal: false },
        _sum: { amount: true },
      }),
      // Overdue invoices
      prisma.subscriptionInvoice.count({ where: { status: "OVERDUE" } }),
      // Expiring in 30 days
      prisma.societySubscription.count({
        where: {
          status: "ACTIVE",
          currentPeriodEnd: { gte: now, lte: thirtyDaysOut },
        },
      }),
    ]);

    // Compute MRR
    let mrr = 0;
    for (const sub of activeSubscriptions) {
      if (!sub.finalPrice || !sub.billingOption) continue;
      const months = BILLING_MONTHS[sub.billingOption.billingCycle] ?? 1;
      mrr += Number(sub.finalPrice) / months;
    }

    return successResponse({
      mrr: Math.round(mrr * 100) / 100,
      totalRevenueThisMonth: Number(revenueAgg._sum.amount ?? 0),
      overdueCount,
      expiring30d,
    });
  } catch {
    return internalError("Failed to fetch revenue stats");
  }
}
