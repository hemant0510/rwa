import { NextRequest } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: escalationId } = await params;
  const counsellorId = auth.data.counsellorId;

  try {
    const escalation = await prisma.residentTicketEscalation.findFirst({
      where: { id: escalationId, counsellorId },
      select: {
        id: true,
        status: true,
        source: true,
        reason: true,
        slaDeadline: true,
        acknowledgedAt: true,
        resolvedAt: true,
        createdAt: true,
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            description: true,
            type: true,
            priority: true,
            status: true,
            societyId: true,
            createdAt: true,
            society: { select: { name: true, societyCode: true } },
            createdByUser: { select: { id: true, name: true, email: true } },
            messages: {
              orderBy: { createdAt: "asc" },
              include: {
                attachments: true,
                author: { select: { name: true } },
                counsellor: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!escalation) return notFoundError("Escalation not found");

    return successResponse(escalation);
  } catch (err) {
    console.error("[Counsellor Ticket Detail GET]", err);
    return internalError("Failed to load escalation");
  }
}
