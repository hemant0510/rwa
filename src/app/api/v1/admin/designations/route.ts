import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getAdminContext, getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

const createDesignationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const admin = await getAdminContext(searchParams.get("societyId"));
    if (!admin || (!admin.isSuperAdmin && admin.adminPermission !== "FULL_ACCESS")) {
      return forbiddenError("Only admins with full access can view designations");
    }
    const societyId = admin.societyId;

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
    const admin = await getFullAccessAdmin();
    if (!admin) return forbiddenError("Only admins with full access can create designations");
    const societyId = admin.societyId;

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
