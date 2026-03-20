import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody } from "@/lib/api-helpers";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { correctPaymentSchema } from "@/lib/validations/fee";

// PATCH /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]
// Corrects a payment within the 48-hour correction window.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string; paymentId: string }> },
) {
  try {
    const { id: societyId, feeId, paymentId } = await params;

    const { data, error } = await parseBody(request, correctPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const payment = await prisma.feePayment.findUnique({
      where: { id: paymentId },
      include: { fee: true },
    });

    if (!payment || payment.societyId !== societyId || payment.feeId !== feeId) {
      return notFoundError("Payment not found");
    }

    if (payment.isReversal || payment.isReversed) {
      return NextResponse.json(
        { error: { code: "CANNOT_CORRECT", message: "Cannot correct a reversed payment" } },
        { status: 400 },
      );
    }

    const now = new Date();
    if (!payment.correctionWindowEnds || now > payment.correctionWindowEnds) {
      return NextResponse.json(
        {
          error: {
            code: "CORRECTION_WINDOW_EXPIRED",
            message: "Correction window has expired. Use reversal instead.",
          },
        },
        { status: 400 },
      );
    }

    const originalAmount = Number(payment.amount);
    const newAmount = data.amount ?? originalAmount;
    const amountDelta = newAmount - originalAmount;

    const fee = payment.fee;
    const newAmountPaid = Number(fee.amountPaid) + amountDelta;

    if (newAmountPaid < 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_AMOUNT",
            message: "Corrected amount results in negative balance",
          },
        },
        { status: 400 },
      );
    }

    const newFeeStatus =
      newAmountPaid >= Number(fee.amountDue) ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : "PENDING";
    const newUserStatus =
      newFeeStatus === "PAID"
        ? "ACTIVE_PAID"
        : newFeeStatus === "PARTIAL"
          ? "ACTIVE_PARTIAL"
          : "ACTIVE_PENDING";

    const updatedPayment = await prisma.$transaction(async (tx: TransactionClient) => {
      const updated = await tx.feePayment.update({
        where: { id: paymentId },
        data: {
          amount: newAmount,
          ...(data.paymentMode && { paymentMode: data.paymentMode }),
          ...(data.referenceNo !== undefined && { referenceNo: data.referenceNo || null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
        },
      });

      await tx.membershipFee.update({
        where: { id: feeId },
        data: { amountPaid: newAmountPaid, status: newFeeStatus },
      });

      await tx.user.update({
        where: { id: fee.userId },
        data: { status: newUserStatus },
      });

      return updated;
    });

    return NextResponse.json({
      payment: updatedPayment,
      newStatus: newFeeStatus,
      message: "Payment corrected successfully",
    });
  } catch (err) {
    console.error("Payment correction error:", err);
    return internalError("Failed to correct payment");
  }
}
