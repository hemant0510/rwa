import { NextRequest } from "next/server";

import { errorResponse, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireCounsellor } from "@/lib/auth-guard";
import { logCounsellorAudit } from "@/lib/counsellor/audit";
import { prisma } from "@/lib/prisma";
import { isValidEscalationTransition } from "@/lib/validations/escalation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: escalationId } = await params;
  const counsellorId = auth.data.counsellorId;

  try {
    const escalation = await prisma.residentTicketEscalation.findFirst({
      where: { id: escalationId, counsellorId },
      select: { id: true, status: true, ticket: { select: { societyId: true } } },
    });

    if (!escalation) return notFoundError("Escalation not found");

    if (!isValidEscalationTransition(escalation.status, "ACKNOWLEDGED")) {
      return errorResponse({
        code: "INVALID_TRANSITION",
        message: `Cannot acknowledge an escalation in status ${escalation.status}`,
        status: 400,
      });
    }

    const updated = await prisma.residentTicketEscalation.update({
      where: { id: escalationId },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
      select: { id: true, status: true, acknowledgedAt: true },
    });

    await logAudit({
      actionType: "TICKET_ESCALATION_ACKNOWLEDGED",
      userId: auth.data.authUserId,
      societyId: escalation.ticket.societyId,
      entityType: "ResidentTicketEscalation",
      entityId: escalationId,
    });

    void logCounsellorAudit({
      counsellorId,
      actionType: "COUNSELLOR_ACKNOWLEDGE_ESCALATION",
      entityType: "ResidentTicketEscalation",
      entityId: escalationId,
      societyId: escalation.ticket.societyId,
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[Counsellor Acknowledge POST]", err);
    return internalError("Failed to acknowledge escalation");
  }
}
