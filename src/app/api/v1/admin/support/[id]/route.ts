import { forbiddenError, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    const { id } = await params;

    const request = await prisma.serviceRequest.findUnique({
      where: { id, societyId: user.societyId },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
        createdByUser: { select: { name: true } },
      },
    });

    if (!request) return notFoundError("Request not found");

    return successResponse(request);
  } catch (err) {
    console.error("[Admin Support Detail]", err);
    return internalError();
  }
}
