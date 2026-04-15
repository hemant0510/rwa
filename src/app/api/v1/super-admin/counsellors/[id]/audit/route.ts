import { NextRequest } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) return notFoundError("Counsellor not found");

  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const pageSizeParam = Number(url.searchParams.get("pageSize") ?? 25);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0 && pageSizeParam <= 200
      ? Math.floor(pageSizeParam)
      : 25;

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!counsellor) return notFoundError("Counsellor not found");

    const [logs, total] = await Promise.all([
      prisma.counsellorAuditLog.findMany({
        where: { counsellorId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          counsellorId: true,
          actionType: true,
          entityType: true,
          entityId: true,
          societyId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.counsellorAuditLog.count({ where: { counsellorId: id } }),
    ]);

    return successResponse({ logs, total, page, pageSize });
  } catch (err) {
    console.error("[SA Counsellor Audit GET]", err);
    return internalError("Failed to load audit log");
  }
}
