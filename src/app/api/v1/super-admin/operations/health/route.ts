import { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

interface SocietyHealthRow {
  id: string;
  name: string;
  status: string;
  residents: number;
  collectionRate: number;
  balance: number;
  events30d: number;
  petitions30d: number;
  lastAdminLogin: string | null;
  healthScore: number;
}

function computeHealthScore(
  collectionRate: number,
  lastAdminLoginDaysAgo: number | null,
  residentGrowthPct: number,
  engagementCount: number,
  balance: number,
): number {
  const collectionComponent = Math.min(collectionRate, 100) * 0.3;

  let adminScore = 0;
  if (lastAdminLoginDaysAgo === null) {
    adminScore = 0;
  } else if (lastAdminLoginDaysAgo <= 3) {
    adminScore = 100;
  } else if (lastAdminLoginDaysAgo <= 7) {
    adminScore = 70;
  } else if (lastAdminLoginDaysAgo <= 14) {
    adminScore = 40;
  } else {
    adminScore = 10;
  }
  const adminComponent = adminScore * 0.25;

  const growthScore = Math.min(Math.max(residentGrowthPct, 0), 100);
  const growthComponent = growthScore * 0.15;

  const engagementScore = Math.min(engagementCount * 20, 100);
  const engagementComponent = engagementScore * 0.15;

  const balanceScore = balance > 0 ? 100 : balance === 0 ? 50 : 0;
  const balanceComponent = balanceScore * 0.15;

  return Math.round(
    collectionComponent + adminComponent + growthComponent + engagementComponent + balanceComponent,
  );
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const societies = await prisma.society.findMany({
      where: { status: { not: "OFFBOARDED" } },
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    const healthRows: SocietyHealthRow[] = await Promise.all(
      societies.map(async (society) => {
        const [
          residentCount,
          feeAgg,
          dueAgg,
          expenseAgg,
          incomeAgg,
          events30d,
          petitions30d,
          lastAdmin,
          newResidents30d,
        ] = await Promise.all([
          prisma.user.count({
            where: {
              societyId: society.id,
              role: "RESIDENT",
              status: { not: "REJECTED" },
            },
          }),
          prisma.membershipFee.aggregate({
            where: { societyId: society.id },
            _sum: { amountPaid: true },
          }),
          prisma.membershipFee.aggregate({
            where: { societyId: society.id },
            _sum: { amountDue: true },
          }),
          prisma.expense.aggregate({
            where: { societyId: society.id, status: "ACTIVE" },
            _sum: { amount: true },
          }),
          prisma.feePayment.aggregate({
            where: { societyId: society.id, isReversal: false },
            _sum: { amount: true },
          }),
          prisma.communityEvent.count({
            where: { societyId: society.id, createdAt: { gte: thirtyDaysAgo } },
          }),
          prisma.petition.count({
            where: { societyId: society.id, createdAt: { gte: thirtyDaysAgo } },
          }),
          prisma.user.findFirst({
            where: {
              societyId: society.id,
              role: "RWA_ADMIN",
            },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
          prisma.user.count({
            where: {
              societyId: society.id,
              role: "RESIDENT",
              createdAt: { gte: thirtyDaysAgo },
            },
          }),
        ]);

        const totalPaid = Number(feeAgg._sum.amountPaid || 0);
        const totalDue = Number(dueAgg._sum.amountDue || 0);
        const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

        const totalIncome = Number(incomeAgg._sum.amount || 0);
        const totalExpense = Number(expenseAgg._sum.amount || 0);
        const balance = totalIncome - totalExpense;

        const lastAdminLogin = lastAdmin?.updatedAt ?? null;
        const daysAgo =
          lastAdminLogin !== null
            ? Math.floor(
                (now.getTime() - new Date(lastAdminLogin).getTime()) / (1000 * 60 * 60 * 24),
              )
            : null;

        const residentGrowthPct = residentCount > 0 ? (newResidents30d / residentCount) * 100 : 0;

        const healthScore = computeHealthScore(
          collectionRate,
          daysAgo,
          residentGrowthPct,
          events30d + petitions30d,
          balance,
        );

        return {
          id: society.id,
          name: society.name,
          status: society.status,
          residents: residentCount,
          collectionRate: Math.round(collectionRate * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          events30d,
          petitions30d,
          lastAdminLogin: lastAdminLogin ? new Date(lastAdminLogin).toISOString() : null,
          healthScore,
        };
      }),
    );

    healthRows.sort((a, b) => b.healthScore - a.healthScore);

    return successResponse({ societies: healthRows });
  } catch (err) {
    console.error("[SA Operations Health]", err);
    return internalError();
  }
}

export { computeHealthScore };
