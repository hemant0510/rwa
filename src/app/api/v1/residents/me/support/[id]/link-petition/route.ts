import {
  errorResponse,
  internalError,
  successResponse,
  unauthorizedError,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { linkPetitionSchema } from "@/lib/validations/resident-support";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: resident.societyId },
      select: { id: true, societyId: true, createdBy: true, status: true, petitionId: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    if (ticket.createdBy !== resident.userId) {
      return errorResponse({
        code: "FORBIDDEN",
        message: "Only ticket creator can link petitions",
        status: 403,
      });
    }

    if (ticket.status === "CLOSED") {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Cannot modify a closed ticket",
        status: 400,
      });
    }

    const body = await request.json();
    const parsed = linkPetitionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { petitionId } = parsed.data;

    if (petitionId !== null) {
      const petition = await prisma.petition.findUnique({
        where: { id: petitionId },
        select: { id: true, societyId: true, status: true },
      });

      if (!petition) {
        return errorResponse({ code: "NOT_FOUND", message: "Petition not found", status: 404 });
      }

      if (petition.societyId !== ticket.societyId) {
        return errorResponse({
          code: "BAD_REQUEST",
          message: "Petition must belong to the same society",
          status: 400,
        });
      }

      if (petition.status !== "PUBLISHED" && petition.status !== "SUBMITTED") {
        return errorResponse({
          code: "BAD_REQUEST",
          message: "Can only link published or submitted petitions",
          status: 400,
        });
      }
    }

    const updated = await prisma.residentTicket.update({
      where: { id },
      data: { petitionId },
      include: {
        petition: { select: { id: true, title: true, type: true, status: true } },
      },
    });

    await logAudit({
      actionType: "RESIDENT_TICKET_PETITION_LINKED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      oldValue: { petitionId: ticket.petitionId },
      newValue: { petitionId },
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[Resident Support Link Petition PATCH]", err);
    return internalError();
  }
}
