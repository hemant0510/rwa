import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { societyId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      prisma.petition.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { name: true } },
          _count: { select: { signatures: true } },
        },
      }),
      prisma.petition.count({ where }),
    ]);

    return successResponse({ data, total, page, limit });
  } catch (err) {
    console.error("[SA Petitions]", err);
    return internalError();
  }
}
