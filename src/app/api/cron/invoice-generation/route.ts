import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { addBillingCycle, diffDaysUtc, toPeriodKey } from "@/lib/billing";
import { nextInvoiceNo } from "@/lib/billing-server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { getInvoiceGeneratedEmailHtml } from "@/lib/email-templates/subscription";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

    const today = new Date();
    let generated = 0;

    const subs = await prisma.societySubscription.findMany({
      where: { status: "ACTIVE", currentPeriodEnd: { not: null } },
      include: { billingOption: true, plan: true },
    });

    for (const sub of subs) {
      if (!sub.currentPeriodEnd || !sub.billingOption) continue;
      const days = diffDaysUtc(today, sub.currentPeriodEnd);
      const shouldGenerate =
        sub.billingOption.billingCycle === "MONTHLY" ? days === 7 : days === 30;
      if (!shouldGenerate) continue;

      const periodKey = `invoice-${toPeriodKey(sub.currentPeriodEnd)}`;
      const existingLog = await prisma.notificationLog.findUnique({
        where: {
          societyId_templateKey_periodKey: {
            societyId: sub.societyId,
            templateKey: "invoice-generated",
            periodKey,
          },
        },
      });
      if (existingLog) continue;

      const unpaid = await prisma.subscriptionInvoice.findFirst({
        where: {
          societyId: sub.societyId,
          subscriptionId: sub.id,
          status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
        },
      });
      if (unpaid) continue;

      const invoiceNo = await nextInvoiceNo();
      const periodStart = sub.currentPeriodEnd;
      const periodEnd = addBillingCycle(periodStart, sub.billingOption.billingCycle);
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 7);
      const base = Number(sub.billingOption.price);
      const final = Number(sub.finalPrice ?? sub.billingOption.price);
      const discount = Math.max(0, base - final);

      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          societyId: sub.societyId,
          subscriptionId: sub.id,
          invoiceNo,
          periodStart,
          periodEnd,
          planName: sub.plan?.name ?? "Trial Plan",
          billingCycle: sub.billingOption.billingCycle,
          baseAmount: base,
          discountAmount: discount,
          finalAmount: final,
          dueDate,
          status: "UNPAID",
        },
      });

      await prisma.societySubscriptionHistory.create({
        data: {
          subscriptionId: sub.id,
          societyId: sub.societyId,
          changeType: "INVOICE_GENERATED",
          performedBy: "SYSTEM",
          notes: `Invoice ${invoice.invoiceNo} auto-generated`,
        },
      });

      const [society, admins] = await Promise.all([
        prisma.society.findUnique({ where: { id: sub.societyId }, select: { name: true } }),
        prisma.user.findMany({
          where: { societyId: sub.societyId, role: "RWA_ADMIN" },
          select: { email: true },
        }),
      ]);
      const html = getInvoiceGeneratedEmailHtml({
        societyName: society?.name ?? "Society",
        invoiceNo: invoice.invoiceNo,
        amount: Number(invoice.finalAmount),
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
      });
      await Promise.allSettled(
        admins.map((a) => sendEmail(a.email, "New Subscription Invoice", html)),
      );

      await prisma.notificationLog.create({
        data: {
          societyId: sub.societyId,
          templateKey: "invoice-generated",
          periodKey,
        },
      });

      generated += 1;
    }

    return successResponse({ generated });
  } catch {
    return internalError("Failed to run invoice generation");
  }
}
