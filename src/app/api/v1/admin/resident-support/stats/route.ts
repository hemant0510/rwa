import { type NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetSocietyId = searchParams.get("societyId");
    const admin = await getAdminContext(targetSocietyId);
    if (!admin) return forbiddenError("Admin access required");

    const societyId = admin.societyId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [open, inProgress, awaitingAdmin, resolved7d] = await Promise.all([
      prisma.residentTicket.count({ where: { societyId, status: "OPEN" } }),
      prisma.residentTicket.count({ where: { societyId, status: "IN_PROGRESS" } }),
      prisma.residentTicket.count({ where: { societyId, status: "AWAITING_ADMIN" } }),
      prisma.residentTicket.count({
        where: { societyId, status: "RESOLVED", resolvedAt: { gte: sevenDaysAgo } },
      }),
    ]);

    // Calculate average resolution hours from resolved tickets
    const resolvedTickets = await prisma.residentTicket.findMany({
      where: { societyId, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 100,
      orderBy: { resolvedAt: "desc" },
    });

    let avgResolutionHours: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime();
        const resolved = new Date(t.resolvedAt!).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
    }

    return successResponse({
      open,
      inProgress,
      awaitingAdmin,
      resolved7d,
      avgResolutionHours,
    });
  } catch (err) {
    console.error("[Admin Resident Support Stats GET]", err);
    return internalError();
  }
}
