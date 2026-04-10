import { z } from "zod";

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

const createPetitionFromTicketSchema = z.object({
  type: z.enum(["COMPLAINT", "PETITION", "NOTICE"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to create petitions");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true, societyId: true, subject: true, description: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const body = await request.json();
    const parsed = createPetitionFromTicketSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const petition = await prisma.petition.create({
      data: {
        societyId: ticket.societyId,
        title: ticket.subject,
        description: ticket.description,
        type: parsed.data.type,
        status: "DRAFT",
        createdBy: admin.userId,
      },
    });

    const updatedTicket = await prisma.residentTicket.update({
      where: { id },
      data: { petitionId: petition.id },
      include: {
        petition: { select: { id: true, title: true, type: true, status: true } },
      },
    });

    await logAudit({
      actionType: "PETITION_CREATED",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "Petition",
      entityId: petition.id,
      newValue: { title: petition.title, type: petition.type, fromTicket: id },
    });

    return successResponse({ petition, ticket: updatedTicket }, 201);
  } catch (err) {
    console.error("[Admin Resident Support Create Petition POST]", err);
    return internalError();
  }
}
