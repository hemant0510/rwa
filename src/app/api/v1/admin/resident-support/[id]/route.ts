import { forbiddenError, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      include: {
        createdByUser: {
          select: {
            name: true,
            email: true,
            mobile: true,
            userUnits: { select: { unit: { select: { displayLabel: true } } }, take: 1 },
          },
        },
        petition: {
          select: { id: true, title: true, type: true, status: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { attachments: true },
        },
      },
    });

    if (!ticket) return notFoundError("Ticket not found");

    return successResponse(ticket);
  } catch (err) {
    console.error("[Admin Resident Support Detail GET]", err);
    return internalError();
  }
}
