import { NextRequest, NextResponse } from "next/server";

import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createPetitionSchema } from "@/lib/validations/petition";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { societyId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      prisma.petition.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { name: true } },
          _count: { select: { signatures: true } },
        },
      }),
      prisma.petition.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return internalError("Failed to fetch petitions");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const { data, error } = await parseBody(request, createPetitionSchema);
    if (error) return error;
    if (!data) return internalError();

    const petition = await prisma.petition.create({
      data: {
        societyId,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        targetAuthority: data.targetAuthority ?? null,
        minSignatures: data.minSignatures ?? null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        status: "DRAFT",
        createdBy: admin.userId,
      },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "PETITION_CREATED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petition.id,
      newValue: { title: data.title, type: data.type },
    });

    return NextResponse.json(petition, { status: 201 });
  } catch {
    return internalError("Failed to create petition");
  }
}
