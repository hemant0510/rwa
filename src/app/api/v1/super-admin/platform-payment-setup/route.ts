import { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const SETTING_KEYS = ["platform_upi_id", "platform_upi_qr_url", "platform_upi_account_name"];

/** GET /api/v1/super-admin/platform-payment-setup — get platform UPI settings */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const settings = await prisma.platformSetting.findMany({
      where: { settingKey: { in: SETTING_KEYS } },
    });

    const map = Object.fromEntries(settings.map((s) => [s.settingKey, s.settingValue]));

    return successResponse({
      platformUpiId: map.platform_upi_id || null,
      platformUpiQrUrl: map.platform_upi_qr_url || null,
      platformUpiAccountName: map.platform_upi_account_name || null,
    });
  } catch (err) {
    console.error("[Platform Payment Setup GET]", err);
    return internalError();
  }
}
