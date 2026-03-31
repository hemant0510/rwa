import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// GET /api/v1/super-admin/stats/plan-distribution
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const groups = await prisma.societySubscription.groupBy({
      by: ["planId"],
      where: { status: "ACTIVE", planId: { not: null } },
      _count: { planId: true },
    });

    if (groups.length === 0) return successResponse([]);

    const planIds = groups.map((g) => g.planId).filter(Boolean) as string[];
    const plans = await prisma.platformPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true },
    });

    const planMap = new Map(plans.map((p) => [p.id, p.name]));
    const total = groups.reduce((sum, g) => sum + g._count.planId, 0);

    const data = groups
      .map((g) => ({
        planId: g.planId ?? "",
        planName: planMap.get(g.planId ?? "") ?? "Unknown",
        count: g._count.planId,
        percentage: total > 0 ? Math.round((g._count.planId / total) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return successResponse(data);
  } catch {
    return internalError("Failed to fetch plan distribution");
  }
}
