import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
    const limit = Math.min(isNaN(rawLimit) ? DEFAULT_PAGE_SIZE : rawLimit, MAX_PAGE_SIZE);
    const status = searchParams.get("status");
    const societyId = searchParams.get("societyId");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = { role: "RESIDENT" };

    if (societyId) {
      where.societyId = societyId;
    }

    if (status === "ACTIVE") {
      where.status = {
        in: [
          "ACTIVE_PAID",
          "ACTIVE_PENDING",
          "ACTIVE_OVERDUE",
          "ACTIVE_PARTIAL",
          "ACTIVE_EXEMPTED",
        ],
      };
    } else if (status === "PENDING") {
      where.status = "PENDING_APPROVAL";
    } else if (status === "OVERDUE") {
      where.status = "ACTIVE_OVERDUE";
    } else if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { rwaid: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total, totalAll, activePaid, pending, overdue] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          rwaid: true,
          status: true,
          ownershipType: true,
          createdAt: true,
          societyId: true,
          society: { select: { name: true } },
          userUnits: { include: { unit: true }, take: 1 },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({
        where: { role: "RESIDENT", status: { not: "REJECTED" } },
      }),
      prisma.user.count({
        where: { role: "RESIDENT", status: "ACTIVE_PAID" },
      }),
      prisma.user.count({
        where: { role: "RESIDENT", status: "PENDING_APPROVAL" },
      }),
      prisma.user.count({
        where: { role: "RESIDENT", status: "ACTIVE_OVERDUE" },
      }),
    ]);

    return successResponse({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      kpis: { totalAll, activePaid, pending, overdue },
    });
  } catch (err) {
    console.error("[SA Platform Residents]", err);
    return internalError();
  }
}
