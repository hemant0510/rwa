import { NextRequest } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

// GET /api/v1/super-admin/billing/expiring?days=30
export async function GET(request: NextRequest) {
  try {
    const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + (Number.isNaN(days) ? 30 : days));

    const rows = await prisma.societySubscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { gte: now, lte: end },
      },
      include: {
        society: { select: { id: true, name: true, societyCode: true } },
        plan: { select: { name: true } },
      },
      orderBy: { currentPeriodEnd: "asc" },
    });

    return successResponse(
      rows.map((row) => ({
        societyId: row.societyId,
        societyName: row.society.name,
        societyCode: row.society.societyCode,
        planName: row.plan?.name ?? "Trial",
        currentPeriodEnd: row.currentPeriodEnd,
      })),
    );
  } catch {
    return internalError("Failed to fetch expiring subscriptions");
  }
}
