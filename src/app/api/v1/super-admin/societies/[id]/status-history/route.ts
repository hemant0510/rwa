import { type NextRequest, NextResponse } from "next/server";

import { errorResponse, internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  const { id } = await params;

  try {
    const society = await prisma.society.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!society) {
      return errorResponse({ code: "NOT_FOUND", message: "Society not found", status: 404 });
    }

    const history = await prisma.societyStatusChange.findMany({
      where: { societyId: id },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(history);
  } catch (err) {
    console.error("[SA Status History]", err);
    return internalError();
  }
}
