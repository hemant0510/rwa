import { NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";
import * as XLSX from "xlsx";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getSessionYear, getSessionDates } from "@/lib/fee-calculator";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

import { ExpenseSummaryDocument } from "../report-document";

async function getExpenseData(societyId: string, sessionYear: string, startMonth: number) {
  const { start, end } = getSessionDates(sessionYear, startMonth);

  // Exclude event-linked expenses — they are tracked under each event's financial summary
  const expenses = await prisma.expense.findMany({
    where: {
      societyId,
      status: "ACTIVE",
      eventId: null,
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });

  const rows = expenses.map((e) => ({
    date: e.date.toISOString().slice(0, 10),
    category: e.category
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    description: e.description,
    amount: Number(e.amount),
  }));

  const totalExpenses = rows.reduce((s, r) => s + r.amount, 0);

  return { rows, totalExpenses };
}

// GET /api/v1/societies/[id]/reports/expense-summary?session=2025-26&format=pdf|excel
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
    const startMonth = society.feeSessionStartMonth ?? 4;
    const sessionYear = searchParams.get("session") ?? getSessionYear(new Date(), startMonth);

    const { rows, totalExpenses } = await getExpenseData(societyId, sessionYear, startMonth);
    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const safeName = society.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    if (format === "excel") {
      const headers = ["Date", "Category", "Description", "Amount (₹)"];
      const dataRows = rows.map((r) => [r.date, r.category, r.description, r.amount]);
      dataRows.push(["", "", "Total", totalExpenses]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 40 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expense Summary");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="expense-summary-${safeName}-${sessionYear}.xlsx"`,
        },
      });
    }

    // PDF
    const stream = await ReactPDF.renderToStream(
      ExpenseSummaryDocument({
        societyName: society.name,
        sessionYear,
        generatedAt,
        rows,
        totalExpenses,
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
        "Content-Disposition": `attachment; filename="expense-summary-${safeName}-${sessionYear}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate expense summary report");
  }
}
