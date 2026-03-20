import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

// POST /api/cron/fee-overdue-check
// Flips PENDING → OVERDUE for fees whose grace period has passed.
// Run daily; effective the day after gracePeriodEnd (e.g. April 16).
export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.membershipFee.updateMany({
      where: {
        status: "PENDING",
        gracePeriodEnd: { lt: today },
      },
      data: { status: "OVERDUE" },
    });

    return successResponse({ markedOverdue: result.count });
  } catch {
    return internalError("Failed to mark overdue fees");
  }
}
