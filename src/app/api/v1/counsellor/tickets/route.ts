import { NextRequest } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const OPEN_STATUSES = ["PENDING", "ACKNOWLEDGED", "REVIEWING"] as const;
const ALL_STATUSES = [
  "PENDING",
  "ACKNOWLEDGED",
  "REVIEWING",
  "RESOLVED_BY_COUNSELLOR",
  "DEFERRED_TO_ADMIN",
  "WITHDRAWN",
] as const;

type EscalationStatusValue = (typeof ALL_STATUSES)[number];

export async function GET(request: NextRequest) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const societyIdParam = searchParams.get("societyId");

  let statuses: readonly EscalationStatusValue[];
  if (statusParam === "all") {
    statuses = ALL_STATUSES;
  } else if (statusParam && (ALL_STATUSES as readonly string[]).includes(statusParam)) {
    statuses = [statusParam as EscalationStatusValue];
  } else {
    statuses = OPEN_STATUSES;
  }

  try {
    const escalations = await prisma.residentTicketEscalation.findMany({
      where: {
        counsellorId: auth.data.counsellorId,
        status: { in: [...statuses] },
        ...(societyIdParam ? { ticket: { societyId: societyIdParam } } : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        source: true,
        slaDeadline: true,
        acknowledgedAt: true,
        resolvedAt: true,
        createdAt: true,
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            type: true,
            priority: true,
            status: true,
            societyId: true,
            society: { select: { name: true, societyCode: true } },
          },
        },
      },
    });

    return successResponse({ escalations });
  } catch (err) {
    console.error("[Counsellor Tickets GET]", err);
    return internalError("Failed to load escalated tickets");
  }
}
