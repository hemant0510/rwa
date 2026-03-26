import { NextRequest, NextResponse } from "next/server";

import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "@/lib/validations/event";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { societyId };
    if (status) where.status = status;
    if (category) where.category = category;

    const [data, total] = await Promise.all([
      prisma.communityEvent.findMany({
        where,
        orderBy: [{ status: "asc" }, { eventDate: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { name: true } },
          _count: { select: { registrations: true } },
        },
      }),
      prisma.communityEvent.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return internalError("Failed to fetch events");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const { data, error } = await parseBody(request, createEventSchema);
    if (error) return error;
    if (!data) return internalError();

    // FREE events always use PER_HOUSEHOLD
    const chargeUnit =
      data.feeModel === "FREE" ? "PER_HOUSEHOLD" : (data.chargeUnit ?? "PER_PERSON");

    const event = await prisma.communityEvent.create({
      data: {
        societyId,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        feeModel: data.feeModel,
        chargeUnit,
        eventDate: new Date(data.eventDate),
        location: data.location ?? null,
        registrationDeadline: data.registrationDeadline
          ? new Date(data.registrationDeadline)
          : null,
        feeAmount: data.feeAmount ?? null,
        estimatedBudget: data.estimatedBudget ?? null,
        minParticipants: data.minParticipants ?? null,
        maxParticipants: data.maxParticipants ?? null,
        suggestedAmount: data.suggestedAmount ?? null,
        createdBy: admin.userId,
      },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "EVENT_CREATED",
      userId: admin.userId,
      societyId,
      entityType: "CommunityEvent",
      entityId: event.id,
      newValue: { title: data.title, feeModel: data.feeModel, category: data.category },
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    return internalError("Failed to create event");
  }
}
