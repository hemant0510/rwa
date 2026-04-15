import { NextRequest, NextResponse } from "next/server";

import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCompleteness, type TierLabel } from "@/lib/utils/profile-completeness";

const COMPLETENESS_FILTERS = ["incomplete", "basic", "standard", "complete", "verified"] as const;
type CompletenessFilter = (typeof COMPLETENESS_FILTERS)[number];

function tierMatches(tier: TierLabel, filter: CompletenessFilter) {
  if (filter === "incomplete") return tier !== "VERIFIED";
  if (filter === "basic") return tier === "BASIC";
  if (filter === "standard") return tier === "STANDARD";
  if (filter === "complete") return tier === "COMPLETE";
  return tier === "VERIFIED";
}

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
    const completenessParam = searchParams.get("completeness");
    const completenessFilter = COMPLETENESS_FILTERS.includes(
      completenessParam as CompletenessFilter,
    )
      ? (completenessParam as CompletenessFilter)
      : null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!societyId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAM", message: "societyId is required" } },
        { status: 400 },
      );
    }

    // Auth guard: must be a FULL_ACCESS admin for this society, OR an active Super Admin.
    const admin = await getAdminContext(societyId);
    if (!admin) return unauthorizedError("Admin authentication required");
    if (!admin.isSuperAdmin && admin.adminPermission !== "FULL_ACCESS") {
      return unauthorizedError("Admin authentication required");
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
        /* v8 ignore next */ ...(Array.isArray(where.AND) ? where.AND : []),
        { idProofUrl: { not: null } },
        { ownershipProofUrl: { not: null } },
      ];
    } else if (docStatus === "none") {
      where.AND = [
        /* v8 ignore next */ ...(Array.isArray(where.AND) ? where.AND : []),
        { idProofUrl: null },
        { ownershipProofUrl: null },
      ];
    } else if (docStatus === "partial") {
      where.AND = [
        /* v8 ignore next */ ...(Array.isArray(where.AND) ? where.AND : []),
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
          _count: {
            select: { dependents: { where: { isActive: true } } },
          },
          vehiclesOwned: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: { registrationNumber: true },
          },
          dependents: {
            where: { isEmergencyContact: true, isActive: true },
            select: { id: true, bloodGroup: true },
            take: 5,
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Generate signed photo URLs + map family/vehicle summaries + completeness
    const supabaseAdmin = createAdminClient();
    const dataEnriched = await Promise.all(
      data.map(async (resident) => {
        const familyCount = resident._count?.dependents ?? 0;
        const vehicleSummary = {
          count: resident.vehiclesOwned?.length ?? 0,
          firstReg: resident.vehiclesOwned?.[0]?.registrationNumber ?? null,
        };

        const hasEmergencyContact = (resident.dependents?.length ?? 0) > 0;
        const emergencyContactHasBloodGroup = (resident.dependents ?? []).some(
          (d: { bloodGroup: string | null }) => d.bloodGroup !== null,
        );

        const completeness = computeCompleteness({
          photoUrl: resident.photoUrl,
          mobile: resident.mobile,
          isEmailVerified: resident.isEmailVerified,
          bloodGroup: resident.bloodGroup,
          idProofUrl: resident.idProofUrl,
          ownershipProofUrl: resident.ownershipProofUrl,
          ownershipType: resident.ownershipType,
          hasEmergencyContact,
          householdStatus: resident.householdStatus,
          vehicleStatus: resident.vehicleStatus,
          consentWhatsapp: resident.consentWhatsapp,
          showInDirectory: resident.showInDirectory,
          emergencyContactHasBloodGroup,
        });

        const base = {
          ...resident,
          familyCount,
          vehicleSummary,
          completenessScore: completeness.percentage,
          tier: completeness.tier,
        };

        if (!resident.photoUrl) return base;
        const { data: signedData } = await supabaseAdmin.storage
          .from("resident-photos")
          .createSignedUrl(resident.photoUrl, 60 * 60);
        return { ...base, photoUrl: signedData?.signedUrl ?? null };
      }),
    );

    // Completeness filter applied in-memory after fetch — page size may shrink
    const filtered = completenessFilter
      ? dataEnriched.filter((r) => tierMatches(r.tier, completenessFilter))
      : dataEnriched;

    return NextResponse.json({ data: filtered, total, page, limit });
  } catch {
    return internalError("Failed to fetch residents");
  }
}
