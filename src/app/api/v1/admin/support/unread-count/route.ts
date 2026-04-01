import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    // Count requests where SA has replied (AWAITING_ADMIN status)
    const count = await prisma.serviceRequest.count({
      where: {
        societyId: user.societyId,
        status: "AWAITING_ADMIN",
      },
    });

    return successResponse({ count });
  } catch (err) {
    console.error("[Admin Support Unread Count]", err);
    return internalError();
  }
}
