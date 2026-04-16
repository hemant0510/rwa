import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const admin = await getAdminContext(searchParams.get("societyId"));
    if (!admin) return forbiddenError("Admin access required");

    // Count requests where SA has replied (AWAITING_ADMIN status)
    const count = await prisma.serviceRequest.count({
      where: {
        societyId: admin.societyId,
        status: "AWAITING_ADMIN",
      },
    });

    return successResponse({ count });
  } catch (err) {
    console.error("[Admin Support Unread Count]", err);
    return internalError();
  }
}
