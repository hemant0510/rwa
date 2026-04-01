import { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [open, inProgress, awaitingSA, resolved7d, avgResolution] = await Promise.all([
      prisma.serviceRequest.count({ where: { status: "OPEN" } }),
      prisma.serviceRequest.count({ where: { status: "IN_PROGRESS" } }),
      prisma.serviceRequest.count({ where: { status: "AWAITING_SA" } }),
      prisma.serviceRequest.count({
        where: { status: "RESOLVED", resolvedAt: { gte: sevenDaysAgo } },
      }),
      prisma.serviceRequest.aggregate({
        where: {
          resolvedAt: { not: null, gte: thirtyDaysAgo },
        },
        _avg: { requestNumber: true },
        _count: true,
      }),
    ]);

    // Calculate average resolution time from resolved requests in last 30 days
    let avgResolutionHours: number | null = null;
    if (avgResolution._count > 0) {
      const resolvedRequests = await prisma.serviceRequest.findMany({
        where: {
          resolvedAt: { not: null, gte: thirtyDaysAgo },
        },
        select: { createdAt: true, resolvedAt: true },
      });

      const totalMs = resolvedRequests.reduce((sum, r) => {
        if (!r.resolvedAt) return sum;
        return sum + (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime());
      }, 0);

      avgResolutionHours =
        Math.round((totalMs / resolvedRequests.length / (1000 * 60 * 60)) * 10) / 10;
    }

    return successResponse({
      open,
      inProgress,
      awaitingSA,
      resolved7d,
      avgResolutionHours,
    });
  } catch (err) {
    console.error("[SA Support Stats]", err);
    return internalError();
  }
}
