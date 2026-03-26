import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import type { TransactionClient } from "@/lib/prisma";
import { cancelEventSchema } from "@/lib/validations/event";
import { sendEventCancelled } from "@/lib/whatsapp";

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
        { error: { code: "NOT_PUBLISHED", message: "Only PUBLISHED events can be cancelled" } },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, cancelEventSchema);
    if (error) return error;
    if (!data) return internalError();

    const now = new Date();

    const updated = await prisma.$transaction(async (tx: TransactionClient) => {
      // Cancel the event
      const cancelledEvent = await tx.communityEvent.update({
        where: { id: eventId },
        data: {
          status: "CANCELLED",
          cancellationReason: data.reason,
        },
        include: { creator: { select: { name: true } } },
      });

      // Bulk-cancel all active registrations
      await tx.eventRegistration.updateMany({
        where: {
          eventId,
          status: { in: ["INTERESTED", "PENDING", "CONFIRMED"] },
        },
        data: { status: "CANCELLED", cancelledAt: now },
      });

      return cancelledEvent;
    });

    void logAudit({
      actionType: "EVENT_CANCELLED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      newValue: { reason: data.reason },
    });

    // Fan-out: notify registrants who were just cancelled
    void prisma.eventRegistration
      .findMany({
        where: { eventId, cancelledAt: now },
        include: {
          user: { select: { name: true, mobile: true, consentWhatsapp: true } },
        },
      })
      .then((registrations) => {
        for (const reg of registrations) {
          if (reg.user.mobile && reg.user.consentWhatsapp) {
            void sendEventCancelled(reg.user.mobile, reg.user.name, event.title, data.reason);
          }
        }
      });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to cancel event");
  }
}
