import { type NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createRequestSchema } from "@/lib/validations/support";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required") as NextResponse;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

    const where: Record<string, unknown> = { societyId: user.societyId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { messages: true } },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return successResponse({ data, total, page, limit });
  } catch (err) {
    console.error("[Admin Support GET]", err);
    return internalError();
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        ...parsed.data,
        societyId: user.societyId,
        createdBy: user.userId,
      },
    });

    return successResponse(serviceRequest, 201);
  } catch (err) {
    console.error("[Admin Support POST]", err);
    return internalError();
  }
}
