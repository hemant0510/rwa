import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { addBillingCycle } from "@/lib/billing";
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
    if (!subscription) return notFoundError("No active subscription found");

    // Resolve billing option: use the SA-selected option, fall back to subscription's current option
    let billingOption = subscription.billingOption;
    let cycleChanged = false;

    if (data.billingOptionId && data.billingOptionId !== subscription.billingOptionId) {
      // SA explicitly selected a (possibly different) billing option
      const selectedOption = await prisma.planBillingOption.findUnique({
        where: { id: data.billingOptionId },
      });
      if (!selectedOption || selectedOption.planId !== subscription.planId) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_BILLING_OPTION",
              message: "Billing option not valid for this plan",
            },
          },
          { status: 400 },
        );
      }
      billingOption = selectedOption;
      cycleChanged = true;
    } else if (!billingOption && data.billingOptionId) {
      // Subscription has no billing option yet (TRIAL) — use the one SA passed
      const selectedOption = await prisma.planBillingOption.findUnique({
        where: { id: data.billingOptionId },
      });
      if (!selectedOption || selectedOption.planId !== subscription.planId) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_BILLING_OPTION",
              message: "Billing option not valid for this plan",
            },
          },
          { status: 400 },
        );
      }
      billingOption = selectedOption;
      cycleChanged = true;
    }

    if (!billingOption) return notFoundError("No billing option found — select a billing cycle");

    const baseAmount = Number(billingOption.price);
    // Preserve existing discount when same cycle; full price when switching cycle
    const finalAmount = cycleChanged
      ? baseAmount
      : Number(subscription.finalPrice ?? billingOption.price);
    const discountAmount = Math.max(0, baseAmount - finalAmount);

    const invoice = await ensureOpenInvoice({
      societyId,
      subscriptionId: subscription.id,
      billingCycle: billingOption.billingCycle,
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
        // Extend from current period end (if in future) or from today
        const extendFrom =
          subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()
            ? subscription.currentPeriodEnd
            : new Date();
        const newPeriodEnd = addBillingCycle(extendFrom, billingOption.billingCycle);
        const newPeriodStart = subscription.currentPeriodStart ?? paymentDate;

        await tx.societySubscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            billingOptionId: billingOption.id,
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
          },
        });
        await tx.society.update({
          where: { id: societyId },
          data: { status: "ACTIVE", subscriptionExpiresAt: newPeriodEnd },
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
