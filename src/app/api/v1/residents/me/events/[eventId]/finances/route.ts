import { NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== resident.societyId) return notFoundError("Event not found");

    if (event.status !== "COMPLETED" || !event.settledAt) {
      return forbiddenError("Financial summary is only available after the event is settled");
    }

    const [paymentAgg, expenses] = await Promise.all([
      prisma.eventPayment.aggregate({
        where: { registration: { eventId } },
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        where: { eventId, status: "ACTIVE" },
        select: { description: true, amount: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const totalCollected = Number(paymentAgg._sum.amount ?? 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return NextResponse.json({
      totalCollected,
      totalExpenses,
      netAmount: totalCollected - totalExpenses,
      disposition:
        event.surplusAmount && Number(event.surplusAmount) >= 0
          ? event.surplusDisposal
          : event.deficitDisposition,
      expenses: expenses.map((e) => ({ description: e.description, amount: Number(e.amount) })),
    });
  } catch {
    return internalError("Failed to fetch event finances");
  }
}
