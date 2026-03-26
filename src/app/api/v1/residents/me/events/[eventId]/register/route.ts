import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { registerEventSchema } from "@/lib/validations/event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== resident.societyId) return notFoundError("Event not found");

    if (event.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: { code: "NOT_PUBLISHED", message: "Event is not accepting registrations" } },
        { status: 400 },
      );
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return NextResponse.json(
        { error: { code: "DEADLINE_PASSED", message: "Registration deadline has passed" } },
        { status: 400 },
      );
    }

    // Check if already registered
    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: resident.userId } },
    });

    if (existing && existing.status !== "CANCELLED") {
      return NextResponse.json(
        { error: { code: "ALREADY_REGISTERED", message: "Already registered for this event" } },
        { status: 409 },
      );
    }

    const { data, error } = await parseBody(request, registerEventSchema);
    if (error) return error;
    if (!data) return internalError();

    // For PER_HOUSEHOLD, force memberCount to 1
    const memberCount = event.chargeUnit === "PER_HOUSEHOLD" ? 1 : data.memberCount;

    // Check max participants
    if (event.maxParticipants) {
      const currentCount = await prisma.eventRegistration.aggregate({
        where: { eventId, status: { not: "CANCELLED" } },
        _sum: { memberCount: true },
      });
      const totalMembers = (currentCount._sum.memberCount ?? 0) + memberCount;
      if (totalMembers > event.maxParticipants) {
        return NextResponse.json(
          { error: { code: "EVENT_FULL", message: "Event has reached maximum participants" } },
          { status: 400 },
        );
      }
    }

    // Determine initial status based on fee model
    let status: "INTERESTED" | "PENDING" | "CONFIRMED";
    if (event.feeModel === "FREE" || event.feeModel === "CONTRIBUTION") {
      status = "CONFIRMED";
    } else if (event.feeModel === "FLEXIBLE" && event.feeAmount === null) {
      // Polling phase
      status = "INTERESTED";
    } else {
      // FIXED, or FLEXIBLE with feeAmount set (late joiner)
      status = "PENDING";
    }

    // If previously cancelled, update instead of create
    let registration;
    if (existing && existing.status === "CANCELLED") {
      registration = await prisma.eventRegistration.update({
        where: { id: existing.id },
        data: {
          status,
          memberCount,
          cancelledAt: null,
          cancellationNote: null,
          registeredAt: new Date(),
        },
      });
    } else {
      registration = await prisma.eventRegistration.create({
        data: {
          eventId,
          userId: resident.userId,
          societyId: resident.societyId,
          status,
          memberCount,
        },
      });
    }

    void logAudit({
      actionType: "EVENT_REGISTRATION_CREATED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "EventRegistration",
      entityId: registration.id,
      newValue: { eventId, status, memberCount },
    });

    return NextResponse.json(registration, { status: 201 });
  } catch {
    return internalError("Failed to register for event");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const registration = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: resident.userId } },
      include: { payment: true, event: { select: { status: true, eventDate: true } } },
    });

    if (!registration) return notFoundError("Registration not found");

    // Cannot cancel if event already happened
    if (registration.event.status !== "PUBLISHED") {
      return NextResponse.json(
        {
          error: {
            code: "EVENT_NOT_PUBLISHED",
            message: "Can only cancel registrations for PUBLISHED events",
          },
        },
        { status: 400 },
      );
    }

    // Cannot cancel if CONFIRMED with payment (admin must handle refund)
    if (registration.status === "CONFIRMED" && registration.payment) {
      return NextResponse.json(
        {
          error: {
            code: "HAS_PAYMENT",
            message: "Cannot cancel registration with recorded payment. Contact admin.",
          },
        },
        { status: 400 },
      );
    }

    // Only INTERESTED or PENDING can be cancelled
    if (registration.status !== "INTERESTED" && registration.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "CANNOT_CANCEL", message: "Cannot cancel this registration" } },
        { status: 400 },
      );
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    void logAudit({
      actionType: "EVENT_REGISTRATION_CANCELLED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "EventRegistration",
      entityId: registration.id,
      oldValue: { status: registration.status },
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to cancel registration");
  }
}
