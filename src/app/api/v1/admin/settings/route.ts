import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

const updateSettingsSchema = z.object({
  emailVerificationRequired: z.boolean().optional(),
  joiningFee: z.number().min(0).max(100000).optional(),
  annualFee: z.number().min(0).max(100000).optional(),
  gracePeriodDays: z.number().int().min(1).max(365).optional(),
  feeSessionStartMonth: z.number().int().min(1).max(12).optional(),
});

export async function GET() {
  try {
    const admin = await getFullAccessAdmin();
    if (!admin) return forbiddenError("Only admins with full access can view settings");
    const societyId = admin.societyId;

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: {
        emailVerificationRequired: true,
        joiningFee: true,
        annualFee: true,
        gracePeriodDays: true,
        feeSessionStartMonth: true,
      },
    });

    if (!society) return forbiddenError("Society not found");

    const feeSessions = await prisma.feeSession.findMany({
      where: { societyId },
      orderBy: { sessionYear: "desc" },
    });

    return NextResponse.json({
      emailVerificationRequired: society.emailVerificationRequired,
      joiningFee: Number(society.joiningFee),
      annualFee: Number(society.annualFee),
      gracePeriodDays: society.gracePeriodDays,
      feeSessionStartMonth: society.feeSessionStartMonth,
      feeSessions: feeSessions.map((s) => ({
        id: s.id,
        sessionYear: s.sessionYear,
        annualFee: Number(s.annualFee),
        joiningFee: Number(s.joiningFee),
        sessionStart: s.sessionStart,
        sessionEnd: s.sessionEnd,
        gracePeriodEnd: s.gracePeriodEnd,
        status: s.status,
      })),
    });
  } catch (err) {
    console.error("Settings fetch error:", err);
    return internalError("Failed to fetch settings");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getFullAccessAdmin();
    if (!admin) return forbiddenError("Only admins with full access can update settings");
    const societyId = admin.societyId;

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid settings data" } },
        { status: 422 },
      );
    }

    const updates: Record<string, boolean | number> = {};
    if (typeof parsed.data.emailVerificationRequired === "boolean") {
      updates.emailVerificationRequired = parsed.data.emailVerificationRequired;
    }
    if (typeof parsed.data.joiningFee === "number") {
      updates.joiningFee = parsed.data.joiningFee;
    }
    if (typeof parsed.data.annualFee === "number") {
      updates.annualFee = parsed.data.annualFee;
    }
    if (typeof parsed.data.gracePeriodDays === "number") {
      updates.gracePeriodDays = parsed.data.gracePeriodDays;
    }
    if (typeof parsed.data.feeSessionStartMonth === "number") {
      updates.feeSessionStartMonth = parsed.data.feeSessionStartMonth;
    }

    const updated = await prisma.society.update({
      where: { id: societyId },
      data: updates,
      select: {
        emailVerificationRequired: true,
        joiningFee: true,
        annualFee: true,
        gracePeriodDays: true,
        feeSessionStartMonth: true,
      },
    });

    return NextResponse.json({
      emailVerificationRequired: updated.emailVerificationRequired,
      joiningFee: Number(updated.joiningFee),
      annualFee: Number(updated.annualFee),
      gracePeriodDays: updated.gracePeriodDays,
      feeSessionStartMonth: updated.feeSessionStartMonth,
      message: "Settings updated successfully",
    });
  } catch (err) {
    console.error("Settings update error:", err);
    return internalError("Failed to update settings");
  }
}
