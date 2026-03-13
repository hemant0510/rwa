import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import {
  ensureOpenInvoice,
  getLatestSubscription,
  getInvoicePaidTotal,
  computeInvoiceStatus,
} from "@/lib/billing-server";
import { sendEmail } from "@/lib/email";
import { getPaymentReceivedEmailHtml } from "@/lib/email-templates/subscription";
import { prisma } from "@/lib/prisma";
import { recordSubscriptionPaymentSchema } from "@/lib/validations/billing";

function isFuture(date: Date) {
  return date.getTime() > Date.now();
}

// GET /api/v1/societies/[id]/subscription/payments
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const rows = await prisma.subscriptionPayment.findMany({
      where: { societyId },
      orderBy: { paymentDate: "desc" },
    });
    return successResponse(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  } catch {
    return internalError("Failed to fetch subscription payments");
  }
}

// POST /api/v1/societies/[id]/subscription/payments
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { data, error } = await parseBody(request, recordSubscriptionPaymentSchema);
    if (error) return error;
    if (!data) return internalError();

    const paymentDate = new Date(data.paymentDate);
    if (isFuture(paymentDate)) {
      return NextResponse.json(
        {
          error: { code: "INVALID_PAYMENT_DATE", message: "Payment date cannot be in the future" },
        },
        { status: 400 },
      );
    }

    const subscription = await getLatestSubscription(societyId);
    if (!subscription || !subscription.billingOption)
      return notFoundError("No active subscription found");

    const baseAmount = Number(subscription.billingOption.price);
    const finalAmount = Number(subscription.finalPrice ?? subscription.billingOption.price);
    const discountAmount = Math.max(0, baseAmount - finalAmount);

    const invoice = await ensureOpenInvoice({
      societyId,
      subscriptionId: subscription.id,
      billingCycle: subscription.billingOption.billingCycle,
      planName: subscription.plan?.name ?? "Trial Plan",
      baseAmount,
      discountAmount,
      finalAmount,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    });

    const alreadyPaid = await getInvoicePaidTotal(invoice.id);
    const outstanding = Number(invoice.finalAmount) - alreadyPaid;
    if (data.amount > outstanding) {
      return NextResponse.json(
        {
          error: {
            code: "OVERPAYMENT",
            message: `Amount exceeds invoice outstanding balance of ${outstanding.toFixed(2)}`,
          },
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.create({
        data: {
          societyId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          amount: data.amount,
          paymentMode: data.paymentMode,
          referenceNo: data.referenceNo || null,
          invoiceNo: invoice.invoiceNo,
          paymentDate,
          notes: data.notes || null,
          // TODO: Replace with actual SuperAdmin user ID once SA auth middleware is added
          recordedBy: societyId,
          correctionWindowEnds: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      const newPaid = alreadyPaid + data.amount;
      const status = computeInvoiceStatus(Number(invoice.finalAmount), newPaid);
      await tx.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          status,
          paidAt: status === "PAID" ? new Date() : null,
          paidVia: status === "PAID" ? data.paymentMode : null,
        },
      });

      if (status === "PAID") {
        await tx.societySubscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            currentPeriodStart: subscription.currentPeriodStart ?? paymentDate,
            currentPeriodEnd: subscription.currentPeriodEnd ?? null,
          },
        });
        await tx.society.update({
          where: { id: societyId },
          data: { status: "ACTIVE", subscriptionExpiresAt: subscription.currentPeriodEnd ?? null },
        });
      }

      await tx.societySubscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          societyId,
          changeType: "PAYMENT_RECORDED",
          performedBy: "SA",
          notes: data.notes ?? `Payment recorded: ${invoice.invoiceNo}`,
        },
      });

      return payment;
    });

    if (data.sendEmail) {
      const society = await prisma.society.findUnique({
        where: { id: societyId },
        select: { name: true },
      });
      const admins = await prisma.user.findMany({
        where: { societyId, role: "RWA_ADMIN" },
        select: { email: true },
      });
      const html = getPaymentReceivedEmailHtml({
        societyName: society?.name ?? "Society",
        amount: data.amount,
        invoiceNo: invoice.invoiceNo,
        paymentDate: data.paymentDate,
      });
      await Promise.allSettled(
        admins.map((a) => sendEmail(a.email, "Subscription Payment Received", html)),
      );
    }

    return successResponse({ payment: { ...result, amount: Number(result.amount) } }, 201);
  } catch (error) {
    console.error("subscription payment create error", error);
    return internalError("Failed to record subscription payment");
  }
}
