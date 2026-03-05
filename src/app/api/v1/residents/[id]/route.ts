import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { notFoundError, internalError, unauthorizedError, forbiddenError } from "@/lib/api-helpers";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        society: true,
        userUnits: {
          include: { unit: true },
        },
        membershipFees: {
          orderBy: { createdAt: "desc" },
          include: {
            feePayments: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!user) return notFoundError("Resident not found");

    return NextResponse.json(user);
  } catch {
    return internalError("Failed to fetch resident");
  }
}

const updateResidentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number")
    .optional(),
  email: z.string().email().optional(),
  ownershipType: z.enum(["OWNER", "TENANT"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return unauthorizedError();

    const caller = await prisma.user.findUnique({ where: { authUserId: authUser.id } });
    if (!caller) return unauthorizedError();

    // Find resident
    const resident = await prisma.user.findUnique({ where: { id } });
    if (!resident) return notFoundError("Resident not found");

    // Authorization: RWA_ADMIN of same society or SuperAdmin (no societyId)
    const isSameSocietyAdmin =
      caller.role === "RWA_ADMIN" && caller.societyId === resident.societyId;
    const isSuperAdmin = !caller.societyId && caller.role === "RWA_ADMIN";
    if (!isSameSocietyAdmin && !isSuperAdmin)
      return forbiddenError("Not authorized to edit this resident");

    // Parse & validate
    const body = await request.json();
    const parsed = updateResidentSchema.safeParse(body);
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

    const updated = await prisma.user.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update resident error:", err);
    return internalError("Failed to update resident");
  }
}

const deleteResidentSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return unauthorizedError();

    const caller = await prisma.user.findUnique({ where: { authUserId: authUser.id } });
    if (!caller) return unauthorizedError();

    // Find resident
    const resident = await prisma.user.findUnique({ where: { id } });
    if (!resident) return notFoundError("Resident not found");
    if (resident.status === "DEACTIVATED") {
      return NextResponse.json(
        { error: { code: "ALREADY_DEACTIVATED", message: "Resident is already deactivated" } },
        { status: 400 },
      );
    }

    // Authorization
    const isSameSocietyAdmin =
      caller.role === "RWA_ADMIN" && caller.societyId === resident.societyId;
    const isSuperAdmin = !caller.societyId && caller.role === "RWA_ADMIN";
    if (!isSameSocietyAdmin && !isSuperAdmin)
      return forbiddenError("Not authorized to deactivate this resident");

    // Parse reason
    const body = await request.json();
    const parsed = deleteResidentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Reason is required (min 5 chars)" } },
        { status: 422 },
      );
    }

    const { reason } = parsed.data;
    const previousStatus = resident.status;

    // Soft-delete + audit log in transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.user.update({
        where: { id },
        data: {
          status: "DEACTIVATED",
          deactivatedAt: new Date(),
          deactivationReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          societyId: resident.societyId,
          userId: caller.id,
          actionType: "DEACTIVATE",
          entityType: "USER",
          entityId: id,
          oldValue: { status: previousStatus },
          newValue: { status: "DEACTIVATED", reason },
        },
      });
    });

    // Disable Supabase Auth account if exists
    if (resident.authUserId) {
      try {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.auth.admin.updateUserById(resident.authUserId, {
          ban_duration: "876600h",
        });
      } catch (err) {
        console.error("Failed to disable auth account:", err);
        // Don't fail the request — the user is already deactivated in DB
      }
    }

    return NextResponse.json({ message: "Resident deactivated successfully" });
  } catch (err) {
    console.error("Deactivate resident error:", err);
    return internalError("Failed to deactivate resident");
  }
}
