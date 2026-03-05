import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError } from "@/lib/api-helpers";
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
    const { data, error } = await parseBody(request, createExpenseSchema);
    if (error) return error;
    if (!data) return internalError();

    // Get an admin for this society (TODO: use actual authenticated user)
    const admin = await prisma.user.findFirst({
      where: { societyId, role: "RWA_ADMIN" },
    });

    if (!admin) {
      return NextResponse.json(
        { error: { code: "NO_ADMIN", message: "No admin found for this society" } },
        { status: 400 },
      );
    }

    const expense = await prisma.expense.create({
      data: {
        societyId,
        date: new Date(data.date),
        amount: data.amount,
        category: data.category,
        description: data.description,
        loggedBy: admin.id,
        correctionWindowEnds: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch {
    return internalError("Failed to create expense");
  }
}
