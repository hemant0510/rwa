import { NextRequest, NextResponse } from "next/server";

import { parseBody, notFoundError, internalError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { reverseExpenseSchema } from "@/lib/validations/expense";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  try {
    const { id: societyId, expenseId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser) return unauthorizedError("Admin authentication required");

    const { data, error } = await parseBody(request, reverseExpenseSchema);
    if (error) return error;
    if (!data) return internalError();

    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.societyId !== societyId) return notFoundError("Expense not found");

    if (expense.status === "REVERSED") {
      return NextResponse.json(
        { error: { code: "ALREADY_REVERSED", message: "Expense is already reversed" } },
        { status: 400 },
      );
    }

    // Use a transaction: mark original REVERSED + create negative reversal entry
    await prisma.$transaction([
      prisma.expense.update({
        where: { id: expenseId },
        data: {
          status: "REVERSED",
          reversalNote: data.reason,
          reversedAt: new Date(),
          reversedBy: currentUser.userId,
        },
      }),
      prisma.expense.create({
        data: {
          societyId,
          date: new Date(),
          amount: -Number(expense.amount),
          category: expense.category,
          description: `Reversal: ${expense.description}`,
          loggedBy: currentUser.userId,
          reversalNote: data.reason,
          // No correctionWindowEnds — reversal entries cannot be edited
        },
      }),
    ]);

    return NextResponse.json({ message: "Expense reversed" });
  } catch {
    return internalError("Failed to reverse expense");
  }
}
