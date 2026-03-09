import { NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function getAdminSocietyId() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findFirst({
    where: { authUserId: authUser.id, role: "RWA_ADMIN" },
    select: { adminPermission: true, societyId: true },
  });

  if (!user || user.adminPermission !== "FULL_ACCESS" || !user.societyId) return null;

  return user.societyId;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const societyId = await getAdminSocietyId();
    if (!societyId) return forbiddenError("Only admins with full access can remove members");

    const { memberId } = await params;

    const member = await prisma.governingBodyMember.findFirst({
      where: { id: memberId, societyId },
      include: { user: { select: { name: true } } },
    });

    if (!member) return notFoundError("Member not found");

    await prisma.governingBodyMember.delete({ where: { id: memberId } });

    return NextResponse.json({
      message: `${member.user.name} removed from governing body`,
    });
  } catch (err) {
    console.error("Governing body remove error:", err);
    return internalError("Failed to remove member");
  }
}
