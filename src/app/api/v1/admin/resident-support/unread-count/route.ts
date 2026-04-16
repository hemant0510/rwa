import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const admin = await getAdminContext(searchParams.get("societyId"));
    if (!admin) return forbiddenError("Admin access required");

    const count = await prisma.residentTicket.count({
      where: {
        societyId: admin.societyId,
        status: "AWAITING_ADMIN",
      },
    });

    return successResponse({ count });
  } catch (err) {
    console.error("[Admin Resident Support Unread Count GET]", err);
    return internalError();
  }
}
