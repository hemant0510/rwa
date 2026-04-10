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
import { changeResidentTicketPrioritySchema } from "@/lib/validations/resident-support";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to change priority");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true, priority: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const body = await request.json();
    const parsed = changeResidentTicketPrioritySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.residentTicket.update({
      where: { id },
      data: { priority: parsed.data.priority },
    });

    await logAudit({
      actionType: "RESIDENT_TICKET_PRIORITY_CHANGED",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      oldValue: { priority: ticket.priority },
      newValue: { priority: parsed.data.priority },
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[Admin Resident Support Priority PATCH]", err);
    return internalError();
  }
}
