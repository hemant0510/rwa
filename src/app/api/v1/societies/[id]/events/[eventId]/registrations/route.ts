import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const { id: societyId, eventId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const event = await prisma.communityEvent.findUnique({ where: { id: eventId } });
    if (!event || event.societyId !== societyId) return notFoundError("Event not found");

    const where: Record<string, unknown> = { eventId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
        orderBy: { registeredAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              mobile: true,
              userUnits: {
                select: { unit: { select: { displayLabel: true } } },
                take: 1,
              },
            },
          },
          payment: true,
        },
      }),
      prisma.eventRegistration.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return internalError("Failed to fetch registrations");
  }
}
