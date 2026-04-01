import { NextResponse } from "next/server";

import { internalError, successResponse, validationError } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAnnouncementSchema } from "@/lib/validations/announcement";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const announcements = await prisma.platformAnnouncement.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { reads: true } } },
    });

    return successResponse(announcements);
  } catch (err) {
    console.error("[SA Announcements GET]", err);
    return internalError();
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const body = await request.json();
    const parsed = createAnnouncementSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { subject, body: msgBody, priority, scope, societyIds, sentVia } = parsed.data;

    const announcement = await prisma.platformAnnouncement.create({
      data: {
        subject,
        body: msgBody,
        priority,
        scope,
        societyIds: scope === "TARGETED" ? societyIds : [],
        sentVia,
        createdBy: auth.data!.superAdminId,
      },
    });

    return successResponse(announcement, 201);
  } catch (err) {
    console.error("[SA Announcements POST]", err);
    return internalError();
  }
}
