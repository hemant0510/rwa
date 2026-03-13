import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { computeInvoiceStatus, getInvoicePaidTotal } from "@/lib/billing-server";
import { prisma } from "@/lib/prisma";
import { correctSubscriptionPaymentSchema } from "@/lib/validations/billing";

function withinWindow(correctionWindowEnds: Date | null): boolean {
  if (!correctionWindowEnds) return false;
  return correctionWindowEnds.getTime() >= Date.now();
}

function requiresRef(mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "RAZORPAY" | "OTHER") {
  return mode === "UPI" || mode === "BANK_TRANSFER" || mode === "CHEQUE";
}

// PATCH /api/v1/societies/[id]/subscription/payments/[paymentId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const { id: societyId, paymentId } = await params;
    const { data, error } = await parseBody(request, correctSubscriptionPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.societyId !== societyId) return notFoundError("Payment not found");
    if (!withinWindow(payment.correctionWindowEnds)) {
      return NextResponse.json(
        { error: { code: "LOCKED", message: "Correction window expired" } },
        { status: 400 },
      );
    }
    if (payment.isReversal) {
      return NextResponse.json(
        { error: { code: "INVALID_PAYMENT", message: "Reversal entries cannot be corrected" } },
        { status: 400 },
      );
    }

    const paymentMode = data.paymentMode ?? payment.paymentMode;
    const referenceNo = data.referenceNo ?? payment.referenceNo;
    if (requiresRef(paymentMode) && (!referenceNo || !referenceNo.trim())) {
      return NextResponse.json(
        {
          error: {
            code: "REFERENCE_REQUIRED",
            message: "Reference number is required for this payment mode",
          },
        },
        { status: 400 },
      );
    }

    const nextAmount = data.amount ?? Number(payment.amount);
    if (nextAmount <= 0) {
      return NextResponse.json(
        { error: { code: "INVALID_AMOUNT", message: "Amount must be positive" } },
        { status: 400 },
      );
    }

    if (payment.invoiceId) {
      const invoice = await prisma.subscriptionInvoice.findUnique({
        where: { id: payment.invoiceId },
      });
      if (!invoice) return notFoundError("Invoice not found");
      const paidTotal = await getInvoicePaidTotal(payment.invoiceId);
      const outstandingWithCurrent =
        Number(invoice.finalAmount) - (paidTotal - Number(payment.amount));
      if (nextAmount > outstandingWithCurrent) {
        return NextResponse.json(
          { error: { code: "OVERPAYMENT", message: "Amount exceeds invoice outstanding balance" } },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          amount: nextAmount,
          paymentMode,
          referenceNo: referenceNo || null,
          notes: data.notes ?? payment.notes,
        },
      });

      if (payment.invoiceId) {
        const invoice = await tx.subscriptionInvoice.findUnique({
          where: { id: payment.invoiceId },
        });
        if (invoice) {
          const paidTotal = await getInvoicePaidTotal(payment.invoiceId);
          const status = computeInvoiceStatus(Number(invoice.finalAmount), paidTotal);
          await tx.subscriptionInvoice.update({
            where: { id: payment.invoiceId },
            data: { status, paidAt: status === "PAID" ? new Date() : null },
          });
        }
      }

      await tx.societySubscriptionHistory.create({
        data: {
          subscriptionId: payment.subscriptionId,
          societyId,
          changeType: "PAYMENT_CORRECTED",
          performedBy: "SA",
          notes: data.reason,
        },
      });

      return row;
    });

    return successResponse({ payment: { ...updated, amount: Number(updated.amount) } });
  } catch {
    return internalError("Failed to correct payment");
  }
}
