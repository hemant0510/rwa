import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { parseBody, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const broadcastSchema = z.object({
  message: z.string().min(10).max(2000),
  recipientFilter: z.enum(["ALL_ACTIVE", "FEE_PENDING", "FEE_OVERDUE", "CUSTOM"]),
  customRecipientIds: z.array(z.string().uuid()).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;

    const broadcasts = await prisma.broadcast.findMany({
      where: { societyId },
      orderBy: { sentAt: "desc" },
      take: 20,
      include: {
        sender: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: broadcasts });
  } catch {
    return internalError("Failed to fetch broadcasts");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const { data, error } = await parseBody(request, broadcastSchema);
    if (error) return error;
    if (!data) return internalError();

    // Get admin
    const admin = await prisma.user.findFirst({
      where: { societyId, role: "RWA_ADMIN" },
    });
    if (!admin) {
      return NextResponse.json(
        { error: { code: "NO_ADMIN", message: "No admin found" } },
        { status: 400 },
      );
    }

    // Count recipients based on filter
    const recipientWhere: Record<string, unknown> = { societyId, role: "RESIDENT" };
    if (data.recipientFilter === "ALL_ACTIVE") {
      recipientWhere.status = {
        in: [
          "ACTIVE_PAID",
          "ACTIVE_PENDING",
          "ACTIVE_OVERDUE",
          "ACTIVE_PARTIAL",
          "ACTIVE_EXEMPTED",
        ],
      };
    } else if (data.recipientFilter === "FEE_PENDING") {
      recipientWhere.status = "ACTIVE_PENDING";
    } else if (data.recipientFilter === "FEE_OVERDUE") {
      recipientWhere.status = "ACTIVE_OVERDUE";
    } else if (data.recipientFilter === "CUSTOM" && data.customRecipientIds) {
      recipientWhere.id = { in: data.customRecipientIds };
    }

    const recipientCount = await prisma.user.count({ where: recipientWhere });

    const broadcast = await prisma.broadcast.create({
      data: {
        societyId,
        sentBy: admin.id,
        message: data.message,
        recipientFilter: data.recipientFilter,
        recipientCount,
      },
    });

    // TODO: Queue WhatsApp messages for each recipient (Phase 5)

    return NextResponse.json(broadcast, { status: 201 });
  } catch {
    return internalError("Failed to send broadcast");
  }
}
