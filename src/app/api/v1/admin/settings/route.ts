import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const updateSettingsSchema = z.object({
  emailVerificationRequired: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authUserId: authUser.id },
      select: { role: true, adminPermission: true, societyId: true },
    });

    if (!user || user.role !== "RWA_ADMIN" || user.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Only admins with full access can view settings");
    }

    if (!user.societyId) {
      return forbiddenError("No society found");
    }

    const society = await prisma.society.findUnique({
      where: { id: user.societyId },
      select: { emailVerificationRequired: true },
    });

    return NextResponse.json({
      emailVerificationRequired: society?.emailVerificationRequired ?? true,
    });
  } catch (err) {
    console.error("Settings fetch error:", err);
    return internalError("Failed to fetch settings");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authUserId: authUser.id },
      select: { role: true, adminPermission: true, societyId: true },
    });

    if (!user || user.role !== "RWA_ADMIN" || user.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Only admins with full access can update settings");
    }

    if (!user.societyId) {
      return forbiddenError("No society found");
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid settings data" } },
        { status: 422 },
      );
    }

    const updates: Record<string, boolean> = {};
    if (typeof parsed.data.emailVerificationRequired === "boolean") {
      updates.emailVerificationRequired = parsed.data.emailVerificationRequired;
    }

    const updated = await prisma.society.update({
      where: { id: user.societyId },
      data: updates,
      select: { emailVerificationRequired: true },
    });

    return NextResponse.json({
      emailVerificationRequired: updated.emailVerificationRequired,
      message: "Settings updated successfully",
    });
  } catch (err) {
    console.error("Settings update error:", err);
    return internalError("Failed to update settings");
  }
}
