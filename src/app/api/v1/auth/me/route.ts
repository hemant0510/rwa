import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check super_admins table first
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { authUserId: authUser.id },
  });

  if (superAdmin) {
    return NextResponse.json({
      id: superAdmin.id,
      name: superAdmin.name,
      email: superAdmin.email,
      role: "SUPER_ADMIN" as const,
      societyId: null,
      permission: null,
      redirectTo: "/sa/dashboard",
    });
  }

  // Check users table (include society for trial info)
  const user = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: {
      society: {
        select: { name: true, societyCode: true, status: true, trialEndsAt: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const redirectTo = user.role === "RWA_ADMIN" ? "/admin/dashboard" : "/r/home";

  const isTrialExpired =
    user.society?.status === "TRIAL" &&
    user.society?.trialEndsAt != null &&
    new Date(user.society.trialEndsAt) < new Date();

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    societyId: user.societyId,
    permission: user.adminPermission,
    redirectTo,
    societyName: user.society?.name ?? null,
    societyCode: user.society?.societyCode ?? null,
    societyStatus: user.society?.status ?? null,
    trialEndsAt: user.society?.trialEndsAt ?? null,
    isTrialExpired: isTrialExpired ?? false,
  });
}
