import { successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/v1/societies/[id]/payment-claims/pending-count — badge count for admin sidebar */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Access denied");

  const count = await prisma.paymentClaim.count({
    where: { societyId, status: "PENDING" },
  });

  return successResponse({ count });
}
