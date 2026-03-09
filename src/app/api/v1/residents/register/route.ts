import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { internalError } from "@/lib/api-helpers";
import { MAX_TRIAL_RESIDENTS } from "@/lib/constants";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerificationRequired, sendVerificationEmail, autoVerifyUser } from "@/lib/verification";

const registerSchema = z.object({
  societyCode: z.string().min(4).max(8),
  fullName: z.string().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  ownershipType: z.enum(["OWNER", "TENANT", "OTHER"]),
  otherOwnershipDetail: z.string().max(100).optional(),
  unitType: z.string().optional(),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  reuseAuth: z.boolean().optional(),
  consentWhatsApp: z.literal(true),
  unitAddress: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 },
      );
    }

    const data = parsed.data;

    // Find society
    const society = await prisma.society.findUnique({
      where: { societyCode: data.societyCode.toUpperCase() },
    });

    if (!society || society.status === "SUSPENDED" || society.status === "OFFBOARDED") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SOCIETY",
            message: "Society code not found. Please check with your RWA admin.",
          },
        },
        { status: 404 },
      );
    }

    // Enforce trial resident limit
    if (society.status === "TRIAL") {
      const residentCount = await prisma.user.count({
        where: { societyId: society.id, role: "RESIDENT" },
      });
      if (residentCount >= MAX_TRIAL_RESIDENTS) {
        return NextResponse.json(
          {
            error: {
              code: "TRIAL_LIMIT_REACHED",
              message: `Trial societies can have at most ${MAX_TRIAL_RESIDENTS} residents. Please upgrade to add more.`,
            },
          },
          { status: 403 },
        );
      }
    }

    // Statuses that actively block re-registration (user is live in the system)
    const blockingStatuses = new Set([
      "ACTIVE_PAID",
      "ACTIVE_PENDING",
      "ACTIVE_OVERDUE",
      "ACTIVE_PARTIAL",
      "ACTIVE_EXEMPTED",
      "MIGRATED_PENDING",
      "DORMANT",
    ]);

    // Check duplicate mobile in same society
    const existingByMobile = await prisma.user.findFirst({
      where: { societyId: society.id, mobile: data.mobile, role: "RESIDENT" },
      select: { id: true, status: true, name: true },
    });

    if (existingByMobile) {
      if (blockingStatuses.has(existingByMobile.status)) {
        return NextResponse.json(
          {
            error: {
              code: "DUPLICATE_MOBILE",
              message: "This mobile number is already registered in this society.",
            },
          },
          { status: 409 },
        );
      }
      // Non-blocking status (PENDING_APPROVAL, DEACTIVATED, REJECTED, etc.)
      // Clean up the stale record so re-registration can proceed
      await prisma.userUnit.deleteMany({ where: { userId: existingByMobile.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: existingByMobile.id } });
      await prisma.notificationPreference.deleteMany({ where: { userId: existingByMobile.id } });
      await prisma.notification.deleteMany({ where: { userId: existingByMobile.id } });
      await prisma.auditLog.deleteMany({ where: { userId: existingByMobile.id } });
      await prisma.user.delete({ where: { id: existingByMobile.id } });
    }

    // Check duplicate email in same society
    const existingByEmail = await prisma.user.findFirst({
      where: { societyId: society.id, email: data.email, role: "RESIDENT" },
      select: { id: true, status: true, name: true },
    });

    if (existingByEmail) {
      if (blockingStatuses.has(existingByEmail.status)) {
        return NextResponse.json(
          {
            error: {
              code: "DUPLICATE_EMAIL",
              message: "This email is already registered in this society.",
            },
          },
          { status: 409 },
        );
      }
      // Clean up stale email record
      await prisma.userUnit.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.notificationPreference.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.notification.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.auditLog.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.user.delete({ where: { id: existingByEmail.id } });
    }

    // Check blacklist
    const blacklisted = await prisma.blacklistedNumber.findFirst({
      where: { societyId: society.id, mobile: data.mobile },
    });

    if (blacklisted) {
      return NextResponse.json(
        { error: { code: "BLOCKED", message: "Unable to process registration. Contact admin." } },
        { status: 403 },
      );
    }

    // Create or reuse Supabase Auth account
    const supabaseAdmin = createAdminClient();
    let authUserId: string;
    let isNewAuthUser = false;

    if (data.reuseAuth) {
      // Client detected existing auth account — look up directly
      const existingAuth = await prisma.user.findFirst({
        where: { email: data.email, authUserId: { not: null } },
        select: { authUserId: true },
      });
      if (!existingAuth?.authUserId) {
        return NextResponse.json(
          {
            error: {
              code: "AUTH_ERROR",
              message: "Existing account not found. Please use a password.",
            },
          },
          { status: 400 },
        );
      }
      authUserId = existingAuth.authUserId;
    } else {
      if (!data.password) {
        return NextResponse.json(
          {
            error: { code: "VALIDATION_ERROR", message: "Password is required for new accounts." },
          },
          { status: 422 },
        );
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes("already been registered")) {
          // Email exists in Supabase Auth (registered in another society) — reuse existing auth account
          const existingAuth = await prisma.user.findFirst({
            where: { email: data.email, authUserId: { not: null } },
            select: { authUserId: true },
          });
          if (!existingAuth?.authUserId) {
            return NextResponse.json(
              { error: { code: "AUTH_ERROR", message: "Account issue. Please contact admin." } },
              { status: 400 },
            );
          }
          authUserId = existingAuth.authUserId;
        } else {
          return NextResponse.json(
            { error: { code: "AUTH_ERROR", message: authError.message } },
            { status: 400 },
          );
        }
      } else {
        authUserId = authData.user.id;
        isNewAuthUser = true;
      }
    }

    // Create pending user + unit in a transaction
    try {
      const user = await prisma.$transaction(async (tx: TransactionClient) => {
        const newUser = await tx.user.create({
          data: {
            society: { connect: { id: society.id } },
            authUserId,
            name: data.fullName,
            mobile: data.mobile,
            email: data.email,
            role: "RESIDENT",
            ownershipType: data.ownershipType,
            otherOwnershipDetail:
              data.ownershipType === "OTHER" ? (data.otherOwnershipDetail?.trim() ?? null) : null,
            status: "PENDING_APPROVAL",
            consentWhatsapp: data.consentWhatsApp,
            consentWhatsappAt: new Date(),
          },
        });

        // Create unit from address fields and link to user
        if (data.unitAddress && Object.keys(data.unitAddress).length > 0) {
          const addr = data.unitAddress;
          // Truncate helper matching DB VarChar limits
          const t = (val: string | undefined, max: number) => (val ? val.slice(0, max) : null);
          // Build display label from available fields
          const labelParts = [
            addr.towerBlock,
            addr.flatNo,
            addr.houseNo,
            addr.villaNo,
            addr.plotNo,
            addr.floorLevel,
          ].filter(Boolean);
          const displayLabel = (labelParts.join("-") || "Unit").slice(0, 50);

          const unit = await tx.unit.create({
            data: {
              society: { connect: { id: society.id } },
              displayLabel,
              unitType: t(data.unitType, 20),
              towerBlock: t(addr.towerBlock, 20),
              floorNo: t(addr.floorNo, 10),
              flatNo: t(addr.flatNo, 20),
              houseNo: t(addr.houseNo, 20),
              floorLevel: t(addr.floorLevel, 10),
              villaNo: t(addr.villaNo, 20),
              streetPhase: t(addr.streetPhase, 30),
              sectorBlock: t(addr.sectorBlock, 20),
              streetGali: t(addr.streetGali, 20),
              plotNo: t(addr.plotNo, 20),
              laneNo: t(addr.laneNo, 20),
              phase: t(addr.phase, 20),
              unitStatus: "OCCUPIED",
              ...(data.ownershipType === "OWNER"
                ? { primaryOwner: { connect: { id: newUser.id } } }
                : {}),
              ...(data.ownershipType === "TENANT"
                ? { currentTenant: { connect: { id: newUser.id } } }
                : {}),
            },
          });

          await tx.userUnit.create({
            data: {
              user: { connect: { id: newUser.id } },
              unit: { connect: { id: unit.id } },
              relationship: data.ownershipType,
            },
          });
        }

        return newUser;
      });

      // Handle email verification
      const requiresVerification = await isVerificationRequired(society.id);
      if (requiresVerification) {
        await sendVerificationEmail(user.id, data.email, data.fullName);
      } else {
        await autoVerifyUser(user.id);
      }

      return NextResponse.json(
        {
          id: user.id,
          requiresVerification,
          message: requiresVerification
            ? "Registration submitted! Please verify your email."
            : "Registration submitted successfully",
        },
        { status: 201 },
      );
    } catch (err) {
      // Rollback: only delete Supabase Auth user if we created a new one
      if (isNewAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      // Clean up Prisma user if it was created (transaction committed but post-steps failed)
      try {
        const orphan = await prisma.user.findFirst({
          where: { authUserId, societyId: society.id, mobile: data.mobile },
          select: { id: true },
        });
        if (orphan) {
          await prisma.userUnit.deleteMany({ where: { userId: orphan.id } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId: orphan.id } });
          await prisma.user.delete({ where: { id: orphan.id } });
        }
      } catch {
        // Best-effort cleanup
      }
      console.error("Registration error:", err);
      return internalError("Failed to register");
    }
  } catch (err) {
    console.error("Registration error:", err);
    return internalError("Failed to register");
  }
}
