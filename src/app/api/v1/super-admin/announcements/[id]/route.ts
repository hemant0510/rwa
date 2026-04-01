import { NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id } = await params;

    const announcement = await prisma.platformAnnouncement.findUnique({
      where: { id },
      include: { _count: { select: { reads: true } } },
    });

    if (!announcement) return notFoundError("Announcement not found");

    // Calculate total targeted admins for read stats
    let totalTargeted = 0;
    if (announcement.scope === "ALL") {
      totalTargeted = await prisma.user.count({
        where: { role: "RWA_ADMIN" },
      });
    } else {
      totalTargeted = await prisma.user.count({
        where: {
          role: "RWA_ADMIN",
          societyId: { in: announcement.societyIds },
        },
      });
    }

    return successResponse({ ...announcement, totalTargeted });
  } catch (err) {
    console.error("[SA Announcement Detail]", err);
    return internalError();
  }
}
