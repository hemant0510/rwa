import { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

// GET /api/v1/super-admin/billing/invoices
// Lists all subscription invoices across all societies
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
    const skip = (page - 1) * limit;
    const statusFilter = searchParams.get("status");

    let rows: Array<Record<string, unknown>> = [];
    let total = 0;

    try {
      const where: Prisma.SubscriptionInvoiceWhereInput = {};
      if (statusFilter && statusFilter !== "all") {
        where.status = statusFilter as Prisma.EnumInvoiceStatusFilter;
      }

      const [invoices, count] = await Promise.all([
        prisma.subscriptionInvoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            society: { select: { id: true, name: true, societyCode: true } },
            payments: { select: { amount: true } },
          },
        }),
        prisma.subscriptionInvoice.count({ where }),
      ]);
      rows = invoices.map((inv) => {
        const paidAmount = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: inv.id,
          societyId: inv.societyId,
          societyName: inv.society.name,
          societyCode: inv.society.societyCode,
          invoiceNo: inv.invoiceNo,
          planName: inv.planName,
          billingCycle: inv.billingCycle,
          periodStart: inv.periodStart,
          periodEnd: inv.periodEnd,
          baseAmount: Number(inv.baseAmount),
          discountAmount: Number(inv.discountAmount),
          finalAmount: Number(inv.finalAmount),
          paidAmount,
          status: inv.status,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
        };
      });
      total = count;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }

    return successResponse({ rows, total, page, limit });
  } catch {
    return internalError("Failed to fetch all invoices");
  }
}
