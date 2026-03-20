import { NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";
import * as XLSX from "xlsx";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getSessionYear } from "@/lib/fee-calculator";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

import { PendingListDocument } from "../report-document";

async function getPendingData(societyId: string, sessionYear: string) {
  const fees = await prisma.membershipFee.findMany({
    where: { societyId, sessionYear, status: { in: ["PENDING", "OVERDUE"] } },
    include: {
      user: {
        select: {
          name: true,
          rwaid: true,
          userUnits: { include: { unit: { select: { displayLabel: true } } }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return fees.map((f) => ({
    name: f.user.name,
    rwaid: f.user.rwaid ?? "",
    unit: f.user.userUnits[0]?.unit.displayLabel ?? "-",
    amountDue: Number(f.amountDue),
  }));
}

// GET /api/v1/societies/[id]/reports/pending-list?session=2025-26&format=pdf|excel
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

    const rows = await getPendingData(societyId, sessionYear);
    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const safeName = society.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    if (format === "excel") {
      const headers = ["Name", "RWAID", "Unit", "Amount Due (₹)"];
      const dataRows = rows.map((r) => [r.name, r.rwaid, r.unit, r.amountDue]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws["!cols"] = headers.map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pending List");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="pending-list-${safeName}-${sessionYear}.xlsx"`,
        },
      });
    }

    // PDF
    const stream = await ReactPDF.renderToStream(
      PendingListDocument({ societyName: society.name, sessionYear, generatedAt, rows }),
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
        "Content-Disposition": `attachment; filename="pending-list-${safeName}-${sessionYear}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate pending list report");
  }
}
