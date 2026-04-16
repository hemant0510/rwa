import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = await getAdminContext(searchParams.get("societyId"));
  if (!admin) return forbiddenError("Admin access required");

  try {
    const assignment = await prisma.counsellorSocietyAssignment.findFirst({
      where: { societyId: admin.societyId, isActive: true, isPrimary: true },
      select: {
        isPrimary: true,
        assignedAt: true,
        counsellor: {
          select: {
            id: true,
            name: true,
            email: true,
            publicBlurb: true,
            photoUrl: true,
            isActive: true,
          },
        },
      },
    });

    if (!assignment || !assignment.counsellor.isActive) {
      return successResponse({ counsellor: null });
    }

    return successResponse({
      counsellor: {
        id: assignment.counsellor.id,
        name: assignment.counsellor.name,
        email: assignment.counsellor.email,
        publicBlurb: assignment.counsellor.publicBlurb,
        photoUrl: assignment.counsellor.photoUrl,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch {
    return internalError("Failed to fetch counsellor");
  }
}
