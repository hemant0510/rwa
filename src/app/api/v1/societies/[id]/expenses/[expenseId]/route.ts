import { NextRequest, NextResponse } from "next/server";

import { parseBody, notFoundError, internalError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { updateExpenseSchema } from "@/lib/validations/expense";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  try {
    const { id: societyId, expenseId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser) return unauthorizedError("Admin authentication required");

    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.societyId !== societyId) return notFoundError("Expense not found");

    if (expense.status === "REVERSED") {
      return NextResponse.json(
        { error: { code: "ALREADY_REVERSED", message: "Reversed expenses cannot be edited" } },
        { status: 400 },
      );
    }

    if (!expense.correctionWindowEnds || new Date() > expense.correctionWindowEnds) {
      return NextResponse.json(
        {
          error: {
            code: "CORRECTION_WINDOW_EXPIRED",
            message: "The 24-hour correction window has expired. Use reversal instead.",
          },
        },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, updateExpenseSchema);
    if (error) return error;
    if (!data) return internalError();

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: { logger: { select: { name: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to update expense");
  }
}
