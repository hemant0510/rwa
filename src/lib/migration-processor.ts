/**
 * Shared single-record processor for migration import.
 * Used by both the batch import route and the SSE streaming route.
 */
import { randomBytes } from "crypto";

import { ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS, APP_URL } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { getWelcomeSetupEmailHtml } from "@/lib/email-templates/welcome-setup";
import {
  generateRWAID,
  getSessionYear,
  getSessionDates,
  generateUnitDisplayLabel,
} from "@/lib/fee-calculator";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/tokens";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MigrationRecord {
  fullName: string;
  email: string;
  mobile: string;
  ownershipType: "OWNER" | "TENANT";
  feeStatus: "PAID" | "PENDING";
  unitFields?: Record<string, string>;
}

export interface MigrationRecordResult {
  rowIndex: number;
  success: boolean;
  rwaid?: string;
  error?: string;
}

export interface MigrationSocietyContext {
  id: string;
  societyId: string;
  name: string;
  type: string | null;
  annualFee: number;
  sessionYear: string;
  sessionStart: Date;
  sessionEnd: Date;
}

export function buildSocietyContext(society: {
  id: string;
  societyId: string;
  name: string;
  type: string | null;
  annualFee: { toNumber?: () => number; toString: () => string } | number | bigint | null;
  feeSessionStartMonth: number | null;
}): MigrationSocietyContext {
  const now = new Date();
  const sessionStartMonth = society.feeSessionStartMonth ?? 4;
  const sessionYear = getSessionYear(now, sessionStartMonth);
  const { start: sessionStart, end: sessionEnd } = getSessionDates(sessionYear, sessionStartMonth);

  return {
    id: society.id,
    societyId: society.societyId,
    name: society.name,
    type: society.type,
    annualFee: Number(society.annualFee ?? 0),
    sessionYear,
    sessionStart,
    sessionEnd,
  };
}

export async function processSingleRecord(
  record: MigrationRecord,
  rowIndex: number,
  ctx: ReturnType<typeof buildSocietyContext>,
  supabaseAdmin: SupabaseClient,
): Promise<MigrationRecordResult> {
  const now = new Date();
  const year = now.getFullYear();

  try {
    const blockingStatuses = new Set([
      "ACTIVE_PAID",
      "ACTIVE_PENDING",
      "ACTIVE_OVERDUE",
      "ACTIVE_PARTIAL",
      "ACTIVE_EXEMPTED",
      "MIGRATED_PENDING",
      "DORMANT",
    ]);

    // Duplicate check — email
    const existingByEmail = await prisma.user.findFirst({
      where: { societyId: ctx.id, email: record.email, role: "RESIDENT" },
      select: { id: true, status: true },
    });
    if (existingByEmail && blockingStatuses.has(existingByEmail.status)) {
      return { rowIndex, success: false, error: "Email already exists in society" };
    }

    // Duplicate check — mobile
    const existingByMobile = await prisma.user.findFirst({
      where: { societyId: ctx.id, mobile: record.mobile, role: "RESIDENT" },
      select: { id: true, status: true },
    });
    if (existingByMobile && blockingStatuses.has(existingByMobile.status)) {
      return { rowIndex, success: false, error: "Mobile already registered in society" };
    }

    // Generate RWAID
    const existingYearCount = await prisma.user.count({
      where: {
        societyId: ctx.id,
        role: "RESIDENT",
        rwaid: { contains: `-${year}-` },
      },
    });
    const rwaid = generateRWAID(ctx.societyId, year, existingYearCount + 1);

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
        return { rowIndex, success: false, error: `Auth account error: ${authError.message}` };
      }
      authUserId = authData.user.id;
    }

    // Build unit display label
    const unitFields = record.unitFields ?? {};
    const hasUnitFields = Object.keys(unitFields).length > 0;
    const displayLabel = hasUnitFields
      ? generateUnitDisplayLabel(ctx.type ?? "APARTMENT_COMPLEX", unitFields) || "Unit"
      : null;

    // Create user + unit + membership fee in transaction
    const { id: newUserId } = await prisma.$transaction(async (tx: TransactionClient) => {
      const userStatus = record.feeStatus === "PAID" ? "ACTIVE_PAID" : "MIGRATED_PENDING";

      const newUser = await tx.user.create({
        data: {
          society: { connect: { id: ctx.id } },
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

      if (hasUnitFields && displayLabel) {
        const unit = await tx.unit.create({
          data: {
            society: { connect: { id: ctx.id } },
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

      if (ctx.annualFee > 0) {
        const feeStatus = record.feeStatus === "PAID" ? "PAID" : "PENDING";
        await tx.membershipFee.create({
          data: {
            society: { connect: { id: ctx.id } },
            user: { connect: { id: newUser.id } },
            sessionYear: ctx.sessionYear,
            sessionStart: ctx.sessionStart,
            sessionEnd: ctx.sessionEnd,
            amountDue: ctx.annualFee,
            amountPaid: record.feeStatus === "PAID" ? ctx.annualFee : 0,
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
        `Welcome to ${ctx.name} — Create your password`,
        getWelcomeSetupEmailHtml(record.fullName, ctx.name, setupUrl),
      );
    } catch (emailErr) {
      console.warn(`Migration: failed to send setup email to ${record.email}:`, emailErr);
    }

    return { rowIndex, success: true, rwaid };
  } catch (err) {
    console.error(`Migration error at row ${rowIndex}:`, err);
    return {
      rowIndex,
      success: false,
      error: "Failed to create resident — please check the data and try again",
    };
  }
}
