import { NextRequest, NextResponse } from "next/server";

import { parseBody, internalError, errorResponse } from "@/lib/api-helpers";
import { TRIAL_PERIOD_DAYS, DEFAULT_JOINING_FEE, DEFAULT_ANNUAL_FEE } from "@/lib/constants";
import { generateSocietyId } from "@/lib/fee-calculator";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerSocietySchema } from "@/lib/validations/register-society";
import { isVerificationRequired, sendVerificationEmail, autoVerifyUser } from "@/lib/verification";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per hour
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = checkRateLimit(`register-society:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return errorResponse({
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many registration attempts. Please try again later.",
        status: 429,
      });
    }

    const { data, error } = await parseBody(request, registerSocietySchema);
    if (error) return error;
    if (!data) return internalError();

    // Check code uniqueness
    const existing = await prisma.society.findUnique({
      where: { societyCode: data.societyCode },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_CODE", message: "Society code already exists", status: 409 } },
        { status: 409 },
      );
    }

    // Create Supabase Auth user
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.adminEmail,
      password: data.adminPassword,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        { error: { code: "AUTH_ERROR", message: authError.message, status: 400 } },
        { status: 400 },
      );
    }

    // Generate city code
    const cityCode = data.city
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .replace(/[AEIOU]/g, "")
      .slice(0, 3)
      .padEnd(
        3,
        data.city
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .charAt(0),
      );

    const pincodeCount = await prisma.society.count({ where: { pincode: data.pincode } });
    const societyId = generateSocietyId(data.state, cityCode, data.pincode, pincodeCount + 1);

    // Calculate trial end date
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_PERIOD_DAYS);

    try {
      const result = await prisma.$transaction(async (tx: TransactionClient) => {
        const society = await tx.society.create({
          data: {
            societyId,
            societyCode: data.societyCode,
            name: data.name,
            state: data.state,
            city: data.city,
            cityCode,
            pincode: data.pincode,
            type: data.type,
            joiningFee: DEFAULT_JOINING_FEE,
            annualFee: DEFAULT_ANNUAL_FEE,
            status: "TRIAL",
            trialEndsAt,
          },
        });

        const admin = await tx.user.create({
          data: {
            societyId: society.id,
            authUserId: authData.user.id,
            name: data.adminName,
            email: data.adminEmail,
            mobile: data.adminMobile,
            role: "RWA_ADMIN",
            adminPermission: "FULL_ACCESS",
            status: "ACTIVE_PAID",
            consentWhatsapp: true,
          },
        });

        const termEnd = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        await tx.adminTerm.create({
          data: {
            userId: admin.id,
            societyId: society.id,
            position: "PRIMARY",
            permission: "FULL_ACCESS",
            termStart: now,
            termEnd,
          },
        });

        return { society, admin };
      });

      // Handle email verification
      const requiresVerification = await isVerificationRequired(result.society.id);
      if (requiresVerification) {
        await sendVerificationEmail(result.admin.id, data.adminEmail, data.adminName);
      } else {
        await autoVerifyUser(result.admin.id);
      }

      return NextResponse.json(
        {
          society: result.society,
          requiresVerification,
          message: requiresVerification
            ? "Society registered! Please verify your email to continue."
            : "Society registered successfully. You can now sign in.",
        },
        { status: 201 },
      );
    } catch (err) {
      // Rollback Supabase auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("Self-registration error:", err);
      return internalError("Failed to register society");
    }
  } catch (err) {
    console.error("Self-registration error:", err);
    return internalError("Failed to register society");
  }
}
