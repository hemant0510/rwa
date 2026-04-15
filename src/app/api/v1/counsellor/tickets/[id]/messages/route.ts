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
import { createCounsellorMessageSchema } from "@/lib/validations/escalation";

type RouteContext = { params: Promise<{ id: string }> };

const CLOSED_STATUSES = ["RESOLVED_BY_COUNSELLOR", "WITHDRAWN"] as const;

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: escalationId } = await params;
  const counsellorId = auth.data.counsellorId;

  const body = await request.json();
  const parsed = createCounsellorMessageSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const escalation = await prisma.residentTicketEscalation.findFirst({
      where: { id: escalationId, counsellorId },
      select: {
        id: true,
        status: true,
        ticket: { select: { id: true, societyId: true } },
      },
    });

    if (!escalation) return notFoundError("Escalation not found");

    if ((CLOSED_STATUSES as readonly string[]).includes(escalation.status)) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: `Cannot post a message on an escalation in status ${escalation.status}`,
        status: 400,
      });
    }

    const message = await prisma.residentTicketMessage.create({
      data: {
        ticketId: escalation.ticket.id,
        authorId: null,
        authorRole: "COUNSELLOR",
        counsellorId,
        content: parsed.data.content,
        kind: parsed.data.kind,
        isInternal: parsed.data.kind === "PRIVATE_NOTE",
      },
      select: {
        id: true,
        authorRole: true,
        content: true,
        kind: true,
        isInternal: true,
        createdAt: true,
      },
    });

    await logAudit({
      actionType:
        parsed.data.kind === "ADVISORY_TO_ADMIN"
          ? "TICKET_ADVISORY_POSTED"
          : "TICKET_COUNSELLOR_NOTE_POSTED",
      userId: auth.data.authUserId,
      societyId: escalation.ticket.societyId,
      entityType: "ResidentTicketMessage",
      entityId: message.id,
    });

    return successResponse(message, 201);
  } catch (err) {
    console.error("[Counsellor Message POST]", err);
    return internalError("Failed to post message");
  }
}
