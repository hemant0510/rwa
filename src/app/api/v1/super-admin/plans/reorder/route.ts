import { NextRequest } from "next/server";

import { internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { reorderPlansSchema } from "@/lib/validations/plan";

// POST /api/v1/super-admin/plans/reorder
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, reorderPlansSchema);
    if (error) return error;
    if (!data) return internalError();

    await prisma.$transaction(
      data.order.map(({ id, displayOrder }) =>
        prisma.platformPlan.update({ where: { id }, data: { displayOrder } }),
      ),
    );

    void logAudit({
      actionType: "SA_PLAN_REORDERED",
      userId: auth.data.superAdminId,
      entityType: "PlatformPlan",
      entityId: "batch",
      newValue: { order: data.order },
    });

    return successResponse({ success: true });
  } catch {
    return internalError("Failed to reorder plans");
  }
}
