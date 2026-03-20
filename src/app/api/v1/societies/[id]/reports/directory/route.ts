import { NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";
import * as XLSX from "xlsx";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

import { DirectoryDocument } from "../report-document";

async function getDirectoryData(societyId: string) {
  const residents = await prisma.user.findMany({
    where: {
      societyId,
      role: "RESIDENT",
      status: {
        in: [
          "ACTIVE_PAID",
          "ACTIVE_PENDING",
          "ACTIVE_OVERDUE",
          "ACTIVE_PARTIAL",
          "ACTIVE_EXEMPTED",
          "MIGRATED_PENDING",
        ],
      },
    },
    select: {
      name: true,
      rwaid: true,
      mobile: true,
      email: true,
      ownershipType: true,
      units: { include: { unit: { select: { displayLabel: true } } }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  return residents.map((r) => ({
    name: r.name,
    rwaid: r.rwaid ?? "",
    unit: r.units[0]?.unit.displayLabel ?? "-",
    mobile: r.mobile ?? "-",
    email: r.email,
    type: r.ownershipType ?? "-",
  }));
}

// GET /api/v1/societies/[id]/reports/directory?format=pdf|excel
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser || currentUser.societyId !== societyId) {
      return unauthorizedError("Not authorized");
    }

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true },
    });

    if (!society) return notFoundError("Society not found");

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "pdf";

    const rows = await getDirectoryData(societyId);
    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const safeName = society.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    if (format === "excel") {
      const headers = ["Name", "RWAID", "Unit", "Mobile", "Email", "Type"];
      const dataRows = rows.map((r) => [r.name, r.rwaid, r.unit, r.mobile, r.email, r.type]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws["!cols"] = headers.map(() => ({ wch: 24 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Directory");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="directory-${safeName}.xlsx"`,
        },
      });
    }

    // PDF
    const stream = await ReactPDF.renderToStream(
      DirectoryDocument({ societyName: society.name, generatedAt, rows }),
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
        "Content-Disposition": `attachment; filename="directory-${safeName}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate directory report");
  }
}
