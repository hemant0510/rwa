import { NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";

import { notFoundError, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

import { InvoicePDFDocument } from "./invoice-document";

// GET /api/v1/societies/[id]/subscription/invoices/[invoiceId]/pdf
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  try {
    const { id: societyId, invoiceId } = await params;

    const invoice = await prisma.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        society: {
          select: { name: true, code: true, address: true, city: true, state: true, pincode: true },
        },
        payments: {
          where: { isReversal: false, isReversed: false },
          select: { amount: true, paymentMode: true, paymentDate: true, referenceNo: true },
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    if (!invoice || invoice.societyId !== societyId) return notFoundError("Invoice not found");

    const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const stream = await ReactPDF.renderToStream(
      InvoicePDFDocument({
        invoiceNo: invoice.invoiceNo,
        status: invoice.status,
        planName: invoice.planName,
        billingCycle: invoice.billingCycle,
        periodStart: invoice.periodStart.toISOString().slice(0, 10),
        periodEnd: invoice.periodEnd.toISOString().slice(0, 10),
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        baseAmount: Number(invoice.baseAmount),
        discountAmount: Number(invoice.discountAmount),
        finalAmount: Number(invoice.finalAmount),
        paidAmount,
        society: {
          name: invoice.society.name,
          code: invoice.society.code ?? "",
          address: invoice.society.address ?? "",
          city: invoice.society.city ?? "",
          state: invoice.society.state ?? "",
          pincode: invoice.society.pincode ?? "",
        },
        payments: invoice.payments.map((p) => ({
          amount: Number(p.amount),
          mode: p.paymentMode,
          date: p.paymentDate.toISOString().slice(0, 10),
          referenceNo: p.referenceNo ?? "-",
        })),
        createdAt: invoice.createdAt.toISOString().slice(0, 10),
      }),
    );

    // Convert Node ReadableStream to Uint8Array
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNo}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate invoice PDF");
  }
}
