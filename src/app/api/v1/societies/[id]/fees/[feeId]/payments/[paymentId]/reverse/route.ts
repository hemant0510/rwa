import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { generateReceiptNo } from "@/lib/fee-calculator";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { reversePaymentSchema } from "@/lib/validations/fee";

// POST /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/reverse
// Reverses a payment (creates a reversal entry, recalculates fee/user status).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string; paymentId: string }> },
) {
  try {
    const { id: societyId, feeId, paymentId } = await params;

    const { data, error } = await parseBody(request, reversePaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const payment = await prisma.feePayment.findUnique({
      where: { id: paymentId },
      include: {
        fee: { include: { society: { select: { societyCode: true } } } },
      },
    });

    if (!payment || payment.societyId !== societyId || payment.feeId !== feeId) {
      return notFoundError("Payment not found");
    }

    if (payment.isReversed) {
      return NextResponse.json(
        { error: { code: "ALREADY_REVERSED", message: "Payment has already been reversed" } },
        { status: 400 },
      );
    }

    if (payment.isReversal) {
      return NextResponse.json(
        {
          error: {
            code: "CANNOT_REVERSE_REVERSAL",
            message: "Cannot reverse a reversal entry",
          },
        },
        { status: 400 },
      );
    }

    const admin = await getCurrentUser("RWA_ADMIN");
    const recordedBy = admin?.userId ?? payment.recordedBy;

    const fee = payment.fee;
    const reversedAmount = Number(payment.amount);
    const newAmountPaid = Math.max(0, Number(fee.amountPaid) - reversedAmount);

    const newFeeStatus =
      newAmountPaid >= Number(fee.amountDue) ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : "PENDING";
    const newUserStatus =
      newFeeStatus === "PAID"
        ? "ACTIVE_PAID"
        : newFeeStatus === "PARTIAL"
          ? "ACTIVE_PARTIAL"
          : "ACTIVE_PENDING";

    const paymentCount = await prisma.feePayment.count({ where: { societyId } });
    const year = new Date().getFullYear();
    const reversalReceiptNo = generateReceiptNo(fee.society.societyCode, year, paymentCount + 1);

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.feePayment.update({
        where: { id: paymentId },
        data: { isReversed: true, reversalReason: data.reason },
      });

      const reversal = await tx.feePayment.create({
        data: {
          feeId,
          userId: payment.userId,
          societyId,
          amount: reversedAmount,
          paymentMode: payment.paymentMode,
          referenceNo: null,
          receiptNo: reversalReceiptNo,
          paymentDate: new Date(),
          notes: `Reversal of ${payment.receiptNo}: ${data.reason}`,
          recordedBy,
          isReversal: true,
          reversalOf: paymentId,
          reversalReason: data.reason,
        },
      });

      await tx.membershipFee.update({
        where: { id: feeId },
        data: { amountPaid: newAmountPaid, status: newFeeStatus },
      });

      await tx.user.update({
        where: { id: payment.userId },
        data: { status: newUserStatus },
      });

      return reversal;
    });

    // Non-blocking audit log
    void logAudit({
      actionType: "PAYMENT_REVERSED",
      userId: recordedBy,
      societyId,
      entityType: "FeePayment",
      entityId: paymentId,
      oldValue: { receiptNo: payment.receiptNo, amount: reversedAmount },
      newValue: { reason: data.reason, reversalReceiptNo, newFeeStatus },
    });

    return NextResponse.json({
      reversal: result,
      newStatus: newFeeStatus,
      message: "Payment reversed successfully",
    });
  } catch (err) {
    console.error("Payment reversal error:", err);
    return internalError("Failed to reverse payment");
  }
}
