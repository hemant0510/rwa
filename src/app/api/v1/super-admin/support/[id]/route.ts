import { NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id } = await params;

    const request = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        society: { select: { name: true } },
        createdByUser: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!request) return notFoundError("Request not found");

    return successResponse(request);
  } catch (err) {
    console.error("[SA Support Detail]", err);
    return internalError();
  }
}
