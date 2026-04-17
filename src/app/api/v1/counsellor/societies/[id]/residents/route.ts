import { NextRequest } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { assertCounsellorSocietyAccess } from "@/lib/counsellor/access";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: societyId } = await params;
  const counsellorId = auth.data.counsellorId;

  const accessError = await assertCounsellorSocietyAccess(
    counsellorId,
    societyId,
    auth.data.isSuperAdmin,
  );
  if (accessError) return accessError;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const search = searchParams.get("search")?.trim() ?? "";

    const where: Record<string, unknown> = { societyId, role: "RESIDENT" };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ status: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          photoUrl: true,
          status: true,
          role: true,
          ownershipType: true,
          userUnits: {
            where: { isPrimary: true, unlinkedAt: null },
            take: 1,
            select: { unit: { select: { displayLabel: true } } },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const residents = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      photoUrl: r.photoUrl,
      unitLabel: r.userUnits[0]?.unit.displayLabel ?? null,
      ownershipType: r.ownershipType,
      status: r.status,
      role: r.role,
    }));

    return successResponse({ residents, total, page, pageSize });
  } catch {
    return internalError("Failed to fetch residents");
  }
}
