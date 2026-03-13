import { NextRequest } from "next/server";

import { parseBody, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { createInvoiceHistory } from "@/lib/billing-server";
import { prisma } from "@/lib/prisma";
import { updateInvoiceSchema } from "@/lib/validations/billing";

// GET /api/v1/societies/[id]/subscription/invoices/[invoiceId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  try {
    const { id: societyId, invoiceId } = await params;
    const invoice = await prisma.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!invoice || invoice.societyId !== societyId) return notFoundError("Invoice not found");

    return successResponse({
      ...invoice,
      baseAmount: Number(invoice.baseAmount),
      discountAmount: Number(invoice.discountAmount),
      finalAmount: Number(invoice.finalAmount),
      payments: invoice.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    });
  } catch {
    return internalError("Failed to fetch invoice details");
  }
}

// PATCH /api/v1/societies/[id]/subscription/invoices/[invoiceId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  try {
    const { id: societyId, invoiceId } = await params;
    const { data, error } = await parseBody(request, updateInvoiceSchema);
    if (error) return error;
    if (!data) return internalError();

    const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.societyId !== societyId) return notFoundError("Invoice not found");

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: {
          status: data.status,
          notes: data.notes ?? invoice.notes,
          paidAt: data.status === "PAID" ? new Date() : invoice.paidAt,
        },
      });

      if (data.status === "WAIVED") {
        await createInvoiceHistory(tx, {
          subscriptionId: invoice.subscriptionId,
          societyId,
          changeType: "INVOICE_WAIVED",
          notes: data.notes ?? `Invoice ${invoice.invoiceNo} waived`,
        });
      }

      return row;
    });

    return successResponse({
      ...updated,
      baseAmount: Number(updated.baseAmount),
      discountAmount: Number(updated.discountAmount),
      finalAmount: Number(updated.finalAmount),
    });
  } catch {
    return internalError("Failed to update invoice");
  }
}
