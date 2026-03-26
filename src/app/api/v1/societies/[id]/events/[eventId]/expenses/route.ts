import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { addEventExpenseSchema } from "@/lib/validations/event";

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

    if (event.status !== "PUBLISHED" && event.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATUS",
            message: "Expenses can only be added to PUBLISHED or COMPLETED events",
          },
        },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, addEventExpenseSchema);
    if (error) return error;
    if (!data) return internalError();

    const expense = await prisma.expense.create({
      data: {
        societyId,
        date: new Date(data.date),
        amount: data.amount,
        category: data.category,
        description: data.description,
        receiptUrl: data.receiptUrl ?? null,
        loggedBy: admin.userId,
        eventId,
        correctionWindowEnds: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    void logAudit({
      actionType: "EVENT_EXPENSE_ADDED",
      userId: admin.userId,
      societyId,
      entityType: "Expense",
      entityId: expense.id,
      newValue: { eventId, amount: data.amount, description: data.description },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch {
    return internalError("Failed to add event expense");
  }
}
