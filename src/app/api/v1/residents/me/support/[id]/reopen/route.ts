import {
  errorResponse,
  internalError,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: resident.societyId },
      select: { id: true, status: true, createdBy: true, resolvedAt: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    if (ticket.createdBy !== resident.userId) {
      return errorResponse({
        code: "FORBIDDEN",
        message: "Only ticket creator can reopen",
        status: 403,
      });
    }

    if (ticket.status !== "RESOLVED") {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Only resolved tickets can be reopened",
        status: 400,
      });
    }

    if (
      ticket.resolvedAt &&
      Date.now() - new Date(ticket.resolvedAt).getTime() > REOPEN_WINDOW_MS
    ) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Reopen window has expired (7 days). Please create a new ticket.",
        status: 400,
      });
    }

    const updated = await prisma.residentTicket.update({
      where: { id },
      data: { status: "OPEN", resolvedAt: null },
    });

    await logAudit({
      actionType: "RESIDENT_TICKET_REOPENED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      oldValue: { status: "RESOLVED" },
      newValue: { status: "OPEN" },
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[Resident Support Reopen POST]", err);
    return internalError();
  }
}
