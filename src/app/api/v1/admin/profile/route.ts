import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { INDIAN_MOBILE_PATTERN } from "@/lib/constants";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  mobile: z
    .string()
    .regex(INDIAN_MOBILE_PATTERN, "Must be a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
});

export async function GET() {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Not authenticated as admin");

    const user = await prisma.user.findUnique({
      where: { id: admin.userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        adminPermission: true,
        society: { select: { name: true, societyCode: true } },
      },
    });

    if (!user) return forbiddenError("User not found");

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile ?? "",
      role: user.role,
      adminPermission: user.adminPermission,
      societyName: user.society?.name ?? null,
      societyCode: user.society?.societyCode ?? null,
    });
  } catch (err) {
    console.error("Admin profile GET error:", err);
    return internalError("Failed to fetch profile");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Not authenticated as admin");

    const body: unknown = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: parsed.error.issues[0]?.message ?? "Invalid input" } },
        { status: 422 },
      );
    }

    const { name, mobile } = parsed.data;
    const updated = await prisma.user.update({
      where: { id: admin.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(mobile !== undefined && { mobile: mobile === "" ? null : mobile }),
      },
      select: { id: true, name: true, email: true, mobile: true },
    });

    return NextResponse.json({ message: "Profile updated", user: updated });
  } catch (err) {
    console.error("Admin profile PATCH error:", err);
    return internalError("Failed to update profile");
  }
}
