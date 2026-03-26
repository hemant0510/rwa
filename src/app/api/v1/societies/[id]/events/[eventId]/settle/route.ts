import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { settleEventSchema } from "@/lib/validations/event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const { id: societyId, eventId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    if (event.status !== "COMPLETED") {
      return NextResponse.json(
        { error: { code: "NOT_COMPLETED", message: "Only COMPLETED events can be settled" } },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, settleEventSchema);
    if (error) return error;
    if (!data) return internalError();

    // Calculate current financial state
    const [paymentAgg, expenseAgg] = await Promise.all([
      prisma.eventPayment.aggregate({
        where: { registration: { eventId } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { eventId, status: "ACTIVE" },
        _sum: { amount: true },
      }),
    ]);

    const totalCollected = Number(paymentAgg._sum.amount ?? 0);
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0);
    const surplusAmount = totalCollected - totalExpenses;

    const updated = await prisma.communityEvent.update({
      where: { id: eventId },
      data: {
        settledAt: new Date(),
        surplusAmount,
        surplusDisposal: surplusAmount > 0 ? (data.surplusDisposal ?? null) : null,
        deficitDisposition: surplusAmount < 0 ? (data.deficitDisposition ?? null) : null,
        settlementNotes: data.notes ?? null,
      },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "EVENT_SETTLED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      newValue: { surplusAmount, totalCollected, totalExpenses },
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to settle event");
  }
}
