import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const MAX_EXPORT_ROWS = 5000;

function buildWhere(params: URLSearchParams) {
  const from = params.get("from");
  const to = params.get("to");
  const societyId = params.get("societyId");
  const actionTypes = params.get("actionType");
  const userId = params.get("userId");
  const entityType = params.get("entityType");

  const where: Record<string, unknown> = {};

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
    };
  }

  if (societyId === "platform") {
    where.societyId = null;
  } else if (societyId) {
    where.societyId = societyId;
  }

  if (actionTypes) {
    const types = actionTypes.split(",").filter(Boolean);
    if (types.length > 0) where.actionType = { in: types };
  }

  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;

  return where;
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/v1/super-admin/audit-logs/export
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const where = buildWhere(searchParams);

    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        userId: true,
        societyId: true,
        actionType: true,
        entityType: true,
        entityId: true,
        oldValue: true,
        newValue: true,
        ipAddress: true,
        createdAt: true,
        society: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
    });

    const uniqueUserIds = [...new Set(logs.map((l) => l.userId))];
    const [users, superAdmins] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.superAdmin.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, name: true, email: true },
      }),
    ]);

    const userMap = new Map<string, { name: string; email: string }>();
    for (const u of users) userMap.set(u.id, { name: u.name, email: u.email });
    for (const sa of superAdmins)
      if (!userMap.has(sa.id)) userMap.set(sa.id, { name: sa.name, email: sa.email });

    const headers = [
      "Timestamp",
      "User Name",
      "User Email",
      "Action Type",
      "Entity Type",
      "Entity ID",
      "Society",
      "Old Value",
      "New Value",
      "IP Address",
    ];

    const rows = logs.map((log) => {
      const user = userMap.get(log.userId);
      return [
        log.createdAt.toISOString(),
        user?.name ?? "",
        user?.email ?? "",
        log.actionType,
        log.entityType,
        log.entityId,
        log.society?.name ?? "Platform",
        log.oldValue ? JSON.stringify(log.oldValue) : "",
        log.newValue ? JSON.stringify(log.newValue) : "",
        log.ipAddress ?? "",
      ]
        .map(escapeCSV)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return internalError("Failed to export audit logs");
  }
}
