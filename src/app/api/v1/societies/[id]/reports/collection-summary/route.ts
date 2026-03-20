import { NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";
import * as XLSX from "xlsx";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getSessionYear } from "@/lib/fee-calculator";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

import { CollectionSummaryDocument } from "../report-document";

async function getCollectionData(societyId: string, sessionYear: string) {
  const [paidAgg, pendingAgg, expensesAgg] = await Promise.all([
    prisma.membershipFee.aggregate({
      where: { societyId, sessionYear, status: "PAID" },
      _sum: { amountPaid: true },
      _count: true,
    }),
    prisma.membershipFee.aggregate({
      where: { societyId, sessionYear, status: { in: ["PENDING", "OVERDUE"] } },
      _sum: { amountDue: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { societyId, status: "ACTIVE" },
      _sum: { amount: true },
    }),
  ]);

  const totalCollected = Number(paidAgg._sum.amountPaid ?? 0);
  const totalOutstanding = Number(pendingAgg._sum.amountDue ?? 0);
  const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
  const paidCount = paidAgg._count;
  const pendingCount = pendingAgg._count;
  const totalResidents = paidCount + pendingCount;
  const balance = totalCollected - totalExpenses;

  return {
    totalResidents,
    paidCount,
    pendingCount,
    totalCollected,
    totalOutstanding,
    totalExpenses,
    balance,
  };
}

// GET /api/v1/societies/[id]/reports/collection-summary?session=2025-26&format=pdf|excel
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser || currentUser.societyId !== societyId) {
      return unauthorizedError("Not authorized");
    }

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, feeSessionStartMonth: true },
    });

    if (!society) return notFoundError("Society not found");

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "pdf";
    const sessionYear =
      searchParams.get("session") ?? getSessionYear(new Date(), society.feeSessionStartMonth ?? 4);

    const data = await getCollectionData(societyId, sessionYear);
    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const safeName = society.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const fmt = (n: number) => n.toLocaleString("en-IN");

    if (format === "excel") {
      const rows = [
        ["Financial Summary — " + society.name],
        ["Session", sessionYear],
        ["Generated", generatedAt],
        [""],
        ["Metric", "Value"],
        ["Total Residents", data.totalResidents],
        ["Paid", data.paidCount],
        ["Pending", data.pendingCount],
        ["Total Collected (₹)", fmt(data.totalCollected)],
        ["Total Outstanding (₹)", fmt(data.totalOutstanding)],
        ["Total Expenses (₹)", fmt(data.totalExpenses)],
        ["Balance in Hand (₹)", fmt(data.balance)],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Collection Summary");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="collection-summary-${safeName}-${sessionYear}.xlsx"`,
        },
      });
    }

    // PDF
    const stream = await ReactPDF.renderToStream(
      CollectionSummaryDocument({
        societyName: society.name,
        sessionYear,
        generatedAt,
        ...data,
      }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="collection-summary-${safeName}-${sessionYear}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate collection summary report");
  }
}
