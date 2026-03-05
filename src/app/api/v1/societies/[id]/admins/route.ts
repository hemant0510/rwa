import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { parseBody, notFoundError, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const activateAdminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email("Valid email is required"),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
  permission: z.enum(["FULL_ACCESS", "READ_NOTIFY"]),
  existingUserId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { data, error } = await parseBody(request, activateAdminSchema);
    if (error) return error;
    if (!data) return internalError();

    const society = await prisma.society.findUnique({ where: { id: societyId } });
    if (!society) return notFoundError("Society not found");

    // Check admin limit (MVP: max 1 primary + 1 supporting)
    const position = data.permission === "FULL_ACCESS" ? "PRIMARY" : "SUPPORTING";
    const existingAdmin = await prisma.adminTerm.findFirst({
      where: {
        societyId,
        position,
        status: "ACTIVE",
      },
    });

    if (existingAdmin) {
      return NextResponse.json(
        {
          error: {
            code: "ADMIN_LIMIT",
            message: `A ${position.toLowerCase()} admin already exists`,
            status: 409,
          },
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let userId = data.existingUserId;

      if (!userId) {
        // Create new admin user
        const user = await tx.user.create({
          data: {
            societyId,
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            role: "RWA_ADMIN",
            adminPermission: data.permission,
            status: "ACTIVE_PAID",
            consentWhatsapp: true,
          },
        });
        userId = user.id;
      } else {
        // Upgrade existing user to admin
        await tx.user.update({
          where: { id: userId },
          data: {
            role: "RWA_ADMIN",
            adminPermission: data.permission,
          },
        });
      }

      const now = new Date();
      const termEnd = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
      const term = await tx.adminTerm.create({
        data: {
          userId,
          societyId,
          position,
          permission: data.permission,
          termStart: now,
          termEnd,
        },
      });

      return term;
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return internalError("Failed to activate admin");
  }
}
