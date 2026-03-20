import { NextRequest, NextResponse } from "next/server";

import * as XLSX from "xlsx";
import { z } from "zod";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

const rowSchema = z.object({
  fullName: z.string().min(2, "Min 2 characters").max(100, "Max 100 characters"),
  email: z.string().email("Invalid email"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number"),
  ownershipType: z.enum(["OWNER", "TENANT"], {
    errorMap: () => ({ message: "Must be OWNER or TENANT" }),
  }),
  feeStatus: z.enum(["PAID", "PENDING"], {
    errorMap: () => ({ message: "Must be PAID or PENDING" }),
  }),
});

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidateResult {
  total: number;
  valid: number;
  invalid: number;
  errors: ValidationError[];
  preview: {
    rowIndex: number;
    fullName: string;
    email: string;
    mobile: string;
    ownershipType: string;
    feeStatus: string;
    unitFields: Record<string, string>;
  }[];
}

// POST /api/v1/societies/[id]/migration/validate
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser || currentUser.societyId !== societyId) {
      return unauthorizedError("Not authorized");
    }

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { id: true, type: true },
    });

    if (!society) return notFoundError("Society not found");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: { code: "MISSING_FILE", message: "No file uploaded" } },
        { status: 400 },
      );
    }

    const arrayBuffer = await (file as Blob).arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: { code: "EMPTY_FILE", message: "Spreadsheet has no data rows" } },
        { status: 422 },
      );
    }

    const errors: ValidationError[] = [];
    const preview: ValidateResult["preview"] = [];
    const seenEmails = new Set<string>();
    const seenMobiles = new Set<string>();

    // Fetch existing emails/mobiles in this society for duplicate checking
    const existingResidents = await prisma.user.findMany({
      where: { societyId, role: "RESIDENT" },
      select: { email: true, mobile: true },
    });
    const dbEmails = new Set(existingResidents.map((r) => r.email.toLowerCase()));
    const dbMobiles = new Set(existingResidents.map((r) => r.mobile ?? "").filter(Boolean));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed with header on row 1

      // Normalise field names — headers may have * suffix
      const get = (candidates: string[]) => {
        for (const c of candidates) {
          if (row[c] !== undefined && row[c] !== "") return String(row[c]).trim();
        }
        return "";
      };

      const fullName = get(["Full Name*", "Full Name"]);
      const email = get(["Email*", "Email"]).toLowerCase();
      const mobile = get(["Mobile*", "Mobile"]);
      const ownershipType = get(["Ownership Type*", "Ownership Type"]).toUpperCase();
      const feeStatus = get(["Fee Status*", "Fee Status"]).toUpperCase();

      // Unit fields (vary by type — pass through whatever is present)
      const unitFields: Record<string, string> = {};
      const unitKeys = [
        ["Tower/Block*", "Tower/Block", "towerBlock"],
        ["Floor No*", "Floor No", "floorNo"],
        ["Flat No*", "Flat No", "flatNo"],
        ["House No*", "House No", "houseNo"],
        ["Floor Level*", "Floor Level", "floorLevel"],
        ["Villa No*", "Villa No", "villaNo"],
        ["Street/Phase", "streetPhase"],
        ["Street/Gali*", "Street/Gali", "streetGali"],
        ["Sector/Block*", "Sector/Block", "sectorBlock"],
        ["Plot No*", "Plot No", "plotNo"],
        ["Lane No", "laneNo"],
        ["Phase", "phase"],
        ["Unit/Address*", "Unit/Address", "unitAddress"],
      ];
      for (const keys of unitKeys) {
        const fieldName = keys[keys.length - 1];
        const val = get(keys.slice(0, -1));
        if (val) unitFields[fieldName] = val;
      }

      // Validate with zod
      const parsed = rowSchema.safeParse({ fullName, email, mobile, ownershipType, feeStatus });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            row: rowNum,
            field: String(issue.path[0] ?? "unknown"),
            message: issue.message,
          });
        }
      }

      // Duplicate checks within file
      if (email && seenEmails.has(email)) {
        errors.push({ row: rowNum, field: "email", message: "Duplicate email in this file" });
      } else if (email) {
        seenEmails.add(email);
      }

      if (mobile && seenMobiles.has(mobile)) {
        errors.push({ row: rowNum, field: "mobile", message: "Duplicate mobile in this file" });
      } else if (mobile) {
        seenMobiles.add(mobile);
      }

      // DB duplicate checks
      if (email && dbEmails.has(email)) {
        errors.push({ row: rowNum, field: "email", message: "Email already exists in society" });
      }
      if (mobile && dbMobiles.has(mobile)) {
        errors.push({
          row: rowNum,
          field: "mobile",
          message: "Mobile already registered in society",
        });
      }

      preview.push({ rowIndex: i, fullName, email, mobile, ownershipType, feeStatus, unitFields });
    }

    const rowsWithErrors = new Set(errors.map((e) => e.row - 2));
    const validCount = rows.length - rowsWithErrors.size;

    const result: ValidateResult = {
      total: rows.length,
      valid: validCount,
      invalid: rowsWithErrors.size,
      errors,
      preview,
    };

    return NextResponse.json(result);
  } catch {
    return internalError("Validation failed");
  }
}
