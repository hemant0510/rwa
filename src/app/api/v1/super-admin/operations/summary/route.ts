import { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalResidents,
      collectionAgg,
      dueAgg,
      totalExpensesThisMonth,
      activeEvents,
      activePetitions,
      broadcastsThisMonth,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: "RESIDENT", status: { not: "REJECTED" } },
      }),
      prisma.membershipFee.aggregate({
        _sum: { amountPaid: true },
      }),
      prisma.membershipFee.aggregate({
        _sum: { amountDue: true },
      }),
      prisma.expense.aggregate({
        where: { createdAt: { gte: monthStart }, status: "ACTIVE" },
        _sum: { amount: true },
      }),
      prisma.communityEvent.count({ where: { status: "PUBLISHED" } }),
      prisma.petition.count({ where: { status: "PUBLISHED" } }),
      prisma.broadcast.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    const totalCollected = Number(collectionAgg._sum.amountPaid || 0);
    const totalDue = Number(dueAgg._sum.amountDue || 0);
    const collectionRate = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;

    return successResponse({
      totalResidents,
      collectionRate: Math.round(collectionRate * 100) / 100,
      totalExpensesThisMonth: Number(totalExpensesThisMonth._sum.amount || 0),
      activeEvents,
      activePetitions,
      broadcastsThisMonth,
    });
  } catch (err) {
    console.error("[SA Operations Summary]", err);
    return internalError();
  }
}
