import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const societyId = searchParams.get("societyId");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (societyId) where.societyId = societyId;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const [data, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          society: { select: { name: true } },
          createdByUser: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return successResponse({ data, total, page, limit });
  } catch (err) {
    console.error("[SA Support GET]", err);
    return internalError();
  }
}
