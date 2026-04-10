import { type NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

    const where: Record<string, unknown> = { societyId: admin.societyId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const [data, total] = await Promise.all([
      prisma.residentTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdByUser: {
            select: {
              name: true,
              units: { select: { unit: { select: { unitNumber: true } } }, take: 1 },
            },
          },
          _count: { select: { messages: true, attachments: true } },
        },
      }),
      prisma.residentTicket.count({ where }),
    ]);

    return successResponse({ data, total, page, limit });
  } catch (err) {
    console.error("[Admin Resident Support GET]", err);
    return internalError();
  }
}
