import {
  errorResponse,
  forbiddenError,
  internalError,
  notFoundError,
  successResponse,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { computeSlaDeadline } from "@/lib/counsellor/sla";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { escalateTicketSchema } from "@/lib/validations/escalation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");
    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to escalate");
    }

    const { id: ticketId } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id: ticketId, societyId: admin.societyId },
      select: { id: true, subject: true },
    });
    if (!ticket) return notFoundError("Ticket not found");

    const body = await request.json();
    const parsed = escalateTicketSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const assignment = await prisma.counsellorSocietyAssignment.findFirst({
      where: { societyId: admin.societyId, isActive: true },
      orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
      select: { counsellorId: true },
    });

    if (!assignment) {
      return errorResponse({
        code: "NO_COUNSELLOR_ASSIGNED",
        message: "No counsellor is assigned to this society",
        status: 409,
      });
    }

    const existing = await prisma.residentTicketEscalation.findFirst({
      where: { ticketId, status: { not: "WITHDRAWN" } },
      select: { id: true },
    });
    if (existing) {
      return errorResponse({
        code: "ALREADY_ESCALATED",
        message: "This ticket is already escalated",
        status: 409,
      });
    }

    const escalation = await prisma.residentTicketEscalation.create({
      data: {
        ticketId,
        counsellorId: assignment.counsellorId,
        source: "ADMIN_ASSIGN",
        status: "PENDING",
        reason: parsed.data.reason,
        createdById: admin.userId,
        slaDeadline: computeSlaDeadline(new Date()),
      },
    });

    await logAudit({
      actionType: "TICKET_ESCALATED_BY_ADMIN",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicketEscalation",
      entityId: escalation.id,
      newValue: { ticketId, counsellorId: assignment.counsellorId, reason: parsed.data.reason },
    });

    return successResponse(escalation, 201);
  } catch (err) {
    console.error("[Admin Ticket Escalate POST]", err);
    return internalError();
  }
}
