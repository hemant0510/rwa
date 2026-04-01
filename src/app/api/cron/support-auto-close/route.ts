import { internalError, successResponse, unauthorizedError } from "@/lib/api-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedError("Invalid cron secret");
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await prisma.serviceRequest.updateMany({
      where: {
        status: "RESOLVED",
        resolvedAt: { lt: sevenDaysAgo },
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedReason: "Auto-closed after 7 days in RESOLVED status",
      },
    });

    return successResponse({ closed: result.count });
  } catch (err) {
    console.error("[Cron Support Auto-Close]", err);
    return internalError();
  }
}
