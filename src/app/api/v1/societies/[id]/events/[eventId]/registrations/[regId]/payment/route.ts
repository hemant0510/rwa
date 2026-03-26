import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import type { TransactionClient } from "@/lib/prisma";
import { recordEventPaymentSchema } from "@/lib/validations/event";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string; regId: string }> },
) {
  try {
    const { id: societyId, eventId, regId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    const registration = await prisma.eventRegistration.findUnique({
      where: { id: regId },
      include: { payment: true },
    });

    if (!registration || registration.eventId !== eventId) {
      return notFoundError("Registration not found");
    }

    if (registration.payment) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_PAID",
            message: "Payment already recorded for this registration",
          },
        },
        { status: 400 },
      );
    }

    // For FIXED/FLEXIBLE: registration must be PENDING
    // For CONTRIBUTION: registration is CONFIRMED (payment is voluntary addition)
    if (event.feeModel !== "CONTRIBUTION" && registration.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "NOT_PENDING", message: "Registration must be in PENDING status" } },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, recordEventPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    // For FIXED/FLEXIBLE: validate amount matches expected
    if (event.feeModel === "FIXED" || event.feeModel === "FLEXIBLE") {
      if (event.feeAmount === null) {
        return NextResponse.json(
          { error: { code: "NO_FEE_SET", message: "Fee amount not set on event" } },
          { status: 400 },
        );
      }

      const expectedAmount =
        event.chargeUnit === "PER_PERSON"
          ? Number(event.feeAmount) * registration.memberCount
          : Number(event.feeAmount);

      if (data.amount !== expectedAmount) {
        return NextResponse.json(
          {
            error: {
              code: "AMOUNT_MISMATCH",
              message: `Expected amount ₹${expectedAmount}, received ₹${data.amount}`,
            },
          },
          { status: 400 },
        );
      }
    }

    // Generate receipt number: EVT-{societyCode}-{year}-{seq}
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { societyCode: true },
    });

    if (!society) return internalError("Society not found");

    const year = new Date().getFullYear();

    const payment = await prisma.$transaction(async (tx: TransactionClient) => {
      // Get next sequence number
      const lastPayment = await tx.eventPayment.findFirst({
        where: {
          societyId,
          receiptNo: { startsWith: `EVT-${society.societyCode}-${year}-` },
        },
        orderBy: { createdAt: "desc" },
        select: { receiptNo: true },
      });

      let seq = 1;
      if (lastPayment) {
        const parts = lastPayment.receiptNo.split("-");
        seq = parseInt(parts[parts.length - 1]) + 1;
      }

      const receiptNo = `EVT-${society.societyCode}-${year}-${String(seq).padStart(5, "0")}`;

      const newPayment = await tx.eventPayment.create({
        data: {
          registrationId: regId,
          userId: registration.userId,
          societyId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          referenceNo: data.referenceNo ?? null,
          receiptNo,
          paymentDate: new Date(data.paymentDate),
          notes: data.notes ?? null,
          recordedBy: admin.userId,
        },
      });

      // Transition PENDING → CONFIRMED (for FIXED/FLEXIBLE)
      if (registration.status === "PENDING") {
        await tx.eventRegistration.update({
          where: { id: regId },
          data: { status: "CONFIRMED" },
        });
      }

      return newPayment;
    });

    void logAudit({
      actionType: "EVENT_PAYMENT_RECORDED",
      userId: admin.userId,
      societyId,
      entityType: "EventPayment",
      entityId: payment.id,
      newValue: {
        amount: data.amount,
        paymentMode: data.paymentMode,
        receiptNo: payment.receiptNo,
        registrationId: regId,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch {
    return internalError("Failed to record payment");
  }
}
