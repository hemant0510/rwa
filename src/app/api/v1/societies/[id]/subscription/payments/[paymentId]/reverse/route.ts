import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { computeInvoiceStatus, getInvoicePaidTotal } from "@/lib/billing-server";
import { prisma } from "@/lib/prisma";
import { reverseSubscriptionPaymentSchema } from "@/lib/validations/billing";

function withinWindow(correctionWindowEnds: Date | null): boolean {
  if (!correctionWindowEnds) return false;
  return correctionWindowEnds.getTime() >= Date.now();
}

// POST /api/v1/societies/[id]/subscription/payments/[paymentId]/reverse
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const { id: societyId, paymentId } = await params;
    const { data, error } = await parseBody(request, reverseSubscriptionPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const original = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!original || original.societyId !== societyId) return notFoundError("Payment not found");
    if (original.isReversed) {
      return NextResponse.json(
        { error: { code: "ALREADY_REVERSED", message: "Payment already reversed" } },
        { status: 400 },
      );
    }
    if (!withinWindow(original.correctionWindowEnds)) {
      return NextResponse.json(
        { error: { code: "LOCKED", message: "Correction window expired" } },
        { status: 400 },
      );
    }

    const reversed = await prisma.$transaction(async (tx) => {
      const row = await tx.subscriptionPayment.create({
        data: {
          societyId,
          subscriptionId: original.subscriptionId,
          invoiceId: original.invoiceId,
          amount: -Number(original.amount),
          paymentMode: original.paymentMode,
          referenceNo: original.referenceNo,
          invoiceNo: original.invoiceNo,
          paymentDate: new Date(),
          notes: data.reason,
          recordedBy: original.recordedBy,
          isReversal: true,
          reversalOf: original.id,
          reversalReason: data.reason,
        },
      });

      await tx.subscriptionPayment.update({
        where: { id: original.id },
        data: { isReversed: true },
      });

      if (original.invoiceId) {
        const invoice = await tx.subscriptionInvoice.findUnique({
          where: { id: original.invoiceId },
        });
        if (invoice) {
          const paid = await getInvoicePaidTotal(original.invoiceId);
          const status = computeInvoiceStatus(Number(invoice.finalAmount), paid);
          await tx.subscriptionInvoice.update({
            where: { id: original.invoiceId },
            data: { status, paidAt: status === "PAID" ? new Date() : null, paidVia: null },
          });
        }
      }

      await tx.societySubscriptionHistory.create({
        data: {
          subscriptionId: original.subscriptionId,
          societyId,
          changeType: "PAYMENT_REVERSED",
          performedBy: "SA",
          notes: data.reason,
        },
      });

      return row;
    });

    return successResponse({ payment: { ...reversed, amount: Number(reversed.amount) } }, 201);
  } catch {
    return internalError("Failed to reverse payment");
  }
}
