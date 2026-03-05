import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { notFoundError, internalError, parseBody } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, rejectSchema);
    if (error) return error;
    if (!data) return internalError();

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) return notFoundError("Resident not found");
    if (user.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          error: { code: "INVALID_STATUS", message: "Resident is not in pending approval status" },
        },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: data.reason,
      },
    });

    // TODO: Send WhatsApp rejection notification (Phase 5)

    return NextResponse.json({ message: "Resident rejected" });
  } catch {
    return internalError("Failed to reject resident");
  }
}
