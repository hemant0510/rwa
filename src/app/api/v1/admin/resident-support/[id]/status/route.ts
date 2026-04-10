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
import {
  changeResidentTicketStatusSchema,
  isValidTransition,
} from "@/lib/validations/resident-support";
import { sendResidentTicketResolved } from "@/lib/whatsapp";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to change status");
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

    const body = await request.json();
    const parsed = changeResidentTicketStatusSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { status: newStatus, reason } = parsed.data;

    if (!isValidTransition(ticket.status, newStatus)) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: `Cannot transition from ${ticket.status} to ${newStatus}`,
        status: 400,
      });
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "RESOLVED") updateData.resolvedAt = new Date();
    if (newStatus === "CLOSED") {
      updateData.closedAt = new Date();
      if (reason) updateData.closedReason = reason;
    }

    const updated = await prisma.residentTicket.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      actionType: "RESIDENT_TICKET_STATUS_CHANGED",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      oldValue: { status: ticket.status },
      newValue: { status: newStatus },
    });

    // Notify ticket creator when resolved (fire-and-forget)
    if (
      newStatus === "RESOLVED" &&
      ticket.createdByUser.mobile &&
      ticket.createdByUser.consentWhatsapp
    ) {
      void sendResidentTicketResolved(
        ticket.createdByUser.mobile,
        ticket.createdByUser.name,
        ticket.subject,
      );
    }

    return successResponse(updated);
  } catch (err) {
    console.error("[Admin Resident Support Status PATCH]", err);
    return internalError();
  }
}
