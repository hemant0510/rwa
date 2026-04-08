import { NextResponse } from "next/server";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { maskMobile } from "@/lib/utils";

export async function GET() {
  try {
    const user = await getCurrentUser("RESIDENT");
    if (!user) return forbiddenError("Resident authentication required");

    const members = await prisma.governingBodyMember.findMany({
      where: { societyId: user.societyId },
      include: {
        user: { select: { name: true, email: true, mobile: true } },
        designation: { select: { name: true, sortOrder: true } },
      },
      orderBy: { designation: { sortOrder: "asc" } },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.user.name,
        email: m.user.email,
        mobile: maskMobile(m.user.mobile),
        designation: m.designation.name,
        assignedAt: m.assignedAt,
      })),
    });
  } catch (err) {
    console.error("Resident governing body fetch error:", err);
    return internalError("Failed to fetch governing body");
  }
}
