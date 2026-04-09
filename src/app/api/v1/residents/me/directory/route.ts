import { NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskMobile } from "@/lib/utils";

const PHOTO_BUCKET = "resident-photos";

/** Only residents explicitly approved by admin (not pending, rejected, or migrated) */
const APPROVED_STATUSES = [
  "ACTIVE_PAID",
  "ACTIVE_PENDING",
  "ACTIVE_OVERDUE",
  "ACTIVE_PARTIAL",
  "ACTIVE_EXEMPTED",
];

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser("RESIDENT");
    if (!user) return forbiddenError("Resident authentication required");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {
      societyId: user.societyId,
      role: "RESIDENT",
      status: { in: APPROVED_STATUSES },
      id: { not: user.userId },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [residents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          ownershipType: true,
          photoUrl: true,
          userUnits: {
            select: { unit: { select: { displayLabel: true } } },
            take: 1,
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Generate signed URLs for photos
    const supabaseAdmin = createAdminClient();
    const mapped = await Promise.all(
      residents.map(async (r) => {
        let photoSignedUrl: string | null = null;
        if (r.photoUrl) {
          const { data } = await supabaseAdmin.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(r.photoUrl, 60 * 60);
          photoSignedUrl = data?.signedUrl ?? null;
        }
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          mobile: maskMobile(r.mobile),
          ownershipType: r.ownershipType,
          unit: r.userUnits[0]?.unit?.displayLabel ?? null,
          photoUrl: photoSignedUrl,
        };
      }),
    );

    return NextResponse.json({
      residents: mapped,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Resident directory fetch error:", err);
    return internalError("Failed to fetch directory");
  }
}
