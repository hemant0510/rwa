import { internalError, successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const count = await prisma.residentTicket.count({
      where: {
        societyId: resident.societyId,
        createdBy: resident.userId,
        status: "AWAITING_RESIDENT",
      },
    });

    return successResponse({ count });
  } catch (err) {
    console.error("[Resident Support Unread Count GET]", err);
    return internalError();
  }
}
