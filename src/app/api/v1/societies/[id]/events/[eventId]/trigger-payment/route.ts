import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import type { TransactionClient } from "@/lib/prisma";
import { triggerPaymentSchema } from "@/lib/validations/event";
import { sendEventPaymentTriggered } from "@/lib/whatsapp";

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
        { error: { code: "NOT_PUBLISHED", message: "Event must be PUBLISHED" } },
        { status: 400 },
      );
    }

    if (event.feeModel !== "FLEXIBLE") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FLEXIBLE",
            message: "Only FLEXIBLE events support payment triggering",
          },
        },
        { status: 400 },
      );
    }

    if (event.feeAmount !== null) {
      return NextResponse.json(
        { error: { code: "ALREADY_TRIGGERED", message: "Payment has already been triggered" } },
        { status: 400 },
      );
    }

    // Check at least 1 INTERESTED registration exists
    const interestedCount = await prisma.eventRegistration.count({
      where: { eventId, status: "INTERESTED" },
    });

    if (interestedCount === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_INTEREST",
            message: "No interested registrations to trigger payment for",
          },
        },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, triggerPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Set fee amount and trigger timestamp
      const updated = await tx.communityEvent.update({
        where: { id: eventId },
        data: {
          feeAmount: data.feeAmount,
          paymentTriggeredAt: new Date(),
        },
        include: { creator: { select: { name: true } } },
      });

      // Bulk-transition INTERESTED → PENDING
      const { count: transitionedCount } = await tx.eventRegistration.updateMany({
        where: { eventId, status: "INTERESTED" },
        data: { status: "PENDING" },
      });

      return { updated, transitionedCount };
    });

    void logAudit({
      actionType: "EVENT_PAYMENT_TRIGGERED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: eventId,
      newValue: { feeAmount: data.feeAmount, transitionedCount: result.transitionedCount },
    });

    // Fan-out: notify PENDING registrants (just transitioned from INTERESTED) with price & total
    void prisma.eventRegistration
      .findMany({
        where: { eventId, status: "PENDING" },
        include: {
          user: { select: { name: true, mobile: true, consentWhatsapp: true } },
        },
      })
      .then((registrations) => {
        const pricePerUnit = `₹${Number(data.feeAmount).toLocaleString("en-IN")}`;
        for (const reg of registrations) {
          if (reg.user.mobile && reg.user.consentWhatsapp) {
            const totalDue = `₹${(Number(data.feeAmount) * reg.memberCount).toLocaleString("en-IN")}`;
            void sendEventPaymentTriggered(
              reg.user.mobile,
              reg.user.name,
              event.title,
              pricePerUnit,
              totalDue,
            );
          }
        }
      });

    return NextResponse.json({ ...result.updated, transitionedCount: result.transitionedCount });
  } catch {
    return internalError("Failed to trigger payment");
  }
}
