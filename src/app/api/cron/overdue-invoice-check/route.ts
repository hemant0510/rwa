import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

    const now = new Date();
    const result = await prisma.subscriptionInvoice.updateMany({
      where: {
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      data: { status: "OVERDUE" },
    });

    return successResponse({ markedOverdue: result.count });
  } catch {
    return internalError("Failed to mark overdue invoices");
  }
}
