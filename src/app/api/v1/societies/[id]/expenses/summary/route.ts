import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    // Exclude event-linked expenses from society balance — event finances are self-contained
    const generalExpenseFilter = { societyId, status: "ACTIVE" as const, eventId: null };

    const [categoryBreakdown, totalExpenses, totalCollected] = await Promise.all([
      prisma.expense.groupBy({
        by: ["category"],
        where: generalExpenseFilter,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.expense.aggregate({
        where: generalExpenseFilter,
        _sum: { amount: true },
      }),
      prisma.membershipFee.aggregate({
        where: { societyId },
        _sum: { amountPaid: true },
      }),
    ]);

    const expenses = Number(totalExpenses._sum.amount || 0);
    const collected = Number(totalCollected._sum.amountPaid || 0);

    return NextResponse.json({
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
  } catch {
    return internalError("Failed to fetch expense summary");
  }
}
