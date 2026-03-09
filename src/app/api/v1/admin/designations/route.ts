import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const createDesignationSchema = z.object({
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

export async function GET() {
  try {
    const societyId = await getAdminSocietyId();
    if (!societyId) return forbiddenError("Only admins with full access can view designations");

    const designations = await prisma.designation.findMany({
      where: { societyId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json(
      designations.map((d) => ({
        id: d.id,
        name: d.name,
        sortOrder: d.sortOrder,
        memberCount: d._count.members,
      })),
    );
  } catch (err) {
    console.error("Designations fetch error:", err);
    return internalError("Failed to fetch designations");
  }
}

export async function POST(request: NextRequest) {
  try {
    const societyId = await getAdminSocietyId();
    if (!societyId) return forbiddenError("Only admins with full access can create designations");

    const body = await request.json();
    const parsed = createDesignationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Valid name is required (2-50 characters)." },
        },
        { status: 422 },
      );
    }

    // Check for duplicate name
    const existing = await prisma.designation.findFirst({
      where: { societyId, name: parsed.data.name },
    });

    if (existing) {
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

    // Get next sortOrder
    const maxSort = await prisma.designation.findFirst({
      where: { societyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const designation = await prisma.designation.create({
      data: {
        societyId,
        name: parsed.data.name,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(
      {
        id: designation.id,
        name: designation.name,
        sortOrder: designation.sortOrder,
        memberCount: 0,
        message: `Designation "${designation.name}" created`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Designation create error:", err);
    return internalError("Failed to create designation");
  }
}
