import { NextRequest } from "next/server";

import { internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { reorderPlansSchema } from "@/lib/validations/plan";

// POST /api/v1/super-admin/plans/reorder
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, reorderPlansSchema);
    if (error) return error;
    if (!data) return internalError();

    await prisma.$transaction(
      data.order.map(({ id, displayOrder }) =>
        prisma.platformPlan.update({ where: { id }, data: { displayOrder } }),
      ),
    );

    return successResponse({ success: true });
  } catch {
    return internalError("Failed to reorder plans");
  }
}
