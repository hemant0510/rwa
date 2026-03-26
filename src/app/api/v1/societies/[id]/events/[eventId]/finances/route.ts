import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const { id: societyId, eventId } = await params;

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    const [paymentAgg, expenses, pendingRegs] = await Promise.all([
      prisma.eventPayment.aggregate({
        where: { registration: { eventId } },
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        where: { eventId, status: "ACTIVE" },
        select: { id: true, description: true, amount: true, category: true, date: true },
        orderBy: { date: "asc" },
      }),
      // Count pending amount: registrations with PENDING status that have no payment
      event.feeModel !== "FREE" && event.feeModel !== "CONTRIBUTION" && event.feeAmount
        ? prisma.eventRegistration.findMany({
            where: { eventId, status: "PENDING" },
            select: { memberCount: true },
          })
        : Promise.resolve([]),
    ]);

    const totalCollected = Number(paymentAgg._sum.amount ?? 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Calculate pending amount
    let pendingAmount = 0;
    if (event.feeAmount && Array.isArray(pendingRegs)) {
      for (const reg of pendingRegs) {
        pendingAmount +=
          event.chargeUnit === "PER_PERSON"
            ? Number(event.feeAmount) * reg.memberCount
            : Number(event.feeAmount);
      }
    }

    return NextResponse.json({
      totalCollected,
      pendingAmount,
      totalExpenses,
      netAmount: totalCollected - totalExpenses,
      expenses,
      isSettled: event.settledAt !== null,
      settledAt: event.settledAt,
      surplusAmount: event.surplusAmount ? Number(event.surplusAmount) : null,
      surplusDisposal: event.surplusDisposal,
      deficitDisposition: event.deficitDisposition,
      settlementNotes: event.settlementNotes,
    });
  } catch {
    return internalError("Failed to fetch event finances");
  }
}
