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
  ownershipType: z.enum(["OWNER", "TENANT"]),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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

    // Check duplicate mobile in same society
    const existingUser = await prisma.user.findFirst({
      where: { societyId: society.id, mobile: data.mobile, role: "RESIDENT" },
    });

    if (existingUser) {
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

    // Create Supabase Auth account
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) {
      const message = authError.message.includes("already been registered")
        ? "This email is already registered. Please use a different email or sign in."
        : authError.message;
      return NextResponse.json(
        { error: { code: "AUTH_ERROR", message, status: 400 } },
        { status: 400 },
      );
    }

    // Create pending user + unit in a transaction
    try {
      const user = await prisma.$transaction(async (tx: TransactionClient) => {
        const newUser = await tx.user.create({
          data: {
            societyId: society.id,
            authUserId: authData.user.id,
            name: data.fullName,
            mobile: data.mobile,
            email: data.email,
            role: "RESIDENT",
            ownershipType: data.ownershipType,
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
              societyId: society.id,
              displayLabel,
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
              primaryOwnerId: data.ownershipType === "OWNER" ? newUser.id : null,
              currentTenantId: data.ownershipType === "TENANT" ? newUser.id : null,
            },
          });

          await tx.userUnit.create({
            data: {
              userId: newUser.id,
              unitId: unit.id,
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
      // Rollback: delete Supabase Auth user if Prisma transaction fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("Registration error:", err);
      return internalError("Failed to register");
    }
  } catch (err) {
    console.error("Registration error:", err);
    return internalError("Failed to register");
  }
}
