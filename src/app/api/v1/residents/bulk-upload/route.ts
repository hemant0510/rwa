import { NextRequest, NextResponse } from "next/server";

import { randomBytes } from "crypto";

import { z } from "zod";

import { internalError } from "@/lib/api-helpers";
import { generateRWAID } from "@/lib/fee-calculator";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const bulkRecordSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number"),
  ownershipType: z.enum(["OWNER", "TENANT"]),
  unitAddress: z
    .object({
      flatNo: z.string().optional(),
      towerBlock: z.string().optional(),
      floorLevel: z.string().optional(),
    })
    .optional(),
  registrationYear: z
    .number()
    .int()
    .min(2010)
    .max(new Date().getFullYear() + 1)
    .optional(),
});

const bulkUploadSchema = z.object({
  societyCode: z.string().min(4).max(8),
  records: z.array(bulkRecordSchema).min(1).max(10),
});

export type BulkRecordResult = {
  rowIndex: number;
  success: boolean;
  rwaid?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 },
      );
    }

    const { societyCode, records } = parsed.data;

    const society = await prisma.society.findUnique({
      where: { societyCode: societyCode.toUpperCase() },
    });

    if (!society || society.status === "SUSPENDED" || society.status === "OFFBOARDED") {
      return NextResponse.json(
        { error: { code: "INVALID_SOCIETY", message: "Society not found or inactive" } },
        { status: 404 },
      );
    }

    const supabaseAdmin = createAdminClient();
    const currentYear = new Date().getFullYear();

    const results: BulkRecordResult[] = [];

    // Process records sequentially to avoid RWAID counter race conditions
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const year = record.registrationYear ?? currentYear;

      try {
        // Check duplicate email in this society
        const existingByEmail = await prisma.user.findFirst({
          where: { societyId: society.id, email: record.email, role: "RESIDENT" },
          select: { id: true, status: true },
        });

        const blockingStatuses = new Set([
          "ACTIVE_PAID",
          "ACTIVE_PENDING",
          "ACTIVE_OVERDUE",
          "ACTIVE_PARTIAL",
          "ACTIVE_EXEMPTED",
          "MIGRATED_PENDING",
          "DORMANT",
        ]);

        if (existingByEmail && blockingStatuses.has(existingByEmail.status)) {
          results.push({
            rowIndex: i,
            success: false,
            error: "Email is already registered in this society",
          });
          continue;
        }

        // Check duplicate mobile in this society
        const existingByMobile = await prisma.user.findFirst({
          where: { societyId: society.id, mobile: record.mobile, role: "RESIDENT" },
          select: { id: true, status: true },
        });

        if (existingByMobile && blockingStatuses.has(existingByMobile.status)) {
          results.push({
            rowIndex: i,
            success: false,
            error: "Mobile number is already registered in this society",
          });
          continue;
        }

        // Count existing RWAIDs for this year to determine next sequence
        const existingYearCount = await prisma.user.count({
          where: {
            societyId: society.id,
            role: "RESIDENT",
            rwaid: { contains: `-${year}-` },
          },
        });

        const rwaid = generateRWAID(society.societyId, year, existingYearCount + 1);

        // Create or reuse Supabase Auth account
        let authUserId: string;

        const existingAuthUser = await prisma.user.findFirst({
          where: { email: record.email, authUserId: { not: null } },
          select: { authUserId: true },
        });

        if (existingAuthUser?.authUserId) {
          authUserId = existingAuthUser.authUserId;
        } else {
          const tempPassword = randomBytes(16).toString("hex");
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: record.email,
            password: tempPassword,
            email_confirm: true,
          });

          if (authError) {
            results.push({
              rowIndex: i,
              success: false,
              error: `Auth account error: ${authError.message}`,
            });
            continue;
          }
          authUserId = authData.user.id;
        }

        const now = new Date();

        // Create user + unit in a transaction
        await prisma.$transaction(async (tx: TransactionClient) => {
          const newUser = await tx.user.create({
            data: {
              society: { connect: { id: society.id } },
              authUserId,
              name: record.fullName,
              mobile: record.mobile,
              email: record.email,
              role: "RESIDENT",
              ownershipType: record.ownershipType,
              status: "ACTIVE_PENDING",
              rwaid,
              isEmailVerified: true,
              joiningFeePaid: true,
              consentWhatsapp: true,
              consentWhatsappAt: now,
              approvedAt: now,
              activatedAt: now,
            },
          });

          if (record.unitAddress && Object.keys(record.unitAddress).length > 0) {
            const addr = record.unitAddress;
            const t = (val: string | undefined, max: number) => (val ? val.slice(0, max) : null);

            const labelParts = [addr.towerBlock, addr.flatNo, addr.floorLevel].filter(Boolean);
            const displayLabel = (labelParts.join("-") || "Unit").slice(0, 50);

            const unit = await tx.unit.create({
              data: {
                society: { connect: { id: society.id } },
                displayLabel,
                towerBlock: t(addr.towerBlock, 20),
                flatNo: t(addr.flatNo, 20),
                floorLevel: t(addr.floorLevel, 10),
                unitStatus: "OCCUPIED",
                ...(record.ownershipType === "OWNER"
                  ? { primaryOwner: { connect: { id: newUser.id } } }
                  : {}),
                ...(record.ownershipType === "TENANT"
                  ? { currentTenant: { connect: { id: newUser.id } } }
                  : {}),
              },
            });

            await tx.userUnit.create({
              data: {
                user: { connect: { id: newUser.id } },
                unit: { connect: { id: unit.id } },
                relationship: record.ownershipType,
              },
            });
          }
        });

        results.push({ rowIndex: i, success: true, rwaid });
      } catch (err) {
        console.error(`Bulk upload error at row ${i}:`, err);
        results.push({
          rowIndex: i,
          success: false,
          error: "Failed to create resident — please check the data and try again",
        });
      }
    }

    return NextResponse.json({ results });
  } catch {
    return internalError("Bulk upload failed");
  }
}
