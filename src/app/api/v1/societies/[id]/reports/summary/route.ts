import { NextRequest, NextResponse } from "next/server";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getSessionYear } from "@/lib/fee-calculator";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

// GET /api/v1/societies/[id]/reports/summary?session=2025-26
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser || currentUser.societyId !== societyId) {
      return unauthorizedError("Not authorized");
    }

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { id: true, feeSessionStartMonth: true },
    });

    if (!society) return notFoundError("Society not found");

    const { searchParams } = new URL(request.url);
    const sessionYear =
      searchParams.get("session") ?? getSessionYear(new Date(), society.feeSessionStartMonth ?? 4);

    const [paidCount, pendingCount, totalCollectedAgg, totalOutstandingAgg, expensesAgg] =
      await Promise.all([
        prisma.membershipFee.count({
          where: { societyId, sessionYear, status: "PAID" },
        }),
        prisma.membershipFee.count({
          where: { societyId, sessionYear, status: { in: ["PENDING", "OVERDUE"] } },
        }),
        prisma.membershipFee.aggregate({
          where: { societyId, sessionYear, status: "PAID" },
          _sum: { amountPaid: true },
        }),
        prisma.membershipFee.aggregate({
          where: { societyId, sessionYear, status: { in: ["PENDING", "OVERDUE"] } },
          _sum: { amountDue: true },
        }),
        prisma.expense.aggregate({
          where: { societyId, status: "ACTIVE" },
          _sum: { amount: true },
        }),
      ]);

    const totalCollected = Number(totalCollectedAgg._sum.amountPaid ?? 0);
    const totalOutstanding = Number(totalOutstandingAgg._sum.amountDue ?? 0);
    const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
    const balance = totalCollected - totalExpenses;
    const totalResidents = paidCount + pendingCount;

    return NextResponse.json({
      sessionYear,
      totalResidents,
      paidCount,
      pendingCount,
      totalCollected,
      totalOutstanding,
      totalExpenses,
      balance,
    });
  } catch {
    return internalError("Failed to fetch report summary");
  }
}
