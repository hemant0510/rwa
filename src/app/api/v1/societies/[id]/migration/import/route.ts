import { NextRequest, NextResponse } from "next/server";

import { randomBytes } from "crypto";

import { z } from "zod";

import { unauthorizedError, notFoundError, internalError } from "@/lib/api-helpers";
import { ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS, APP_URL } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { getWelcomeSetupEmailHtml } from "@/lib/email-templates/welcome-setup";
import {
  generateRWAID,
  getSessionYear,
  getSessionDates,
  generateUnitDisplayLabel,
} from "@/lib/fee-calculator";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePasswordResetToken } from "@/lib/tokens";

const importRecordSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  ownershipType: z.enum(["OWNER", "TENANT"]),
  feeStatus: z.enum(["PAID", "PENDING"]),
  unitFields: z.record(z.string(), z.string()).optional().default({}),
});

const importBodySchema = z.object({
  records: z.array(importRecordSchema).min(1).max(200),
});

export type ImportRecordResult = {
  rowIndex: number;
  success: boolean;
  rwaid?: string;
  error?: string;
};

// POST /api/v1/societies/[id]/migration/import
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const currentUser = await getCurrentUser("RWA_ADMIN");
    if (!currentUser || currentUser.societyId !== societyId) {
      return unauthorizedError("Not authorized");
    }

    const body = await request.json();
    const parsed = importBodySchema.safeParse(body);

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

    const { records } = parsed.data;

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: {
        id: true,
        societyId: true,
        name: true,
        type: true,
        annualFee: true,
        feeSessionStartMonth: true,
      },
    });

    if (!society) return notFoundError("Society not found");

    const supabaseAdmin = createAdminClient();
    const now = new Date();
    const currentYear = now.getFullYear();
    const sessionStartMonth = society.feeSessionStartMonth ?? 4;
    const sessionYear = getSessionYear(now, sessionStartMonth);
    const { start: sessionStart, end: sessionEnd } = getSessionDates(
      sessionYear,
      sessionStartMonth,
    );
    const annualFee = Number(society.annualFee ?? 0);

    const results: ImportRecordResult[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const year = currentYear;

      try {
        // Duplicate checks
        const existingByEmail = await prisma.user.findFirst({
          where: { societyId, email: record.email, role: "RESIDENT" },
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
          results.push({ rowIndex: i, success: false, error: "Email already exists in society" });
          continue;
        }

        const existingByMobile = await prisma.user.findFirst({
          where: { societyId, mobile: record.mobile, role: "RESIDENT" },
          select: { id: true, status: true },
        });

        if (existingByMobile && blockingStatuses.has(existingByMobile.status)) {
          results.push({
            rowIndex: i,
            success: false,
            error: "Mobile already registered in society",
          });
          continue;
        }

        // Generate RWAID
        const existingYearCount = await prisma.user.count({
          where: {
            societyId,
            role: "RESIDENT",
            rwaid: { contains: `-${year}-` },
          },
        });
        const rwaid = generateRWAID(society.societyId, year, existingYearCount + 1);

        // Create or reuse Supabase auth account
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

        // Build unit display label
        const unitFields = record.unitFields ?? {};
        const hasUnitFields = Object.keys(unitFields).length > 0;
        const displayLabel = hasUnitFields
          ? generateUnitDisplayLabel(society.type ?? "APARTMENT_COMPLEX", unitFields) || "Unit"
          : null;

        // Create user + unit + membership fee in transaction
        const { id: newUserId } = await prisma.$transaction(async (tx: TransactionClient) => {
          const userStatus = record.feeStatus === "PAID" ? "ACTIVE_PAID" : "MIGRATED_PENDING";

          const newUser = await tx.user.create({
            data: {
              society: { connect: { id: societyId } },
              authUserId,
              name: record.fullName,
              mobile: record.mobile,
              email: record.email,
              role: "RESIDENT",
              ownershipType: record.ownershipType,
              status: userStatus,
              rwaid,
              isEmailVerified: true,
              joiningFeePaid: true,
              consentWhatsapp: true,
              consentWhatsappAt: now,
              approvedAt: now,
              activatedAt: now,
            },
          });

          // Create unit if unit fields provided
          if (hasUnitFields && displayLabel) {
            const unit = await tx.unit.create({
              data: {
                society: { connect: { id: societyId } },
                displayLabel: displayLabel.slice(0, 50),
                towerBlock: unitFields.towerBlock?.slice(0, 20) ?? null,
                flatNo: unitFields.flatNo?.slice(0, 20) ?? null,
                floorNo: unitFields.floorNo?.slice(0, 10) ?? null,
                floorLevel: unitFields.floorLevel?.slice(0, 10) ?? null,
                villaNo: unitFields.villaNo?.slice(0, 20) ?? null,
                streetPhase: unitFields.streetPhase?.slice(0, 20) ?? null,
                houseNo: unitFields.houseNo?.slice(0, 20) ?? null,
                streetGali: unitFields.streetGali?.slice(0, 30) ?? null,
                sectorBlock: unitFields.sectorBlock?.slice(0, 20) ?? null,
                plotNo: unitFields.plotNo?.slice(0, 20) ?? null,
                laneNo: unitFields.laneNo?.slice(0, 20) ?? null,
                phase: unitFields.phase?.slice(0, 20) ?? null,
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

          // Create membership fee record for this session
          if (annualFee > 0) {
            const feeStatus = record.feeStatus === "PAID" ? "PAID" : "PENDING";
            await tx.membershipFee.create({
              data: {
                society: { connect: { id: societyId } },
                user: { connect: { id: newUser.id } },
                sessionYear,
                sessionStart,
                sessionEnd,
                amountDue: annualFee,
                amountPaid: record.feeStatus === "PAID" ? annualFee : 0,
                status: feeStatus,
                isPreMigration: true,
              },
            });
          }

          return newUser;
        });

        // Send welcome email (best-effort)
        try {
          const setupToken = await generatePasswordResetToken(
            newUserId,
            ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS,
          );
          const setupUrl = `${APP_URL}/reset-password?token=${setupToken}`;
          await sendEmail(
            record.email,
            `Welcome to ${society.name} — Create your password`,
            getWelcomeSetupEmailHtml(record.fullName, society.name, setupUrl),
          );
        } catch (emailErr) {
          console.warn(
            `Migration import: failed to send setup email to ${record.email}:`,
            emailErr,
          );
        }

        results.push({ rowIndex: i, success: true, rwaid });
      } catch (err) {
        console.error(`Migration import error at row ${i}:`, err);
        results.push({
          rowIndex: i,
          success: false,
          error: "Failed to create resident — please check the data and try again",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      results,
      summary: { total: records.length, imported: successCount, failed: failCount },
    });
  } catch {
    return internalError("Import failed");
  }
}
