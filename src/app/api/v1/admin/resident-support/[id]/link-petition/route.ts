import {
  errorResponse,
  forbiddenError,
  internalError,
  successResponse,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { linkPetitionSchema } from "@/lib/validations/resident-support";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to link petitions");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true, societyId: true, petitionId: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const body = await request.json();
    const parsed = linkPetitionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { petitionId } = parsed.data;

    if (petitionId !== null) {
      const petition = await prisma.petition.findUnique({
        where: { id: petitionId },
        select: { id: true, societyId: true },
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
      // Admin can link any petition including DRAFT — no status check
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
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      oldValue: { petitionId: ticket.petitionId },
      newValue: { petitionId },
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[Admin Resident Support Link Petition PATCH]", err);
    return internalError();
  }
}
