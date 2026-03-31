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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const [data, total] = await Promise.all([
      prisma.migrationBatch.findMany({
        where: { societyId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          uploader: { select: { name: true } },
          rows: {
            where: { status: "ERROR" },
            select: { rowNumber: true, errorDetails: true },
            take: 50,
          },
        },
      }),
      prisma.migrationBatch.count({ where: { societyId } }),
    ]);

    return successResponse({ data, total, page, limit });
  } catch (err) {
    console.error("[SA Migrations]", err);
    return internalError();
  }
}
