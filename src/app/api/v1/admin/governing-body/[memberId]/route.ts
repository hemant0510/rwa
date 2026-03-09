import { NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const admin = await getFullAccessAdmin();
    if (!admin) return forbiddenError("Only admins with full access can remove members");
    const societyId = admin.societyId;

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
