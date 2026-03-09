import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const updateDesignationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
});

async function getAdminSocietyId() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findFirst({
    where: { authUserId: authUser.id, role: "RWA_ADMIN" },
    select: { adminPermission: true, societyId: true },
  });

  if (!user || user.adminPermission !== "FULL_ACCESS" || !user.societyId) return null;

  return user.societyId;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const societyId = await getAdminSocietyId();
    if (!societyId) return forbiddenError("Only admins with full access can update designations");

    const { id } = await params;

    const body = await request.json();
    const parsed = updateDesignationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Valid name is required (2-50 characters)." },
        },
        { status: 422 },
      );
    }

    const existing = await prisma.designation.findFirst({
      where: { id, societyId },
    });

    if (!existing) return notFoundError("Designation not found");

    // Check for duplicate name (excluding current)
    const duplicate = await prisma.designation.findFirst({
      where: { societyId, name: parsed.data.name, id: { not: id } },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_NAME",
            message: "A designation with this name already exists.",
          },
        },
        { status: 409 },
      );
    }

    const updated = await prisma.designation.update({
      where: { id },
      data: { name: parsed.data.name },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      sortOrder: updated.sortOrder,
      message: `Designation renamed to "${updated.name}"`,
    });
  } catch (err) {
    console.error("Designation update error:", err);
    return internalError("Failed to update designation");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const societyId = await getAdminSocietyId();
    if (!societyId) return forbiddenError("Only admins with full access can delete designations");

    const { id } = await params;
    const force = new URL(request.url).searchParams.get("force") === "true";

    const designation = await prisma.designation.findFirst({
      where: { id, societyId },
      include: { _count: { select: { members: true } } },
    });

    if (!designation) return notFoundError("Designation not found");

    if (designation._count.members > 0 && !force) {
      return NextResponse.json(
        {
          error: {
            code: "HAS_MEMBERS",
            message: `${designation._count.members} member(s) are assigned to this designation. Use ?force=true to also remove assignments.`,
          },
        },
        { status: 409 },
      );
    }

    // If force, delete members first, then designation
    if (designation._count.members > 0) {
      await prisma.governingBodyMember.deleteMany({
        where: { designationId: id, societyId },
      });
    }

    await prisma.designation.delete({ where: { id } });

    return NextResponse.json({
      message: `Designation "${designation.name}" deleted`,
    });
  } catch (err) {
    console.error("Designation delete error:", err);
    return internalError("Failed to delete designation");
  }
}
