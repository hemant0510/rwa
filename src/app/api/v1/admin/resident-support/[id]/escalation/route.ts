import {
  errorResponse,
  forbiddenError,
  internalError,
  notFoundError,
  successResponse,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { withdrawEscalationSchema } from "@/lib/validations/escalation";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");
    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to withdraw escalation");
    }

    const { id: ticketId } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id: ticketId, societyId: admin.societyId },
      select: { id: true },
    });
    if (!ticket) return notFoundError("Ticket not found");

    const body = await request.json().catch(() => ({}));
    const parsed = withdrawEscalationSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const escalation = await prisma.residentTicketEscalation.findFirst({
      where: {
        ticketId,
        status: { not: "WITHDRAWN" },
      },
      select: { id: true, source: true, status: true },
    });

    if (!escalation) return notFoundError("No active escalation found for this ticket");

    if (escalation.source === "RESIDENT_VOTE") {
      return errorResponse({
        code: "FORBIDDEN",
        message: "Only Super Admin can withdraw a vote-driven escalation",
        status: 403,
      });
    }

    const withdrawn = await prisma.residentTicketEscalation.update({
      where: { id: escalation.id },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
        withdrawnReason: parsed.data.reason ?? null,
      },
    });

    await logAudit({
      actionType: "TICKET_ESCALATION_WITHDRAWN",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicketEscalation",
      entityId: escalation.id,
      oldValue: { status: escalation.status },
      newValue: { status: "WITHDRAWN", reason: parsed.data.reason ?? null },
    });

    return successResponse(withdrawn);
  } catch (err) {
    console.error("[Admin Ticket Escalation DELETE]", err);
    return internalError();
  }
}
