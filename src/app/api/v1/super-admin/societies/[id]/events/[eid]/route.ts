import { type NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; eid: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId, eid } = await params;

    const event = await prisma.communityEvent.findUnique({
      where: { id: eid },
      include: {
        creator: { select: { name: true } },
        registrations: {
          include: {
            user: { select: { name: true, email: true, mobile: true } },
            payment: true,
          },
          orderBy: { registeredAt: "asc" },
        },
      },
    });

    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    const [expenseResult, paymentResult] = await Promise.all([
      prisma.expense.aggregate({
        where: { eventId: eid, status: "ACTIVE" },
        _sum: { amount: true },
      }),
      prisma.eventPayment.aggregate({
        where: { registration: { eventId: eid } },
        _sum: { amount: true },
      }),
    ]);

    const totalCollected = Number(paymentResult._sum.amount ?? 0);
    const totalExpenses = Number(expenseResult._sum.amount ?? 0);

    return successResponse({
      ...event,
      financeSummary: {
        totalCollected,
        totalExpenses,
        netAmount: totalCollected - totalExpenses,
      },
    });
  } catch (err) {
    console.error("[SA Event Detail]", err);
    return internalError();
  }
}
