import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const admin = await getAdminContext(searchParams.get("societyId"));
    if (!admin) return forbiddenError("Admin access required");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get IDs of announcements this admin already read (SA has no userId row — skip read filter)
    const readIds = admin.userId
      ? await prisma.announcementRead.findMany({
          where: { userId: admin.userId },
          select: { announcementId: true },
        })
      : [];
    const readIdSet = readIds.map((r) => r.announcementId);

    // Fetch unread announcements that target this admin's society
    const announcements = await prisma.platformAnnouncement.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        id: { notIn: readIdSet.length > 0 ? readIdSet : undefined },
        OR: [{ scope: "ALL" }, { scope: "TARGETED", societyIds: { has: admin.societyId } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subject: true,
        body: true,
        priority: true,
        createdAt: true,
      },
    });

    return successResponse(announcements);
  } catch (err) {
    console.error("[Admin Announcements GET]", err);
    return internalError();
  }
}
