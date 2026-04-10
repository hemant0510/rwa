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
import { createResidentTicketMessageSchema } from "@/lib/validations/resident-support";
import { sendResidentTicketReply } from "@/lib/whatsapp";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to post messages");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: {
        id: true,
        status: true,
        subject: true,
        createdByUser: { select: { name: true, mobile: true, consentWhatsapp: true } },
      },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

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
        authorId: admin.userId,
        authorRole: "ADMIN",
        content: parsed.data.content,
        isInternal: parsed.data.isInternal,
      },
    });

    // Auto-transition to AWAITING_RESIDENT for non-internal messages
    if (!parsed.data.isInternal && ticket.status !== "AWAITING_RESIDENT") {
      await prisma.residentTicket.update({
        where: { id },
        data: { status: "AWAITING_RESIDENT" },
      });
    }

    await logAudit({
      actionType: "RESIDENT_TICKET_MESSAGE_SENT",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicketMessage",
      entityId: message.id,
    });

    // Notify ticket creator on non-internal admin reply (fire-and-forget)
    if (
      !parsed.data.isInternal &&
      ticket.createdByUser.mobile &&
      ticket.createdByUser.consentWhatsapp
    ) {
      void sendResidentTicketReply(
        ticket.createdByUser.mobile,
        ticket.createdByUser.name,
        ticket.subject,
      );
    }

    return successResponse(message, 201);
  } catch (err) {
    console.error("[Admin Resident Support Message POST]", err);
    return internalError();
  }
}
