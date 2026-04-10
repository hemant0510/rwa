import { type NextRequest } from "next/server";

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
import { assignTicketSchema } from "@/lib/validations/resident-support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to assign members");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const body = await request.json();
    const parsed = assignTicketSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { userId } = parsed.data;

    // Verify the user is a governing body member of this society
    const member = await prisma.governingBodyMember.findFirst({
      where: { userId, societyId: admin.societyId },
    });

    if (!member) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "User is not a governing body member of this society",
        status: 400,
      });
    }

    let assignee;
    try {
      assignee = await prisma.residentTicketAssignee.create({
        data: { ticketId: id, userId, assignedBy: admin.userId },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              governingBodyMembership: {
                select: { designation: { select: { name: true } } },
              },
            },
          },
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") {
        return errorResponse({ code: "CONFLICT", message: "Member already assigned", status: 409 });
      }
      throw e;
    }

    await logAudit({
      actionType: "RESIDENT_TICKET_ASSIGNEE_ADDED",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      newValue: { assignedUserId: userId },
    });

    return successResponse(assignee, 201);
  } catch (err) {
    console.error("[Admin Resident Support Assignees POST]", err);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to remove assignees");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "userId query param required",
        status: 400,
      });
    }

    try {
      await prisma.residentTicketAssignee.delete({
        where: { ticketId_userId: { ticketId: id, userId } },
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2025") {
        return errorResponse({ code: "NOT_FOUND", message: "Assignment not found", status: 404 });
      }
      throw e;
    }

    await logAudit({
      actionType: "RESIDENT_TICKET_ASSIGNEE_REMOVED",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicket",
      entityId: id,
      oldValue: { removedUserId: userId },
    });

    return successResponse({ message: "Assignee removed" });
  } catch (err) {
    console.error("[Admin Resident Support Assignees DELETE]", err);
    return internalError();
  }
}
