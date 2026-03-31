import { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";
import { endOfMonth, startOfMonth } from "date-fns";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

// GET /api/v1/super-admin/billing/dashboard
export async function GET(_request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const [totalActive, expiringSoon, expired, trialEnding] = await Promise.all([
      prisma.societySubscription.count({ where: { status: "ACTIVE" } }),
      prisma.societySubscription.count({
        where: { status: "ACTIVE", currentPeriodEnd: { lte: in30Days, gte: now } },
      }),
      prisma.societySubscription.count({ where: { status: "EXPIRED" } }),
      prisma.societySubscription.count({
        where: { status: "TRIAL", trialEndsAt: { lte: in7Days, gte: now } },
      }),
    ]);

    let revenueThisMonth = 0;
    let pendingInvoices = 0;

    try {
      const [revenueAgg, pendingCount] = await Promise.all([
        prisma.subscriptionPayment.aggregate({
          _sum: { amount: true },
          where: {
            isReversal: false,
            paymentDate: {
              gte: startOfMonth(now),
              lte: endOfMonth(now),
            },
          },
        }),
        prisma.subscriptionInvoice.count({
          where: { status: { in: ["UNPAID", "OVERDUE"] } },
        }),
      ]);
      revenueThisMonth = Number(revenueAgg._sum.amount || 0);
      pendingInvoices = pendingCount;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }

    return successResponse({
      totalActive,
      expiringSoon,
      expired,
      trialEnding,
      revenueThisMonth,
      pendingInvoices,
    });
  } catch {
    return internalError("Failed to fetch billing dashboard");
  }
}
