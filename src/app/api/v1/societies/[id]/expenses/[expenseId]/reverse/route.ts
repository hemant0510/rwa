import { NextRequest, NextResponse } from "next/server";

import { parseBody, notFoundError, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { reverseExpenseSchema } from "@/lib/validations/expense";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  try {
    const { id: societyId, expenseId } = await params;
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

    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "REVERSED",
        reversalNote: data.reason,
        reversedAt: new Date(),
      },
    });

    return NextResponse.json({ message: "Expense reversed" });
  } catch {
    return internalError("Failed to reverse expense");
  }
}
