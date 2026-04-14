import { internalError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  try {
    const assignments = await prisma.counsellorSocietyAssignment.findMany({
      where: { counsellorId: auth.data.counsellorId, isActive: true },
      orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }],
      select: {
        assignedAt: true,
        isPrimary: true,
        society: {
          select: {
            id: true,
            name: true,
            societyCode: true,
            city: true,
            state: true,
            totalUnits: true,
          },
        },
      },
    });

    const societies = assignments.map((a) => ({
      id: a.society.id,
      name: a.society.name,
      societyCode: a.society.societyCode,
      city: a.society.city,
      state: a.society.state,
      totalUnits: a.society.totalUnits,
      assignedAt: a.assignedAt,
      isPrimary: a.isPrimary,
    }));

    return successResponse({ societies });
  } catch {
    return internalError("Failed to fetch counsellor societies");
  }
}
