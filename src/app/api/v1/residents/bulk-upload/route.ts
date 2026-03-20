import { NextRequest, NextResponse } from "next/server";

import { randomBytes } from "crypto";

import { z } from "zod";

import { internalError, unauthorizedError, forbiddenError } from "@/lib/api-helpers";
import { ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS, APP_URL } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { getWelcomeSetupEmailHtml } from "@/lib/email-templates/welcome-setup";
import { generateRWAID } from "@/lib/fee-calculator";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePasswordResetToken } from "@/lib/tokens";

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
  records: z.array(bulkRecordSchema).min(1).max(100),
});

export type BulkRecordResult = {
  rowIndex: number;
  success: boolean;
  rwaid?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Auth guard: must be a FULL_ACCESS admin
    const admin = await getFullAccessAdmin();
    if (!admin) return unauthorizedError("Admin authentication required");

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

    // Verify the authenticated admin belongs to this society
    if (admin.societyId !== society.id) {
      return forbiddenError("Access denied to this society");
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

        // Create or reuse Supabase Auth account.
        // NOTE: We intentionally look up the auth account across all societies.
        // A resident who belongs to multiple societies shares one Supabase Auth
        // account (one login), linked to multiple DB user rows. This is by design
        // and simplifies the resident login experience.
        let authUserId: string;
        let authUserCreatedInThisRequest = false;

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
          authUserCreatedInThisRequest = true;
        }

        // Count existing RWAIDs for this year to determine next sequence.
        // Retry up to 3 times on unique constraint collision (P2002).
        const existingYearCount = await prisma.user.count({
          where: {
            societyId: society.id,
            role: "RESIDENT",
            rwaid: { contains: `-${year}-` },
          },
        });

        const now = new Date();
        let newUserId: string | null = null;
        let rwaid: string | null = null;
        let lastTxError: unknown = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          rwaid = generateRWAID(society.societyId, year, existingYearCount + 1 + attempt);

          try {
            const result = await prisma.$transaction(async (tx: TransactionClient) => {
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
                const t = (val: string | undefined, max: number) =>
                  val ? val.slice(0, max) : null;

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

              return newUser;
            });

            newUserId = result.id;
            lastTxError = null;
            break; // success — exit retry loop
          } catch (txErr) {
            lastTxError = txErr;
            // P2002 = unique constraint violation — RWAID collision, retry with next sequence
            if (
              typeof txErr === "object" &&
              txErr !== null &&
              "code" in txErr &&
              (txErr as { code: string }).code === "P2002"
            ) {
              continue;
            }
            // Any other error — break immediately, don't retry
            break;
          }
        }

        // If all retries failed, clean up the freshly created Supabase auth user
        if (newUserId === null) {
          if (authUserCreatedInThisRequest) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(authUserId);
            } catch (cleanupErr) {
              console.error(
                `Bulk upload: failed to clean up orphaned auth user ${authUserId}:`,
                cleanupErr,
              );
            }
          }
          console.error(`Bulk upload error at row ${i}:`, lastTxError);
          results.push({
            rowIndex: i,
            success: false,
            error: "Failed to create resident — please check the data and try again",
          });
          continue;
        }

        // Send "Create your password" welcome email (best-effort — don't fail the row on email error)
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
          console.warn(`Bulk upload: failed to send setup email to ${record.email}:`, emailErr);
        }

        results.push({ rowIndex: i, success: true, rwaid: rwaid! });
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
