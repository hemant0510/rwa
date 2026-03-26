import { NextRequest, NextResponse } from "next/server";

import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";

    const where: Record<string, unknown> = {
      societyId: resident.societyId,
      status: showAll ? { in: ["PUBLISHED", "COMPLETED"] } : "PUBLISHED",
    };

    // Default: only upcoming (future events + recently completed)
    if (!showAll) {
      where.eventDate = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }

    const events = await prisma.communityEvent.findMany({
      where,
      orderBy: { eventDate: "asc" },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          where: { userId: resident.userId },
          select: {
            id: true,
            status: true,
            memberCount: true,
            payment: { select: { amount: true } },
          },
          take: 1,
        },
      },
    });

    // Map to include myRegistration for the resident
    const data = events.map((event) => ({
      ...event,
      myRegistration: event.registrations[0] ?? null,
      registrations: undefined, // Remove raw registrations array
    }));

    return NextResponse.json({ data });
  } catch {
    return internalError("Failed to fetch events");
  }
}
