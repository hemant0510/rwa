import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { parseBody, notFoundError, internalError } from "@/lib/api-helpers";
import { generateReceiptNo } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";
import { recordPaymentSchema } from "@/lib/validations/fee";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> },
) {
  try {
    const { id: societyId, feeId } = await params;
    const { data, error } = await parseBody(request, recordPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const fee = await prisma.membershipFee.findUnique({
      where: { id: feeId },
      include: { society: true, user: true },
    });

    if (!fee || fee.societyId !== societyId) return notFoundError("Fee record not found");

    const balance = Number(fee.amountDue) - Number(fee.amountPaid);
    if (data.amount > balance) {
      return NextResponse.json(
        { error: { code: "OVERPAYMENT", message: `Amount exceeds balance due of ${balance}` } },
        { status: 400 },
      );
    }

    // Generate receipt number
    const paymentCount = await prisma.feePayment.count({ where: { societyId } });
    const year = new Date().getFullYear();
    const receiptNo = generateReceiptNo(fee.society.societyCode, year, paymentCount + 1);

    const newAmountPaid = Number(fee.amountPaid) + data.amount;
    const newStatus = newAmountPaid >= Number(fee.amountDue) ? "PAID" : "PARTIAL";

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create payment record
      const payment = await tx.feePayment.create({
        data: {
          feeId,
          userId: fee.userId,
          societyId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          referenceNo: data.referenceNo || null,
          receiptNo,
          paymentDate: new Date(data.paymentDate),
          notes: data.notes || null,
          recordedBy: fee.userId, // TODO: Use actual admin ID from auth
          correctionWindowEnds: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      // Update fee status
      await tx.membershipFee.update({
        where: { id: feeId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      // Update user status
      const userStatus = newStatus === "PAID" ? "ACTIVE_PAID" : "ACTIVE_PARTIAL";
      await tx.user.update({
        where: { id: fee.userId },
        data: { status: userStatus },
      });

      return payment;
    });

    // TODO: Send WhatsApp payment receipt (Phase 5)

    return NextResponse.json(
      {
        payment: result,
        receiptNo,
        newStatus,
        message: "Payment recorded successfully",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Payment recording error:", err);
    return internalError("Failed to record payment");
  }
}
