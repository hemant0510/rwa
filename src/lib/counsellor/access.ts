import { forbiddenError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assertCounsellorSocietyAccess(
  counsellorId: string,
  societyId: string,
  isSuperAdmin = false,
): Promise<Response | null> {
  if (!UUID_RE.test(societyId)) return notFoundError("Society not found");

  // SA has no assignment — allow access to all societies
  if (isSuperAdmin) return null;

  const assignment = await prisma.counsellorSocietyAssignment.findFirst({
    where: { counsellorId, societyId, isActive: true },
    select: { id: true },
  });

  if (!assignment) return forbiddenError("You are not assigned to this society");

  return null;
}
