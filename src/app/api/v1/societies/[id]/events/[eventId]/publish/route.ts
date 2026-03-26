import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { sendEventPublished } from "@/lib/whatsapp";

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

    if (event.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "NOT_DRAFT", message: "Only DRAFT events can be published" } },
        { status: 400 },
      );
    }

    const updated = await prisma.communityEvent.update({
      where: { id: eventId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "EVENT_PUBLISHED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      newValue: { title: event.title },
    });

    // Fan-out: notify all active residents with WhatsApp consent
    void prisma.user
      .findMany({
        where: {
          societyId,
          role: "RESIDENT",
          status: {
            in: [
              "ACTIVE_PAID",
              "ACTIVE_PENDING",
              "ACTIVE_OVERDUE",
              "ACTIVE_PARTIAL",
              "ACTIVE_EXEMPTED",
            ],
          },
          mobile: { not: null },
          consentWhatsapp: true,
        },
        select: { name: true, mobile: true },
      })
      .then((residents) => {
        const eventDate = new Date(event.eventDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const location = event.location ?? "TBD";
        const feeInfo =
          event.feeModel === "FREE"
            ? "Free Event"
            : event.feeAmount != null
              ? `₹${Number(event.feeAmount).toLocaleString("en-IN")}`
              : "Pricing TBD";
        for (const r of residents) {
          if (r.mobile) {
            void sendEventPublished(r.mobile, r.name, event.title, eventDate, location, feeInfo);
          }
        }
      });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to publish event");
  }
}
