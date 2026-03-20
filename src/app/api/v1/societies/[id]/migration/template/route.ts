import { NextRequest, NextResponse } from "next/server";

import * as XLSX from "xlsx";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

// Column headers per society type
function getColumns(societyType: string): string[] {
  const base = ["Full Name*", "Email*", "Mobile*", "Ownership Type*", "Fee Status*"];
  switch (societyType) {
    case "APARTMENT_COMPLEX":
      return [...base, "Tower/Block*", "Floor No*", "Flat No*"];
    case "BUILDER_FLOORS":
      return [...base, "House No*", "Floor Level*"];
    case "GATED_COMMUNITY_VILLAS":
      return [...base, "Villa No*", "Street/Phase"];
    case "INDEPENDENT_SECTOR":
      return [...base, "House No*", "Street/Gali*", "Sector/Block*"];
    case "PLOTTED_COLONY":
      return [...base, "Plot No*", "Lane No", "Phase"];
    default:
      return [...base, "Unit/Address*"];
  }
}

function getSampleRow(societyType: string): string[] {
  const base = ["John Doe", "john@example.com", "9876543210", "OWNER", "PAID"];
  switch (societyType) {
    case "APARTMENT_COMPLEX":
      return [...base, "A", "3", "301"];
    case "BUILDER_FLOORS":
      return [...base, "12A", "Ground"];
    case "GATED_COMMUNITY_VILLAS":
      return [...base, "V-5", "Phase-2"];
    case "INDEPENDENT_SECTOR":
      return [...base, "45", "Gali-3", "Sector-7"];
    case "PLOTTED_COLONY":
      return [...base, "P-22", "Lane-4", "Phase-1"];
    default:
      return [...base, "Unit-1"];
  }
}

// GET /api/v1/societies/[id]/migration/template
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser || currentUser.societyId !== societyId) {
      return unauthorizedError("Not authorized");
    }

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { name: true, type: true },
    });

    if (!society) return notFoundError("Society not found");

    const societyType = society.type ?? "APARTMENT_COMPLEX";
    const headers = getColumns(societyType);
    const sampleRow = getSampleRow(societyType);

    const wb = XLSX.utils.book_new();

    // Data sheet
    const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    // Set column widths
    dataWs["!cols"] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, dataWs, "Residents");

    // Instructions sheet
    const instructions = [
      ["Migration Template — " + society.name],
      [""],
      ["INSTRUCTIONS"],
      [
        "1. Fill in resident data starting from row 3 (row 2 is a sample — delete or keep as reference)",
      ],
      ["2. Required fields are marked with *"],
      ["3. Ownership Type: OWNER or TENANT"],
      ["4. Fee Status: PAID (already paid this session) or PENDING (still owes fees)"],
      ["5. Mobile: 10-digit Indian mobile number starting with 6-9"],
      ["6. Email must be unique per society"],
      ["7. Do not modify the header row"],
      [""],
      ["FIELD NOTES"],
      ["Full Name", "Min 2 characters, max 100"],
      ["Email", "Valid email address, unique within society"],
      ["Mobile", "10-digit Indian number (6-9 start)"],
      ["Ownership Type", "OWNER or TENANT"],
      ["Fee Status", "PAID = already collected; PENDING = not yet paid"],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instructions);
    instrWs["!cols"] = [{ wch: 40 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, instrWs, "Instructions");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `migration-template-${society.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return internalError("Failed to generate template");
  }
}
