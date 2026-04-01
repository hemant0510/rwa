import { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

interface ActivityItem {
  type: string;
  message: string;
  societyId: string;
  societyName: string;
  timestamp: string;
  severity: "info" | "warning" | "alert";
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activities: ActivityItem[] = [];

    const [recentApprovals, recentEvents, recentPetitions, inactiveAdmins] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "RESIDENT",
          approvedAt: { gte: sevenDaysAgo },
        },
        select: {
          societyId: true,
          approvedAt: true,
          society: { select: { id: true, name: true } },
        },
        orderBy: { approvedAt: "desc" },
      }),
      prisma.communityEvent.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: {
          title: true,
          createdAt: true,
          society: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.petition.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: {
          title: true,
          type: true,
          createdAt: true,
          society: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.user.findMany({
        where: {
          role: "RWA_ADMIN",
          updatedAt: { lt: fourteenDaysAgo },
          societyId: { not: null },
        },
        select: {
          societyId: true,
          updatedAt: true,
          society: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Group approvals by society
    const approvalsBySociety = new Map<string, { count: number; name: string; latest: Date }>();
    for (const a of recentApprovals) {
      if (!a.society) continue;
      const existing = approvalsBySociety.get(a.society.id);
      if (existing) {
        existing.count++;
        if (a.approvedAt && a.approvedAt > existing.latest) {
          existing.latest = a.approvedAt;
        }
      } else {
        approvalsBySociety.set(a.society.id, {
          count: 1,
          name: a.society.name,
          latest: a.approvedAt ?? new Date(),
        });
      }
    }

    for (const [societyId, data] of approvalsBySociety) {
      activities.push({
        type: "resident_approved",
        message: `${data.name} approved ${data.count} new resident${data.count > 1 ? "s" : ""}`,
        societyId,
        societyName: data.name,
        timestamp: data.latest.toISOString(),
        severity: "info",
      });
    }

    for (const event of recentEvents) {
      activities.push({
        type: "event_created",
        message: `${event.society.name} created event: ${event.title}`,
        societyId: event.society.id,
        societyName: event.society.name,
        timestamp: event.createdAt.toISOString(),
        severity: "info",
      });
    }

    for (const petition of recentPetitions) {
      activities.push({
        type: "petition_created",
        message: `${petition.society.name} created ${petition.type.toLowerCase()}: ${petition.title}`,
        societyId: petition.society.id,
        societyName: petition.society.name,
        timestamp: petition.createdAt.toISOString(),
        severity: "info",
      });
    }

    // Track unique inactive admin societies
    const seenInactive = new Set<string>();
    for (const admin of inactiveAdmins) {
      if (!admin.society || !admin.societyId) continue;
      if (seenInactive.has(admin.societyId)) continue;
      seenInactive.add(admin.societyId);
      const daysAgo = Math.floor(
        (now.getTime() - admin.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      activities.push({
        type: "admin_inactive",
        message: `${admin.society.name} admin hasn't logged in for ${daysAgo} days`,
        societyId: admin.societyId,
        societyName: admin.society.name,
        timestamp: admin.updatedAt.toISOString(),
        severity: "alert",
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return successResponse({ activities: activities.slice(0, 50) });
  } catch (err) {
    console.error("[SA Operations Activity]", err);
    return internalError();
  }
}
