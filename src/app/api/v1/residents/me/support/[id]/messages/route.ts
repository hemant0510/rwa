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
import { createResidentTicketMessageSchema } from "@/lib/validations/resident-support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: resident.societyId },
      select: { id: true, status: true, createdBy: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    if (ticket.createdBy !== resident.userId) {
      return errorResponse({
        code: "FORBIDDEN",
        message: "Only ticket creator can post messages",
        status: 403,
      });
    }

    if (ticket.status === "CLOSED") {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Cannot post message to a closed ticket",
        status: 400,
      });
    }

    const body = await request.json();
    const parsed = createResidentTicketMessageSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const message = await prisma.residentTicketMessage.create({
      data: {
        ticketId: id,
        authorId: resident.userId,
        authorRole: "RESIDENT",
        content: parsed.data.content,
      },
    });

    // Auto-transition AWAITING_RESIDENT -> AWAITING_ADMIN when resident replies
    if (ticket.status === "AWAITING_RESIDENT") {
      await prisma.residentTicket.update({
        where: { id },
        data: { status: "AWAITING_ADMIN" },
      });
    }

    await logAudit({
      actionType: "RESIDENT_TICKET_MESSAGE_SENT",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "ResidentTicketMessage",
      entityId: message.id,
    });

    return successResponse(message, 201);
  } catch (err) {
    console.error("[Resident Support Message POST]", err);
    return internalError();
  }
}
