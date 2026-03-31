import { NextRequest } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

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

async function resolveUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { name: string; email: string }>();

  const [users, superAdmins] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    }),
    prisma.superAdmin.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const map = new Map<string, { name: string; email: string }>();
  for (const u of users) map.set(u.id, { name: u.name, email: u.email });
  for (const sa of superAdmins)
    if (!map.has(sa.id)) map.set(sa.id, { name: sa.name, email: sa.email });
  return map;
}

// GET /api/v1/super-admin/audit-logs
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
    const limit = Math.min(isNaN(rawLimit) ? DEFAULT_PAGE_SIZE : rawLimit, MAX_PAGE_SIZE);
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const where = buildWhere(searchParams);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
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
          society: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const uniqueUserIds = [...new Set(logs.map((l) => l.userId))];
    const userMap = await resolveUsers(uniqueUserIds);

    const items = logs.map((log) => {
      const user = userMap.get(log.userId);
      return {
        id: log.id,
        createdAt: log.createdAt,
        userId: log.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
        actionType: log.actionType,
        entityType: log.entityType,
        entityId: log.entityId,
        societyId: log.societyId,
        societyName: log.society?.name ?? null,
        oldValue: log.oldValue,
        newValue: log.newValue,
        ipAddress: log.ipAddress,
      };
    });

    return successResponse({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return internalError("Failed to fetch audit logs");
  }
}
