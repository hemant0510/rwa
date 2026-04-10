import {
  internalError,
  notFoundError,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: resident.societyId },
      include: {
        createdByUser: { select: { name: true } },
        petition: {
          select: { id: true, title: true, type: true, status: true },
        },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          include: {
            attachments: true,
            author: { select: { name: true } },
          },
        },
        assignees: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                governingBodyMembership: {
                  select: { designation: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) return notFoundError("Ticket not found");

    return successResponse(ticket);
  } catch (err) {
    console.error("[Resident Support Detail GET]", err);
    return internalError();
  }
}
