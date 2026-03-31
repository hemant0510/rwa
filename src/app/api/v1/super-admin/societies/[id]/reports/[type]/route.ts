import { type NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { getSessionYear } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; type: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId, type } = await params;
    const session = new URL(req.url).searchParams.get("session") || getSessionYear(new Date());

    switch (type) {
      case "collection-summary": {
        const [paidAgg, pendingAgg, expensesAgg] = await Promise.all([
          prisma.membershipFee.aggregate({
            where: { societyId, sessionYear: session, status: "PAID" },
            _sum: { amountPaid: true },
            _count: true,
          }),
          prisma.membershipFee.aggregate({
            where: { societyId, sessionYear: session, status: { in: ["PENDING", "OVERDUE"] } },
            _sum: { amountDue: true },
            _count: true,
          }),
          prisma.expense.aggregate({
            where: { societyId, status: "ACTIVE", eventId: null },
            _sum: { amount: true },
          }),
        ]);

        const totalCollected = Number(paidAgg._sum.amountPaid ?? 0);
        const totalOutstanding = Number(pendingAgg._sum.amountDue ?? 0);
        const totalExpenses = Number(expensesAgg._sum.amount ?? 0);

        return successResponse({
          type: "collection-summary",
          sessionYear: session,
          paidCount: paidAgg._count,
          pendingCount: pendingAgg._count,
          totalCollected,
          totalOutstanding,
          totalExpenses,
          balance: totalCollected - totalExpenses,
        });
      }

      case "expense-summary": {
        const breakdown = await prisma.expense.groupBy({
          by: ["category"],
          where: { societyId, status: "ACTIVE", eventId: null },
          _sum: { amount: true },
          _count: true,
          orderBy: { _sum: { amount: "desc" } },
        });
        const total = breakdown.reduce((s, c) => s + Number(c._sum.amount || 0), 0);

        return successResponse({
          type: "expense-summary",
          total,
          breakdown: breakdown.map((c) => ({
            category: c.category,
            amount: Number(c._sum.amount || 0),
            count: c._count,
          })),
        });
      }

      default:
        return notFoundError(`Report type "${type}" not supported`);
    }
  } catch (err) {
    console.error("[SA Reports]", err);
    return internalError();
  }
}
