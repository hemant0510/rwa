import { NextResponse } from "next/server";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskMobile } from "@/lib/utils";

const PHOTO_BUCKET = "resident-photos";

export async function GET() {
  try {
    const user = await getCurrentUser("RESIDENT");
    if (!user) return forbiddenError("Resident authentication required");

    const members = await prisma.governingBodyMember.findMany({
      where: { societyId: user.societyId },
      include: {
        user: { select: { name: true, email: true, mobile: true, photoUrl: true } },
        designation: { select: { name: true, sortOrder: true } },
      },
      orderBy: { designation: { sortOrder: "asc" } },
    });

    // Generate signed URLs for photos
    const supabaseAdmin = createAdminClient();
    const mapped = await Promise.all(
      members.map(async (m) => {
        let photoSignedUrl: string | null = null;
        if (m.user.photoUrl) {
          const { data } = await supabaseAdmin.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(m.user.photoUrl, 60 * 60);
          photoSignedUrl = data?.signedUrl ?? null;
        }
        return {
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          mobile: maskMobile(m.user.mobile),
          designation: m.designation.name,
          assignedAt: m.assignedAt,
          photoUrl: photoSignedUrl,
        };
      }),
    );

    return NextResponse.json({ members: mapped });
  } catch (err) {
    console.error("Resident governing body fetch error:", err);
    return internalError("Failed to fetch governing body");
  }
}
