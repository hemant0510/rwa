import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { updateEventSchema } from "@/lib/validations/event";

type RouteParams = { params: Promise<{ id: string; eventId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, eventId } = await params;

    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
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

    // Compute financial summary
    const [expenseResult, paymentResult] = await Promise.all([
      prisma.expense.aggregate({
        where: { eventId, status: "ACTIVE" },
        _sum: { amount: true },
      }),
      prisma.eventPayment.aggregate({
        where: { registration: { eventId } },
        _sum: { amount: true },
      }),
    ]);

    const totalCollected = Number(paymentResult._sum.amount ?? 0);
    const totalExpenses = Number(expenseResult._sum.amount ?? 0);

    return NextResponse.json({
      ...event,
      financeSummary: {
        totalCollected,
        totalExpenses,
        netAmount: totalCollected - totalExpenses,
      },
    });
  } catch {
    return internalError("Failed to fetch event");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, eventId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    if (event.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "NOT_DRAFT", message: "Only DRAFT events can be edited" } },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, updateEventSchema);
    if (error) return error;
    if (!data) return internalError();

    // Recompute chargeUnit if feeModel is being changed to FREE
    const feeModel = data.feeModel ?? event.feeModel;
    const chargeUnit = feeModel === "FREE" ? "PER_HOUSEHOLD" : (data.chargeUnit ?? undefined);

    const updated = await prisma.communityEvent.update({
      where: { id: eventId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.feeModel !== undefined && { feeModel: data.feeModel }),
        ...(chargeUnit !== undefined && { chargeUnit }),
        ...(data.eventDate !== undefined && { eventDate: new Date(data.eventDate) }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.registrationDeadline !== undefined && {
          registrationDeadline: data.registrationDeadline
            ? new Date(data.registrationDeadline)
            : null,
        }),
        ...(data.feeAmount !== undefined && { feeAmount: data.feeAmount }),
        ...(data.estimatedBudget !== undefined && { estimatedBudget: data.estimatedBudget }),
        ...(data.minParticipants !== undefined && { minParticipants: data.minParticipants }),
        ...(data.maxParticipants !== undefined && { maxParticipants: data.maxParticipants }),
        ...(data.suggestedAmount !== undefined && { suggestedAmount: data.suggestedAmount }),
      },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "EVENT_UPDATED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      newValue: JSON.parse(JSON.stringify(data)),
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to update event");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, eventId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    if (event.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "NOT_DRAFT", message: "Only DRAFT events can be deleted" } },
        { status: 400 },
      );
    }

    await prisma.communityEvent.delete({ where: { id: eventId } });

    void logAudit({
      actionType: "EVENT_DELETED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      oldValue: { title: event.title },
    });

    return NextResponse.json({ message: "Event deleted" });
  } catch {
    return internalError("Failed to delete event");
  }
}
