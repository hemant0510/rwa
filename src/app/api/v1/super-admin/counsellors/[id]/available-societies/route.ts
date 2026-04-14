import { NextRequest } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!counsellor) return notFoundError("Counsellor not found");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";

    // Societies NOT currently actively assigned to this counsellor
    const assigned = await prisma.counsellorSocietyAssignment.findMany({
      where: { counsellorId: id, isActive: true },
      select: { societyId: true },
    });
    const excludeIds = assigned.map((a) => a.societyId);

    const where: Record<string, unknown> = {
      status: { in: ["ACTIVE", "TRIAL"] },
    };
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { societyCode: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const societies = await prisma.society.findMany({
      where,
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true,
        name: true,
        societyCode: true,
        city: true,
        state: true,
        totalUnits: true,
        plan: true,
      },
    });

    return successResponse({ societies });
  } catch {
    return internalError("Failed to fetch available societies");
  }
}
