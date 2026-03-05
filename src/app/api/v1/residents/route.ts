import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const societyId = searchParams.get("societyId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!societyId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAM", message: "societyId is required" } },
        { status: 400 },
      );
    }

    const where: Record<string, unknown> = {
      societyId,
      role: "RESIDENT",
    };

    if (status === "PENDING") {
      where.status = "PENDING_APPROVAL";
    } else if (status === "ACTIVE") {
      where.status = {
        in: [
          "ACTIVE_PAID",
          "ACTIVE_PENDING",
          "ACTIVE_OVERDUE",
          "ACTIVE_PARTIAL",
          "ACTIVE_EXEMPTED",
        ],
      };
    } else if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { rwaid: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          userUnits: {
            include: { unit: true },
            take: 1,
          },
          membershipFees: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return internalError("Failed to fetch residents");
  }
}
