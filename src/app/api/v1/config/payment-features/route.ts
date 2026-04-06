import { NextResponse } from "next/server";

import { getPaymentFeatureConfig } from "@/lib/config/payment";

/** GET /api/v1/config/payment-features — public, no auth required */
export async function GET() {
  return NextResponse.json(getPaymentFeatureConfig());
}
