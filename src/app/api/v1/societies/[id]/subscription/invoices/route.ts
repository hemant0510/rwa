import { NextRequest } from "next/server";

import { parseBody, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { parseISODateOnly, generateInvoiceNo } from "@/lib/billing";
import { createInvoiceHistory, getLatestSubscription } from "@/lib/billing-server";
import { prisma } from "@/lib/prisma";
import { generateInvoiceSchema } from "@/lib/validations/billing";

// GET /api/v1/societies/[id]/subscription/invoices
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const invoices = await prisma.subscriptionInvoice.findMany({
      where: { societyId },
      include: {
        payments: { select: { id: true, amount: true, paymentDate: true, isReversal: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(
      invoices.map((invoice) => ({
        ...invoice,
        baseAmount: Number(invoice.baseAmount),
        discountAmount: Number(invoice.discountAmount),
        finalAmount: Number(invoice.finalAmount),
        paidAmount: invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      })),
    );
  } catch {
    return internalError("Failed to fetch invoices");
  }
}

// POST /api/v1/societies/[id]/subscription/invoices
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { data, error } = await parseBody(request, generateInvoiceSchema);
    if (error) return error;
    if (!data) return internalError();

    const sub = await getLatestSubscription(societyId);
    if (!sub || !sub.billingOption) return notFoundError("No subscription found");
    const billingOption = sub.billingOption;

    const now = new Date();
    const year = now.getFullYear();
    const count = await prisma.subscriptionInvoice.count({
      where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    });

    const baseAmount = Number(billingOption.price);
    const finalAmount = Number(sub.finalPrice ?? billingOption.price);
    const discountAmount = Math.max(0, baseAmount - finalAmount);

    const invoice = await prisma.$transaction(async (tx) => {
      const row = await tx.subscriptionInvoice.create({
        data: {
          societyId,
          subscriptionId: sub.id,
          invoiceNo: generateInvoiceNo(year, count + 1),
          periodStart: parseISODateOnly(data.periodStart),
          periodEnd: parseISODateOnly(data.periodEnd),
          dueDate: parseISODateOnly(data.dueDate),
          planName: sub.plan?.name ?? "Trial Plan",
          billingCycle: billingOption.billingCycle,
          baseAmount,
          discountAmount,
          finalAmount,
          status: "UNPAID",
          notes: data.notes,
        },
      });

      await createInvoiceHistory(tx, {
        subscriptionId: sub.id,
        societyId,
        changeType: "INVOICE_GENERATED",
        notes: `Invoice ${row.invoiceNo} generated`,
      });

      return row;
    });

    return successResponse(
      {
        ...invoice,
        baseAmount: Number(invoice.baseAmount),
        discountAmount: Number(invoice.discountAmount),
        finalAmount: Number(invoice.finalAmount),
      },
      201,
    );
  } catch {
    return internalError("Failed to generate invoice");
  }
}
