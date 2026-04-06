import { NextResponse } from "next/server";

import { errorResponse, internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { platformUpiSchema } from "@/lib/validations/payment-setup";

/** PATCH /api/v1/super-admin/platform-payment-setup/upi — update platform UPI settings */
export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const body = await request.json();
    const result = platformUpiSchema.safeParse(body);

    if (!result.success) {
      return errorResponse({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        status: 422,
        details: result.error.flatten().fieldErrors,
      });
    }

    const { platformUpiId, platformUpiQrUrl, platformUpiAccountName } = result.data;

    await Promise.all([
      prisma.platformSetting.upsert({
        where: { settingKey: "platform_upi_id" },
        update: { settingValue: platformUpiId },
        create: { settingKey: "platform_upi_id", settingValue: platformUpiId },
      }),
      prisma.platformSetting.upsert({
        where: { settingKey: "platform_upi_qr_url" },
        update: { settingValue: platformUpiQrUrl ?? "" },
        create: { settingKey: "platform_upi_qr_url", settingValue: platformUpiQrUrl ?? "" },
      }),
      prisma.platformSetting.upsert({
        where: { settingKey: "platform_upi_account_name" },
        update: { settingValue: platformUpiAccountName ?? "" },
        create: {
          settingKey: "platform_upi_account_name",
          settingValue: platformUpiAccountName ?? "",
        },
      }),
    ]);

    return successResponse({
      platformUpiId,
      platformUpiQrUrl: platformUpiQrUrl ?? null,
      platformUpiAccountName: platformUpiAccountName ?? null,
    });
  } catch (err) {
    console.error("[Platform Payment Setup PATCH]", err);
    return internalError();
  }
}
