import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

// POST /api/cron/fee-status-activate
// Flips NOT_YET_DUE → PENDING for fees whose session has started.
// Run daily; effective on the session start date (e.g. April 1).
export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.membershipFee.updateMany({
      where: {
        status: "NOT_YET_DUE",
        sessionStart: { lte: today },
      },
      data: { status: "PENDING" },
    });

    return successResponse({ activated: result.count });
  } catch {
    return internalError("Failed to activate fees");
  }
}
