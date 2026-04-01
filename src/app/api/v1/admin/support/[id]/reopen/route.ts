import { errorResponse, forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    const { id } = await params;

    const request = await prisma.serviceRequest.findUnique({
      where: { id, societyId: user.societyId },
      select: { id: true, status: true, resolvedAt: true },
    });

    if (!request)
      return errorResponse({ code: "NOT_FOUND", message: "Request not found", status: 404 });

    if (request.status !== "RESOLVED")
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Only RESOLVED requests can be reopened",
        status: 400,
      });

    // Check 7-day reopen window
    if (request.resolvedAt) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (new Date(request.resolvedAt) < sevenDaysAgo) {
        return errorResponse({
          code: "BAD_REQUEST",
          message: "Reopen window (7 days) has expired. Please create a new request.",
          status: 400,
        });
      }
    }

    await prisma.serviceRequest.update({
      where: { id },
      data: { status: "OPEN", resolvedAt: null },
    });

    return successResponse({ success: true });
  } catch (err) {
    console.error("[Admin Support Reopen]", err);
    return internalError();
  }
}
