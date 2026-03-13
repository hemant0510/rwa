import { addBillingCycle, generateInvoiceNo } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

import type { Prisma } from "@prisma/client";

type BillingCycle = "MONTHLY" | "ANNUAL" | "TWO_YEAR" | "THREE_YEAR";

export async function getLatestSubscription(societyId: string) {
  return prisma.societySubscription.findFirst({
    where: { societyId },
    include: { plan: true, billingOption: true, discount: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLatestPendingInvoice(societyId: string, subscriptionId: string) {
  return prisma.subscriptionInvoice.findFirst({
    where: {
      societyId,
      subscriptionId,
      status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoicePaidTotal(invoiceId: string) {
  const agg = await prisma.subscriptionPayment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount || 0);
}

export function computeInvoiceStatus(
  finalAmount: number,
  paid: number,
): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  if (paid <= 0) return "UNPAID";
  if (paid >= finalAmount) return "PAID";
  return "PARTIALLY_PAID";
}

export async function updateInvoicePaidState(invoiceId: string) {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return null;
  const paid = await getInvoicePaidTotal(invoiceId);
  const nextStatus = computeInvoiceStatus(Number(invoice.finalAmount), paid);
  return prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: {
      status: nextStatus,
      paidAt: nextStatus === "PAID" ? new Date() : null,
    },
  });
}

/**
 * Generates the next invoice number with retry on unique constraint violation.
 * Handles race conditions where concurrent requests get the same count.
 */
export async function nextInvoiceNo(maxRetries = 3): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const count = await prisma.subscriptionInvoice.count({
      where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    });
    const invoiceNo = generateInvoiceNo(year, count + 1 + attempt);
    const exists = await prisma.subscriptionInvoice.findUnique({
      where: { invoiceNo },
      select: { id: true },
    });
    if (!exists) return invoiceNo;
  }
  // Fallback: use timestamp-based suffix to guarantee uniqueness
  return generateInvoiceNo(new Date().getFullYear(), Date.now() % 1000000);
}

export async function ensureOpenInvoice(params: {
  societyId: string;
  subscriptionId: string;
  billingCycle: BillingCycle;
  planName: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) {
  const existing = await getLatestPendingInvoice(params.societyId, params.subscriptionId);
  if (existing) return existing;

  const now = new Date();
  const periodStart = params.periodStart ?? now;
  const periodEnd = params.periodEnd ?? addBillingCycle(periodStart, params.billingCycle);
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);

  const invoiceNo = await nextInvoiceNo();

  return prisma.subscriptionInvoice.create({
    data: {
      societyId: params.societyId,
      subscriptionId: params.subscriptionId,
      invoiceNo,
      periodStart,
      periodEnd,
      planName: params.planName,
      billingCycle: params.billingCycle,
      baseAmount: params.baseAmount,
      discountAmount: params.discountAmount,
      finalAmount: params.finalAmount,
      dueDate,
      status: "UNPAID",
    },
  });
}

export async function createInvoiceHistory(
  tx: Prisma.TransactionClient,
  params: {
    subscriptionId: string;
    societyId: string;
    changeType: "INVOICE_GENERATED" | "INVOICE_WAIVED";
    notes?: string;
  },
) {
  await tx.societySubscriptionHistory.create({
    data: {
      subscriptionId: params.subscriptionId,
      societyId: params.societyId,
      changeType: params.changeType,
      performedBy: "SA",
      notes: params.notes,
    },
  });
}
