import { NextRequest, NextResponse } from "next/server";

import { notFoundError, internalError, parseBody } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSocietySchema } from "@/lib/validations/society";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const society = await prisma.society.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: { where: { role: "RESIDENT" } },
          },
        },
      },
    });

    if (!society) return notFoundError("Society not found");

    // Get admin team
    const admins = await prisma.user.findMany({
      where: { societyId: id, role: "RWA_ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        authUserId: true,
        adminPermission: true,
        createdAt: true,
      },
    });

    // Get fee stats for current session
    const feeStats = await prisma.membershipFee.groupBy({
      by: ["status"],
      where: { societyId: id },
      _count: true,
      _sum: { amountPaid: true },
    });

    // Get total collected
    const totalCollected = feeStats.reduce((sum, s) => sum + Number(s._sum.amountPaid || 0), 0);

    // Get expense balance
    const expenseTotal = await prisma.expense.aggregate({
      where: { societyId: id, status: "ACTIVE" },
      _sum: { amount: true },
    });

    return NextResponse.json({
      ...society,
      joiningFee: Number(society.joiningFee),
      annualFee: Number(society.annualFee),
      residentCount: society._count.users,
      admins,
      feeStats: {
        totalCollected,
        breakdown: feeStats,
      },
      balance: totalCollected - Number(expenseTotal._sum.amount || 0),
    });
  } catch {
    return internalError("Failed to fetch society");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = await parseBody(request, updateSocietySchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data!;

    const existing = await prisma.society.findUnique({ where: { id } });
    if (!existing) return notFoundError("Society not found");

    // Update primary admin email/password in Supabase Auth if provided
    const hasNewEmail = typeof data.adminEmail === "string" && data.adminEmail.length > 0;
    const hasNewPassword = typeof data.adminPassword === "string" && data.adminPassword.length > 0;

    if (hasNewEmail || hasNewPassword) {
      const primaryAdmin = await prisma.user.findFirst({
        where: { societyId: id, role: "RWA_ADMIN", adminPermission: "FULL_ACCESS" },
        select: { id: true, authUserId: true },
      });

      if (!primaryAdmin) {
        console.error(`No primary admin found for society ${id}`);
        return NextResponse.json(
          {
            error: {
              code: "NO_ADMIN",
              message: "No primary admin found for this society",
              status: 400,
            },
          },
          { status: 400 },
        );
      }

      const supabaseAdmin = createAdminClient();

      if (!primaryAdmin.authUserId) {
        // No auth account yet — create one (requires both email and password)
        if (!hasNewEmail || !hasNewPassword) {
          return NextResponse.json(
            {
              error: {
                code: "NO_AUTH",
                message:
                  "This admin has no login account. Please provide both email and password to create one.",
                status: 400,
              },
            },
            { status: 400 },
          );
        }

        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: data.adminEmail!,
          password: data.adminPassword!,
          email_confirm: true,
        });

        if (createError) {
          console.error("Supabase auth create error:", createError);
          return NextResponse.json(
            { error: { code: "AUTH_CREATE_ERROR", message: createError.message, status: 400 } },
            { status: 400 },
          );
        }

        // Link auth user to Prisma record
        await prisma.user.update({
          where: { id: primaryAdmin.id },
          data: { authUserId: authData.user.id, email: data.adminEmail! },
        });
      } else {
        // Auth account exists — update it
        const authUpdate: { email?: string; password?: string; email_confirm?: boolean } = {};
        if (hasNewEmail) {
          authUpdate.email = data.adminEmail!;
          authUpdate.email_confirm = true;
        }
        if (hasNewPassword) authUpdate.password = data.adminPassword!;

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          primaryAdmin.authUserId,
          authUpdate,
        );

        if (authError) {
          console.error("Supabase auth update error:", authError);
          return NextResponse.json(
            { error: { code: "AUTH_UPDATE_ERROR", message: authError.message, status: 400 } },
            { status: 400 },
          );
        }

        if (hasNewEmail) {
          await prisma.user.update({
            where: { id: primaryAdmin.id },
            data: { email: data.adminEmail! },
          });
        }
      }
    }

    const updated = await prisma.society.update({
      where: { id },
      data: {
        name: data.name,
        state: data.state,
        city: data.city,
        pincode: data.pincode,
        type: data.type,
        joiningFee: data.joiningFee,
        annualFee: data.annualFee,
        ...(data.status && { status: data.status }),
      },
    });

    // Return full detail including admins for cache consistency
    const admins = await prisma.user.findMany({
      where: { societyId: id, role: "RWA_ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        authUserId: true,
        adminPermission: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...updated,
      joiningFee: Number(updated.joiningFee),
      annualFee: Number(updated.annualFee),
      admins,
    });
  } catch (err) {
    console.error("Society update error:", err);
    return internalError("Failed to update society");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const society = await prisma.society.findUnique({ where: { id } });
    if (!society) return notFoundError("Society not found");

    // Soft-delete: offboard society and disable all auth users
    const users = await prisma.user.findMany({
      where: { societyId: id },
      select: { id: true, authUserId: true },
    });

    const supabaseAdmin = createAdminClient();

    // Ban Supabase Auth users (preserves audit trail)
    for (const user of users) {
      if (user.authUserId) {
        await supabaseAdmin.auth.admin.updateUserById(user.authUserId, { ban_duration: "876600h" });
      }
    }

    // Mark users as inactive and society as offboarded
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { societyId: id },
        data: { status: "DEACTIVATED" },
      }),
      prisma.society.update({
        where: { id },
        data: { status: "OFFBOARDED" },
      }),
    ]);

    return NextResponse.json({ message: "Society offboarded successfully" });
  } catch (err) {
    console.error("Delete society error:", err);
    return internalError("Failed to delete society");
  }
}
