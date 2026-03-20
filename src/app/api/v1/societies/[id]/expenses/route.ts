import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createExpenseSchema } from "@/lib/validations/expense";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { societyId };
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          logger: { select: { name: true } },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return internalError("Failed to fetch expenses");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const { data, error } = await parseBody(request, createExpenseSchema);
    if (error) return error;
    if (!data) return internalError();

    const expense = await prisma.expense.create({
      data: {
        societyId,
        date: new Date(data.date),
        amount: data.amount,
        category: data.category,
        description: data.description,
        loggedBy: admin.userId,
        correctionWindowEnds: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Non-blocking audit log
    void logAudit({
      actionType: "EXPENSE_CREATED",
      userId: admin.userId,
      societyId,
      entityType: "Expense",
      entityId: expense.id,
      newValue: { category: data.category, amount: data.amount, description: data.description },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch {
    return internalError("Failed to create expense");
  }
}
