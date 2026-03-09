import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const assignMemberSchema = z.object({
  userId: z.string().uuid(),
  designationId: z.string().uuid(),
});

async function getAdminWithSociety() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findFirst({
    where: { authUserId: authUser.id, role: "RWA_ADMIN" },
    select: { id: true, adminPermission: true, societyId: true },
  });

  if (!user || user.adminPermission !== "FULL_ACCESS" || !user.societyId) return null;

  return { userId: user.id, societyId: user.societyId };
}

export async function GET() {
  try {
    const admin = await getAdminWithSociety();
    if (!admin) return forbiddenError("Only admins with full access can view governing body");

    const [members, designations] = await Promise.all([
      prisma.governingBodyMember.findMany({
        where: { societyId: admin.societyId },
        include: {
          user: { select: { id: true, name: true, email: true, mobile: true } },
          designation: { select: { id: true, name: true } },
        },
        orderBy: { designation: { sortOrder: "asc" } },
      }),
      prisma.designation.findMany({
        where: { societyId: admin.societyId },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        mobile: m.user.mobile,
        designation: m.designation.name,
        designationId: m.designationId,
        assignedAt: m.assignedAt,
      })),
      designations: designations.map((d) => ({
        id: d.id,
        name: d.name,
        sortOrder: d.sortOrder,
      })),
    });
  } catch (err) {
    console.error("Governing body fetch error:", err);
    return internalError("Failed to fetch governing body");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminWithSociety();
    if (!admin) return forbiddenError("Only admins with full access can assign members");

    const body = await request.json();
    const parsed = assignMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Valid userId and designationId required." },
        },
        { status: 422 },
      );
    }

    const { userId, designationId } = parsed.data;

    // Verify user belongs to this society and is a resident
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, societyId: admin.societyId, role: "RESIDENT" },
      select: { id: true, name: true },
    });

    if (!targetUser) return notFoundError("Resident not found in your society");

    // Verify designation belongs to this society
    const designation = await prisma.designation.findFirst({
      where: { id: designationId, societyId: admin.societyId },
      select: { id: true, name: true },
    });

    if (!designation) return notFoundError("Designation not found");

    // Upsert: if user already has a governing body role, update designation
    const member = await prisma.governingBodyMember.upsert({
      where: { userId },
      create: {
        societyId: admin.societyId,
        userId,
        designationId,
        assignedBy: admin.userId,
      },
      update: {
        designationId,
        assignedBy: admin.userId,
        assignedAt: new Date(),
      },
      include: {
        user: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });

    return NextResponse.json(
      {
        id: member.id,
        userId: member.userId,
        name: member.user.name,
        designation: member.designation.name,
        message: `${member.user.name} assigned as ${member.designation.name}`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Governing body assign error:", err);
    return internalError("Failed to assign member");
  }
}
