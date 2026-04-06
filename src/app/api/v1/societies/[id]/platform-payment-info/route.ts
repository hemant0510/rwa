import { internalError, successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/v1/societies/[id]/platform-payment-info
 * Returns platform UPI settings for the authenticated RWA admin.
 * Used by the admin subscription payment page to display the platform QR.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Society mismatch");

  try {
    const settings = await prisma.platformSetting.findMany({
      where: {
        settingKey: {
          in: ["platform_upi_id", "platform_upi_qr_url", "platform_upi_account_name"],
        },
      },
    });

    const map = Object.fromEntries(settings.map((s) => [s.settingKey, s.settingValue]));

    return successResponse({
      platformUpiId: map.platform_upi_id ?? null,
      platformUpiQrUrl: map.platform_upi_qr_url ?? null,
      platformUpiAccountName: map.platform_upi_account_name ?? null,
    });
  } catch (err) {
    console.error("[Platform Payment Info GET]", err);
    return internalError();
  }
}
