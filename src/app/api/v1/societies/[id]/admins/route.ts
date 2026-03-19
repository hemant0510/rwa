import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { parseBody, notFoundError, internalError } from "@/lib/api-helpers";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerificationRequired, sendVerificationEmail, autoVerifyUser } from "@/lib/verification";

const activateAdminSchema = z
  .object({
    name: z.string().max(100).optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    mobile: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number")
      .optional(),
    permission: z.enum(["FULL_ACCESS", "READ_NOTIFY"]),
    existingUserId: z.string().uuid().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.existingUserId) return; // Path A: upgrading existing — no extra fields needed
    // Path B: creating new admin — name, email, password all required
    if (!d.name || d.name.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Name must be at least 2 characters",
        path: ["name"],
      });
    }
    if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      ctx.addIssue({ code: "custom", message: "Valid email is required", path: ["email"] });
    }
    if (!d.password || d.password.length < 8) {
      ctx.addIssue({
        code: "custom",
        message: "Password must be at least 8 characters",
        path: ["password"],
      });
    }
  });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { data, error } = await parseBody(request, activateAdminSchema);
    if (error) return error;
    if (!data) return internalError();

    const society = await prisma.society.findUnique({ where: { id: societyId } });
    if (!society) return notFoundError("Society not found");

    // Enforce MVP limit: 1 Primary + 1 Supporting per society
    const position = data.permission === "FULL_ACCESS" ? "PRIMARY" : "SUPPORTING";
    const existingAdmin = await prisma.adminTerm.findFirst({
      where: { societyId, position, status: "ACTIVE" },
    });

    if (existingAdmin) {
      return NextResponse.json(
        {
          error: {
            code: "ADMIN_LIMIT",
            message: `A ${position.toLowerCase()} admin already exists for this society`,
            status: 409,
          },
        },
        { status: 409 },
      );
    }

    // Path A — upgrading an existing resident to admin role
    if (data.existingUserId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: data.existingUserId, societyId },
        select: { id: true, name: true, email: true, authUserId: true },
      });

      if (!existingUser) return notFoundError("User not found in this society");

      await prisma.$transaction(async (tx: TransactionClient) => {
        await tx.user.update({
          where: { id: data.existingUserId },
          data: { role: "RWA_ADMIN", adminPermission: data.permission },
        });

        const now = new Date();
        const termEnd = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        await tx.adminTerm.create({
          data: {
            userId: data.existingUserId!,
            societyId,
            position,
            permission: data.permission,
            termStart: now,
            termEnd,
          },
        });
      });

      return NextResponse.json(
        { message: `${existingUser.name} has been activated as ${position.toLowerCase()} admin` },
        { status: 201 },
      );
    }

    // Path B — creating a brand-new admin user
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password!,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        { error: { code: "AUTH_ERROR", message: authError.message, status: 400 } },
        { status: 400 },
      );
    }

    let createdUserId: string;
    try {
      const result = await prisma.$transaction(async (tx: TransactionClient) => {
        const user = await tx.user.create({
          data: {
            societyId,
            authUserId: authData.user.id,
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            role: "RWA_ADMIN",
            adminPermission: data.permission,
            status: "ACTIVE_PAID",
            consentWhatsapp: true,
          },
        });

        const now = new Date();
        const termEnd = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        await tx.adminTerm.create({
          data: {
            userId: user.id,
            societyId,
            position,
            permission: data.permission,
            termStart: now,
            termEnd,
          },
        });

        return user;
      });

      createdUserId = result.id;
    } catch (err) {
      // Rollback: remove Supabase auth user if DB transaction fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("Admin activation DB error:", err);
      return internalError("Failed to activate admin");
    }

    // Send welcome / verification email
    const requiresVerification = await isVerificationRequired(societyId);
    if (requiresVerification) {
      await sendVerificationEmail(createdUserId, data.email, data.name);
    } else {
      await autoVerifyUser(createdUserId);
    }

    return NextResponse.json(
      { message: `${data.name} has been created and activated as ${position.toLowerCase()} admin` },
      { status: 201 },
    );
  } catch (err) {
    console.error("Admin activation error:", err);
    return internalError("Failed to activate admin");
  }
}
