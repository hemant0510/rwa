import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    const { id } = await params;

    // Upsert to make it idempotent — no error on duplicate
    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId: user.userId,
        },
      },
      create: {
        announcementId: id,
        userId: user.userId,
      },
      update: {},
    });

    return successResponse({ success: true });
  } catch (err) {
    console.error("[Admin Announcement Mark Read]", err);
    return internalError();
  }
}
