import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const societyId = searchParams.get("societyId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const emailVerified = searchParams.get("emailVerified");
    const ownershipType = searchParams.get("ownershipType");
    const year = searchParams.get("year");
    const docStatus = searchParams.get("docStatus"); // "none" | "partial" | "full"
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

    if (emailVerified === "true") {
      where.isEmailVerified = true;
    } else if (emailVerified === "false") {
      where.isEmailVerified = false;
    }

    if (ownershipType && ownershipType !== "all") {
      where.ownershipType = ownershipType;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { rwaid: { contains: search, mode: "insensitive" } },
      ];
    }

    // Document status filter — wrap existing AND array
    if (docStatus === "full") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { idProofUrl: { not: null } },
        { ownershipProofUrl: { not: null } },
      ];
    } else if (docStatus === "none") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { idProofUrl: null },
        { ownershipProofUrl: null },
      ];
    } else if (docStatus === "partial") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { idProofUrl: null, ownershipProofUrl: { not: null } },
            { idProofUrl: { not: null }, ownershipProofUrl: null },
          ],
        },
      ];
    }

    // Year filter on RWAID — e.g. year=2026 matches RWAIDs containing "-2026-"
    if (year && year !== "all") {
      const yearClause = { rwaid: { contains: `-${year}-` } };
      if (where.OR) {
        // Combine with existing OR: must match search AND year
        where.AND = [{ OR: where.OR as unknown[] }, yearClause];
        delete where.OR;
      } else {
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), yearClause];
      }
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
