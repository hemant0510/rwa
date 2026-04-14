import { forbiddenError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assertCounsellorSocietyAccess(
  counsellorId: string,
  societyId: string,
): Promise<Response | null> {
  if (!UUID_RE.test(societyId)) return notFoundError("Society not found");

  const assignment = await prisma.counsellorSocietyAssignment.findFirst({
    where: { counsellorId, societyId, isActive: true },
    select: { id: true },
  });

  if (!assignment) return forbiddenError("You are not assigned to this society");

  return null;
}
