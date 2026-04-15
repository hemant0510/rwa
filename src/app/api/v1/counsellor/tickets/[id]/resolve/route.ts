import { NextRequest } from "next/server";

import {
  errorResponse,
  internalError,
  notFoundError,
  successResponse,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { isValidEscalationTransition, resolveEscalationSchema } from "@/lib/validations/escalation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: escalationId } = await params;
  const counsellorId = auth.data.counsellorId;

  const body = await request.json();
  const parsed = resolveEscalationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const escalation = await prisma.residentTicketEscalation.findFirst({
      where: { id: escalationId, counsellorId },
      select: { id: true, status: true, ticket: { select: { id: true, societyId: true } } },
    });

    if (!escalation) return notFoundError("Escalation not found");

    if (!isValidEscalationTransition(escalation.status, "RESOLVED_BY_COUNSELLOR")) {
      return errorResponse({
        code: "INVALID_TRANSITION",
        message: `Cannot resolve an escalation in status ${escalation.status}`,
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.residentTicketEscalation.update({
        where: { id: escalationId },
        data: { status: "RESOLVED_BY_COUNSELLOR", resolvedAt: new Date() },
        select: { id: true, status: true, resolvedAt: true },
      });

      const message = await tx.residentTicketMessage.create({
        data: {
          ticketId: escalation.ticket.id,
          authorId: null,
          authorRole: "COUNSELLOR",
          counsellorId,
          content: parsed.data.summary,
          kind: "ADVISORY_TO_ADMIN",
          isInternal: false,
        },
        select: { id: true },
      });

      return { updated, messageId: message.id };
    });

    await logAudit({
      actionType: "TICKET_ESCALATION_RESOLVED",
      userId: auth.data.authUserId,
      societyId: escalation.ticket.societyId,
      entityType: "ResidentTicketEscalation",
      entityId: escalationId,
      newValue: { advisoryMessageId: result.messageId },
    });

    return successResponse(result.updated);
  } catch (err) {
    console.error("[Counsellor Resolve POST]", err);
    return internalError("Failed to resolve escalation");
  }
}
