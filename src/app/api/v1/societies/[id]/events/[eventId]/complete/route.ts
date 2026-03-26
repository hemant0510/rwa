import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const { id: societyId, eventId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    if (event.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: { code: "NOT_PUBLISHED", message: "Only PUBLISHED events can be completed" } },
        { status: 400 },
      );
    }

    const updated = await prisma.communityEvent.update({
      where: { id: eventId },
      data: { status: "COMPLETED" },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "EVENT_COMPLETED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      newValue: { title: event.title },
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to complete event");
  }
}
