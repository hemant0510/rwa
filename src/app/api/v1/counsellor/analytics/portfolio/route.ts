import { internalError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { logCounsellorAudit } from "@/lib/counsellor/audit";
import { prisma } from "@/lib/prisma";
import type { CounsellorPortfolioAnalytics } from "@/types/counsellor";

const OPEN_STATUSES = ["PENDING", "ACKNOWLEDGED", "REVIEWING"] as const;
const DEFAULT_WINDOW_DAYS = 30;

export async function GET(request: Request) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const counsellorId = auth.data.counsellorId;
  const url = new URL(request.url);
  const windowParam = Number(url.searchParams.get("windowDays") ?? DEFAULT_WINDOW_DAYS);
  const windowDays =
    Number.isFinite(windowParam) && windowParam > 0 && windowParam <= 365
      ? Math.floor(windowParam)
      : DEFAULT_WINDOW_DAYS;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const isSA = auth.data.isSuperAdmin;
    const [assignments, escalations] = await Promise.all([
      prisma.counsellorSocietyAssignment.findMany({
        where: { ...(isSA ? {} : { counsellorId }), isActive: true },
        select: {
          society: { select: { id: true, name: true, societyCode: true } },
        },
      }),
      prisma.residentTicketEscalation.findMany({
        where: isSA ? {} : { counsellorId },
        select: {
          id: true,
          status: true,
          acknowledgedAt: true,
          resolvedAt: true,
          slaDeadline: true,
          createdAt: true,
          ticket: {
            select: {
              id: true,
              type: true,
              societyId: true,
              society: { select: { name: true, societyCode: true } },
            },
          },
        },
      }),
    ]);

    const societies = assignments.map((a) => a.society);
    const inWindow = escalations.filter((e) => e.createdAt >= windowStart);

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      ACKNOWLEDGED: 0,
      REVIEWING: 0,
      RESOLVED_BY_COUNSELLOR: 0,
      DEFERRED_TO_ADMIN: 0,
      WITHDRAWN: 0,
    };
    for (const e of escalations) {
      statusCounts[e.status] += 1;
    }

    const openList = escalations.filter((e) =>
      (OPEN_STATUSES as readonly string[]).includes(e.status),
    );
    const slaBreachedOpen = openList.filter(
      (e) => e.slaDeadline !== null && e.slaDeadline.getTime() < now.getTime(),
    ).length;

    const resolvedList = escalations.filter(
      (e) => e.status === "RESOLVED_BY_COUNSELLOR" && e.resolvedAt && e.acknowledgedAt,
    );
    const avgResolutionHours =
      resolvedList.length === 0
        ? null
        : Math.round(
            resolvedList.reduce((acc, e) => {
              const ms = e.resolvedAt!.getTime() - e.acknowledgedAt!.getTime();
              return acc + ms / (60 * 60 * 1000);
            }, 0) / resolvedList.length,
          );

    const typeMap = new Map<string, number>();
    for (const e of inWindow) {
      typeMap.set(e.ticket.type, (typeMap.get(e.ticket.type) ?? 0) + 1);
    }
    const byType = [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    type SocietyAgg = {
      societyId: string;
      societyName: string;
      societyCode: string;
      open: number;
      resolved: number;
      total: number;
    };
    const societyAgg = new Map<string, SocietyAgg>();
    for (const s of societies) {
      societyAgg.set(s.id, {
        societyId: s.id,
        societyName: s.name,
        societyCode: s.societyCode,
        open: 0,
        resolved: 0,
        total: 0,
      });
    }
    for (const e of escalations) {
      const row = societyAgg.get(e.ticket.societyId) ??
        /* v8 ignore start -- defensive: escalation always maps to assigned society */
        {
          societyId: e.ticket.societyId,
          societyName: e.ticket.society.name,
          societyCode: e.ticket.society.societyCode,
          open: 0,
          resolved: 0,
          total: 0,
        };
      /* v8 ignore stop */
      row.total += 1;
      if ((OPEN_STATUSES as readonly string[]).includes(e.status)) row.open += 1;
      if (e.status === "RESOLVED_BY_COUNSELLOR") row.resolved += 1;
      societyAgg.set(e.ticket.societyId, row);
    }
    const bySociety = [...societyAgg.values()].sort((a, b) => b.total - a.total);

    const payload: CounsellorPortfolioAnalytics = {
      generatedAt: now.toISOString(),
      windowDays,
      totals: {
        societies: societies.length,
        escalationsAllTime: escalations.length,
        escalationsInWindow: inWindow.length,
        openEscalations: openList.length,
        pendingAck: statusCounts.PENDING,
        acknowledged: statusCounts.ACKNOWLEDGED,
        resolved: statusCounts.RESOLVED_BY_COUNSELLOR,
        deferred: statusCounts.DEFERRED_TO_ADMIN,
        withdrawn: statusCounts.WITHDRAWN,
        slaBreachedOpen,
        avgResolutionHours,
      },
      byType,
      bySociety,
      byStatus: (Object.keys(statusCounts) as Array<keyof typeof statusCounts>).map((status) => ({
        status: status as CounsellorPortfolioAnalytics["byStatus"][number]["status"],
        count: statusCounts[status],
      })),
    };

    void logCounsellorAudit({
      counsellorId,
      actionType: "COUNSELLOR_VIEW_ANALYTICS",
      entityType: "PortfolioAnalytics",
      entityId: counsellorId,
      metadata: { windowDays },
    });

    return successResponse(payload);
  } catch (err) {
    console.error("[Counsellor Analytics GET]", err);
    return internalError("Failed to load analytics");
  }
}
