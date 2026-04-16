import { forbiddenError, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const entity = await prisma.serviceRequest.findUnique({
      where: { id },
      select: { societyId: true },
    });
    if (!entity) return notFoundError("Request not found");

    const admin = await getAdminContext(entity.societyId);
    if (!admin) return forbiddenError("Admin access required");

    const request = await prisma.serviceRequest.findUnique({
      where: { id },
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
