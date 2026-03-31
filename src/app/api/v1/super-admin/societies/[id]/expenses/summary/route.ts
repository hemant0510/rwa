import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId } = await params;
    const generalExpenseFilter = { societyId, status: "ACTIVE" as const, eventId: null };

    const [categoryBreakdown, totalExpenses, totalCollected] = await Promise.all([
      prisma.expense.groupBy({
        by: ["category"],
        where: generalExpenseFilter,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.expense.aggregate({ where: generalExpenseFilter, _sum: { amount: true } }),
      prisma.membershipFee.aggregate({ where: { societyId }, _sum: { amountPaid: true } }),
    ]);

    const expenses = Number(totalExpenses._sum.amount || 0);
    const collected = Number(totalCollected._sum.amountPaid || 0);

    return successResponse({
      totalExpenses: expenses,
      totalCollected: collected,
      balanceInHand: collected - expenses,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        total: Number(c._sum.amount || 0),
        count: c._count,
        percentage: expenses > 0 ? Math.round((Number(c._sum.amount || 0) / expenses) * 100) : 0,
      })),
    });
  } catch (err) {
    console.error("[SA Expenses Summary]", err);
    return internalError();
  }
}
